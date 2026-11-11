"""Email-in: verify the Resend webhook, resolve the user, fetch attachments, feed the normal intake."""

from __future__ import annotations

import html
import io
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr
from typing import Any

import httpx
from PIL import Image
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from app.config import settings
from app.db import get_sessionmaker
from app.errors import ApiError
from app.models import Document, InboundEmail, UserSettings
from app.services import intake

log = logging.getLogger(__name__)

RESEND_API = "https://api.resend.com"
ALLOWED_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/jpg"}
ALLOWED_EXT = (".pdf", ".png", ".jpg", ".jpeg")


# ---------------------------------------------------------------- tokens ----


def new_token() -> str:
    """16 lowercase base32 chars (80 bits): safe in an email local part, case-insensitive."""
    import base64

    return base64.b32encode(secrets.token_bytes(10)).decode().lower()


def inbound_address(token: str) -> str | None:
    return f"{token}@{settings.INBOUND_EMAIL_DOMAIN}" if settings.INBOUND_EMAIL_DOMAIN else None


# -------------------------------------------------------------- webhook ----


def verify_webhook(payload: bytes, headers: dict[str, str]) -> dict[str, Any]:
    if not settings.RESEND_WEBHOOK_SECRET:
        raise ApiError(503, "INBOUND_DISABLED", "Email-in is not configured.")
    try:
        event = Webhook(settings.RESEND_WEBHOOK_SECRET).verify(
            payload,
            {
                "svix-id": headers.get("svix-id", ""),
                "svix-timestamp": headers.get("svix-timestamp", ""),
                "svix-signature": headers.get("svix-signature", ""),
            },
        )
    except WebhookVerificationError:
        raise ApiError(401, "INVALID_SIGNATURE", "Webhook signature verification failed.") from None
    return event


def _recipient_tokens(data: dict[str, Any]) -> list[str]:
    domain = settings.INBOUND_EMAIL_DOMAIN.lower()
    tokens: list[str] = []
    for field in ("to", "cc", "bcc"):
        for raw in data.get(field) or []:
            addr = parseaddr(raw if isinstance(raw, str) else "")[1].lower()
            local, _, dom = addr.partition("@")
            if domain and dom == domain and local:
                tokens.append(local)
    return tokens


# ------------------------------------------------------ Resend HTTP calls ----
# Module-level so tests can replace them.


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.RESEND_API_KEY}", "User-Agent": "invoicextract-backend/1.0"}


async def fetch_attachments(email_id: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{RESEND_API}/emails/receiving/{email_id}/attachments", headers=_headers())
        r.raise_for_status()
        body = r.json()
    return body.get("data", []) if isinstance(body, dict) else list(body)


async def download(url: str, max_bytes: int) -> bytes | None:
    """Download one attachment, refusing anything over max_bytes (returns None)."""
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
        async with c.stream("GET", url) as r:
            r.raise_for_status()
            buf = bytearray()
            async for chunk in r.aiter_bytes():
                buf.extend(chunk)
                if len(buf) > max_bytes:
                    return None
            return bytes(buf)


async def send_reply(to: str, subject: str, text_body: str, html_body: str, idempotency_key: str) -> None:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{RESEND_API}/emails",
            headers={**_headers(), "Idempotency-Key": idempotency_key},
            json={"from": settings.RESEND_FROM_EMAIL.strip("\"'"), "to": [to], "subject": subject, "text": text_body, "html": html_body},
        )
        r.raise_for_status()


# ---------------------------------------------------------------- ingest ----


def _eligible(att: dict[str, Any]) -> tuple[bool, str | None]:
    """Decide whether an attachment is worth ingesting; (False, reason) to skip it."""
    name = (att.get("filename") or "").lower()
    ctype = (att.get("content_type") or "").lower().split(";")[0].strip()
    if ctype not in ALLOWED_TYPES and not name.endswith(ALLOWED_EXT):
        return False, "unsupported_type"
    is_image = ctype.startswith("image/") or name.endswith((".png", ".jpg", ".jpeg"))
    if is_image:
        if (att.get("content_disposition") or "").lower() == "inline" or att.get("content_id"):
            return False, "inline_image"
        size = att.get("size")
        if isinstance(size, int) and size < settings.INBOUND_MIN_IMAGE_BYTES:
            return False, "tiny_image"
    return True, None


def _too_small_image(data: bytes) -> bool:
    try:
        with Image.open(io.BytesIO(data)) as im:
            return max(im.size) < settings.INBOUND_MIN_IMAGE_EDGE
    except Exception:  # noqa: BLE001
        return False  # let intake produce the proper error


async def resolve_user(session: AsyncSession, tokens: list[str]) -> str | None:
    if not tokens:
        return None
    row = (
        await session.execute(
            select(UserSettings.user_id).where(UserSettings.inbound_token.in_(tokens), UserSettings.inbound_enabled.is_(True))
        )
    ).first()
    return row[0] if row else None


async def handle_email_received(session: AsyncSession, data: dict[str, Any]) -> dict[str, Any]:
    """Process one verified email.received event. Returns a small status dict for the webhook reply."""
    email_id = data.get("email_id")
    if not isinstance(email_id, str) or not email_id:
        return {"status": "ignored", "reason": "no_email_id"}

    user_id = await resolve_user(session, _recipient_tokens(data))
    if user_id is None:
        return {"status": "dropped"}  # unknown or disabled address: silently ignored

    sender = parseaddr(data.get("from") or "")[1].lower()
    subject = (data.get("subject") or "")[:500]

    claimed = (
        await session.execute(
            pg_insert(InboundEmail)
            .values(id=email_id, user_id=user_id, from_address=sender, subject=subject)
            .on_conflict_do_nothing(index_elements=[InboundEmail.id])
            .returning(InboundEmail.id)
        )
    ).first()
    await session.commit()
    if claimed is None:
        return {"status": "duplicate"}  # Resend retry of an email we already handled

    try:
        day_ago = datetime.now(timezone.utc) - timedelta(days=1)
        today = await session.scalar(
            select(func.count()).select_from(InboundEmail).where(InboundEmail.user_id == user_id, InboundEmail.received_at >= day_ago)
        )
        if (today or 0) > settings.INBOUND_EMAILS_PER_DAY:
            await _store_result(session, email_id, [{"outcome": "skipped", "reason": "daily_limit"}], reply_done=True)
            return {"status": "rate_limited"}

        results: list[dict[str, Any]] = []
        attachments = await fetch_attachments(email_id)
        taken = 0
        for att in attachments:
            fname = att.get("filename") or "attachment"
            ok, reason = _eligible(att)
            if not ok:
                results.append({"file_name": fname, "outcome": "skipped", "reason": reason})
                continue
            if taken >= settings.INBOUND_MAX_ATTACHMENTS:
                results.append({"file_name": fname, "outcome": "skipped", "reason": "too_many_attachments"})
                continue
            taken += 1
            size = att.get("size")
            if isinstance(size, int) and size > settings.max_file_bytes:
                results.append({"file_name": fname, "outcome": "error", "error_code": "FILE_TOO_LARGE"})
                continue
            blob = await download(att.get("download_url") or "", settings.max_file_bytes)
            if blob is None:
                results.append({"file_name": fname, "outcome": "error", "error_code": "FILE_TOO_LARGE"})
                continue
            if intake.sniff_type(blob) and intake.sniff_type(blob)[0].startswith("image/") and _too_small_image(blob):
                results.append({"file_name": fname, "outcome": "skipped", "reason": "tiny_image"})
                taken -= 1
                continue
            res = await intake.ingest_file(
                session,
                user_id,
                fname,
                blob,
                source="email",
                source_detail={"sender": sender, "subject": subject, "inbound_email_id": email_id},
            )
            if res.success:
                results.append({"file_name": fname, "outcome": "queued", "document_id": res.document_id})
            else:
                results.append(
                    {
                        "file_name": fname,
                        "outcome": "error",
                        "error_code": res.error_code,
                        "document_id": res.details.get("existing_document_id"),
                    }
                )
        await _store_result(session, email_id, results)
    except Exception:
        # Let Resend retry: forget the claim so the retry is not mistaken for a duplicate.
        await session.rollback()
        await session.execute(delete(InboundEmail).where(InboundEmail.id == email_id))
        await session.commit()
        raise

    from app.services.worker import worker

    worker.notify()
    await maybe_send_summary(email_id)
    return {"status": "processed", "attachments": len(results)}


async def _store_result(session: AsyncSession, email_id: str, results: list[dict[str, Any]], reply_done: bool = False) -> None:
    values: dict[str, Any] = {"result": results}
    if reply_done:
        values["reply_sent_at"] = datetime.now(timezone.utc)
    await session.execute(update(InboundEmail).where(InboundEmail.id == email_id).values(**values))
    await session.commit()


# --------------------------------------------------------------- summary ----


async def on_document_finished(doc_id: uuid.UUID) -> None:
    async with get_sessionmaker()() as s:
        doc = await s.get(Document, doc_id)
        email_id = (doc.source_detail or {}).get("inbound_email_id") if doc and doc.source == "email" else None
    if email_id:
        await maybe_send_summary(email_id)


async def _account_email(user_id: str) -> str | None:
    """Read-only lookup in the Better Auth user table (never modified here)."""
    try:
        async with get_sessionmaker()() as s:
            row = (await s.execute(text('SELECT email FROM "user" WHERE id = :id').bindparams(id=user_id))).first()
            return row[0].lower() if row and row[0] else None
    except Exception:  # noqa: BLE001
        return None


def _line(r: dict[str, Any], status: str | None) -> str:
    name = r.get("file_name") or "attachment"
    if r["outcome"] == "skipped":
        return f"- {name}: skipped ({str(r.get('reason', '')).replace('_', ' ')})"
    if r["outcome"] == "error":
        code = r.get("error_code")
        msg = {
            "DUPLICATE_DOCUMENT": "already uploaded before",
            "INSUFFICIENT_CREDITS": "not enough credits",
            "FILE_TOO_LARGE": f"larger than {settings.MAX_FILE_MB} MB",
            "PAGE_LIMIT_EXCEEDED": f"more than {settings.MAX_PDF_PAGES} pages",
            "PDF_ENCRYPTED": "password protected",
        }.get(code or "", "could not be read as a PDF, PNG or JPEG")
        return f"- {name}: not processed ({msg})"
    return {
        "processed": f"- {name}: processed",
        "rejected": f"- {name}: rejected, it doesn't look like an invoice (no credits used)",
        "failed": f"- {name}: failed, retry it from your dashboard (no credits used)",
        None: f"- {name}: processed or removed",
    }.get(status, f"- {name}: {status}")


async def maybe_send_summary(email_id: str) -> bool:
    """Send one summary reply once every attachment has a final outcome. Idempotent."""
    sm = get_sessionmaker()
    async with sm() as s:
        row = await s.get(InboundEmail, email_id)
        if row is None or row.reply_sent_at is not None or row.result is None:
            return False
        results = list(row.result)
        doc_ids = [uuid.UUID(r["document_id"]) for r in results if r.get("outcome") == "queued"]
        statuses: dict[str, str] = {}
        if doc_ids:
            for d in (await s.execute(select(Document.id, Document.status).where(Document.id.in_(doc_ids)))).all():
                statuses[str(d.id)] = d.status
        if any(st in ("queued", "validating", "extracting") for st in statuses.values()):
            return False  # still working; the worker calls us again when each document finishes
        claim = await s.execute(
            update(InboundEmail)
            .where(InboundEmail.id == email_id, InboundEmail.reply_sent_at.is_(None))
            .values(reply_sent_at=datetime.now(timezone.utc))
            .returning(InboundEmail.id)
        )
        won = claim.first() is not None
        await s.commit()
        if not won:
            return False
        user_id, sender, subject = row.user_id, (row.from_address or "").lower(), row.subject or ""

    if not (settings.RESEND_API_KEY and settings.RESEND_FROM_EMAIL):
        return False
    account = await _account_email(user_id)
    if not account or account != sender:
        return False  # only reply when the sender is the account owner: no spraying strangers

    lines = [_line(r, statuses.get(r["document_id"]) if r.get("outcome") == "queued" else None) for r in results]
    if not lines:
        lines = ["- No PDF, PNG or JPEG attachments were found in your email."]
    clean_subject = " ".join(subject.split())[:120]  # no CR/LF in headers
    body = "Here is what happened to the attachments in your email:\n\n" + "\n".join(lines) + "\n\nOpen your dashboard to review and export the results."
    html_body = "<p>Here is what happened to the attachments in your email:</p><ul>" + "".join(
        f"<li>{html.escape(l[2:])}</li>" for l in lines
    ) + "</ul><p>Open your dashboard to review and export the results.</p>"
    try:
        await send_reply(account, f"InvoicExtract: results for \"{clean_subject}\"" if clean_subject else "InvoicExtract: your email results", body, html_body, f"inbound-reply/{email_id}")
    except Exception:  # noqa: BLE001
        log.exception("failed to send inbound summary for %s", email_id)
        return False
    return True
