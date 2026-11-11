import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from svix.webhooks import Webhook

from app.config import settings
from app.db import get_sessionmaker
from app.main import create_app
from app.services import inbound
from app.services.worker import process_pending
from tests.helpers import NON_INVOICE_COLOR, make_pdf, make_png

ACCOUNT_EMAIL = "owner@example.com"


class Mailbox:
    """Stands in for Resend: attachments to fetch/download and replies that were sent."""

    def __init__(self) -> None:
        self.attachments: dict[str, list[dict]] = {}
        self.blobs: dict[str, bytes] = {}
        self.sent: list[dict] = []
        self.fetch_error: Exception | None = None

    def add(self, email_id: str, filename: str, data: bytes, ctype: str, **meta) -> None:
        url = f"https://files.test/{uuid.uuid4().hex}"
        self.blobs[url] = data
        self.attachments.setdefault(email_id, []).append(
            {"id": uuid.uuid4().hex, "filename": filename, "content_type": ctype, "size": meta.pop("size", len(data)), "download_url": url, **meta}
        )


@pytest.fixture
def mailbox(monkeypatch) -> Mailbox:
    mb = Mailbox()

    async def fetch(email_id):
        if mb.fetch_error:
            raise mb.fetch_error
        return mb.attachments.get(email_id, [])

    async def download(url, max_bytes):
        data = mb.blobs[url]
        return data if len(data) <= max_bytes else None

    async def send(to, subject, text_body, html_body, idempotency_key):
        mb.sent.append({"to": to, "subject": subject, "text": text_body, "html": html_body, "key": idempotency_key})

    monkeypatch.setattr(inbound, "fetch_attachments", fetch)
    monkeypatch.setattr(inbound, "download", download)
    monkeypatch.setattr(inbound, "send_reply", send)
    return mb


async def account(user="user_a", email=ACCOUNT_EMAIL):
    async with get_sessionmaker()() as s:
        await s.execute(
            text('INSERT INTO "user" (id, email, name) VALUES (:i, :e, :n) ON CONFLICT (id) DO UPDATE SET email = :e').bindparams(i=user, e=email, n="Owner")
        )
        await s.commit()


async def address(client, headers, user="user_a") -> str:
    return (await client.get("/v1/settings", headers=headers(user))).json()["inbound_address"]


def signed(payload: dict, *, secret=None, msg_id=None, age=0):
    body = json.dumps(payload)
    msg_id = msg_id or f"msg_{uuid.uuid4().hex}"
    ts = datetime.now(timezone.utc) - timedelta(seconds=age)
    sig = Webhook(secret or settings.RESEND_WEBHOOK_SECRET).sign(msg_id, ts, body)
    return body, {"svix-id": msg_id, "svix-timestamp": str(int(ts.timestamp())), "svix-signature": sig, "content-type": "application/json"}


def event(to: str, email_id=None, sender=ACCOUNT_EMAIL, subject="Invoices for March", etype="email.received"):
    return {
        "type": etype,
        "created_at": "2026-03-01T10:00:00Z",
        "data": {"email_id": email_id or f"em_{uuid.uuid4().hex[:10]}", "from": f"Owner <{sender}>", "to": [to], "cc": [], "bcc": [], "subject": subject, "attachments": []},
    }


async def deliver(client, payload, **kw):
    body, hdrs = signed(payload, **kw)
    return await client.post("/v1/inbound/email", content=body, headers=hdrs)


async def doc_count() -> int:
    async with get_sessionmaker()() as s:
        return (await s.execute(text("SELECT count(*) FROM documents"))).scalar()


# ------------------------------------------------------------------ security ----


async def test_bad_signature_refused(client, headers, mailbox):
    to = await address(client, headers)
    ev = event(to)
    mailbox.add(ev["data"]["email_id"], "inv.pdf", make_pdf(1), "application/pdf")
    r = await deliver(client, ev, secret="whsec_" + "d3Jvbmctc2VjcmV0LXdyb25nLXNlY3JldA==")
    assert r.status_code == 401 and r.json()["error"]["code"] == "INVALID_SIGNATURE"
    body, hdrs = signed(ev)
    assert (await client.post("/v1/inbound/email", content=body.replace("March", "April"), headers=hdrs)).status_code == 401  # tampered body
    assert (await client.post("/v1/inbound/email", content=body)).status_code == 401  # no signature headers
    assert (await deliver(client, ev, age=3600)).status_code == 401  # replayed old timestamp
    assert await doc_count() == 0


async def test_no_jwt_needed_but_secret_must_be_configured(client, headers, monkeypatch):
    monkeypatch.setattr(settings, "RESEND_WEBHOOK_SECRET", "")
    body, hdrs = signed(event("x@in.test.example"), secret="whsec_" + "dGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQ=")
    assert (await client.post("/v1/inbound/email", content=body, headers=hdrs)).status_code == 503


async def test_other_event_types_ignored(client, headers, mailbox):
    to = await address(client, headers)
    r = await deliver(client, event(to, etype="email.delivered"))
    assert r.status_code == 200 and r.json()["status"] == "ignored"


async def test_unknown_and_disabled_addresses_dropped_silently(client, headers, mailbox):
    to = await address(client, headers)
    r = await deliver(client, event("nosuchtoken00000@in.test.example"))
    assert r.status_code == 200 and r.json()["status"] == "dropped"
    r = await deliver(client, event(to.replace("@in.test.example", "@elsewhere.example")))  # wrong domain
    assert r.json()["status"] == "dropped"
    await client.patch("/v1/settings", json={"inbound_enabled": False}, headers=headers("user_a"))
    ev = event(to)
    mailbox.add(ev["data"]["email_id"], "inv.pdf", make_pdf(1), "application/pdf")
    assert (await deliver(client, ev)).json()["status"] == "dropped"
    assert await doc_count() == 0 and mailbox.sent == []


async def test_regenerating_the_address_kills_the_old_one(client, headers, mailbox):
    old = await address(client, headers)
    r = await client.post("/v1/settings/inbound-address/regenerate", headers=headers("user_a"))
    new = r.json()["inbound_address"]
    assert new != old and new.endswith("@in.test.example")
    ev = event(old)
    mailbox.add(ev["data"]["email_id"], "inv.pdf", make_pdf(1), "application/pdf")
    assert (await deliver(client, ev)).json()["status"] == "dropped"
    ev2 = event(new)
    mailbox.add(ev2["data"]["email_id"], "inv.pdf", make_pdf(1), "application/pdf")
    assert (await deliver(client, ev2)).json()["status"] == "processed"


# ---------------------------------------------------------------- idempotency ----


async def test_repeated_email_id_is_processed_once(client, headers, mailbox, fake_openai):
    await account()
    to = await address(client, headers)
    ev = event(to, email_id="em_same")
    mailbox.add("em_same", "inv.pdf", make_pdf(1), "application/pdf")
    assert (await deliver(client, ev)).json()["status"] == "processed"
    assert (await deliver(client, ev)).json()["status"] == "duplicate"  # Resend retry
    assert (await deliver(client, ev)).json()["status"] == "duplicate"
    assert await doc_count() == 1
    await process_pending()
    assert len(mailbox.sent) == 1


async def test_fetch_failure_returns_500_and_lets_the_retry_succeed(headers, mailbox, fake_openai):
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        to = await address(c, headers)
        ev = event(to, email_id="em_flaky")
        mailbox.add("em_flaky", "inv.pdf", make_pdf(1), "application/pdf")
        mailbox.fetch_error = RuntimeError("resend down")
        assert (await deliver(c, ev)).status_code == 500
        mailbox.fetch_error = None
        r = await deliver(c, ev)  # Resend retries: the failed attempt left no claim behind
        assert r.status_code == 200 and r.json()["status"] == "processed"
        assert await doc_count() == 1


# ------------------------------------------------------------------- pipeline ----


async def test_invoice_signature_image_and_non_invoice_attachment(client, headers, mailbox, fake_openai):
    await account()
    to = await address(client, headers)
    ev = event(to, email_id="em_mixed")
    mailbox.add("em_mixed", "march-invoice.pdf", make_pdf(1), "application/pdf")
    mailbox.add("em_mixed", "image001.png", make_png(120, 40, tag="0b"), "image/png", content_disposition="inline", content_id="<sig@x>", size=2300)
    mailbox.add("em_mixed", "holiday.png", make_png(700, 900, color=NON_INVOICE_COLOR), "image/png", size=84000)

    r = await deliver(client, ev)
    assert r.json() == {"status": "processed", "attachments": 3}
    await process_pending()

    async with get_sessionmaker()() as s:
        rows = (await s.execute(text("SELECT file_name, status, source, source_detail FROM documents ORDER BY file_name"))).all()
    by_name = {r.file_name: r for r in rows}
    assert set(by_name) == {"holiday.png", "march-invoice.pdf"}  # the signature image never became a document
    assert by_name["march-invoice.pdf"].status == "processed" and by_name["march-invoice.pdf"].source == "email"
    assert by_name["holiday.png"].status == "rejected"
    assert by_name["march-invoice.pdf"].source_detail["sender"] == ACCOUNT_EMAIL
    assert by_name["march-invoice.pdf"].source_detail["subject"] == "Invoices for March"
    async with get_sessionmaker()() as s:
        result = (await s.execute(text("SELECT result FROM inbound_emails WHERE id = 'em_mixed'"))).scalar()
    assert sorted(x["outcome"] for x in result) == ["queued", "queued", "skipped"]
    assert [x["reason"] for x in result if x["outcome"] == "skipped"] == ["inline_image"]

    # one summary reply, to the account owner, only after everything finished
    assert len(mailbox.sent) == 1
    mail = mailbox.sent[0]
    assert mail["to"] == ACCOUNT_EMAIL and mail["key"] == "inbound-reply/em_mixed"
    assert "march-invoice.pdf: processed" in mail["text"]
    assert "holiday.png: rejected" in mail["text"]
    assert "image001.png: skipped" in mail["text"]
    # the same dashboard sees it, marked as coming from email
    items = (await client.get("/v1/documents", headers=headers("user_a"))).json()["items"]
    assert {i["source"] for i in items} == {"email"}
    assert (await client.get("/v1/credits", headers=headers("user_a"))).json()["current_balance"] == 4  # only the invoice was charged


async def test_reply_waits_until_all_documents_finish(client, headers, mailbox, fake_openai):
    await account()
    to = await address(client, headers)
    ev = event(to, email_id="em_wait")
    mailbox.add("em_wait", "a.pdf", make_pdf(1), "application/pdf")
    await deliver(client, ev)
    assert mailbox.sent == []  # still queued
    await process_pending()
    assert len(mailbox.sent) == 1
    await inbound.maybe_send_summary("em_wait")
    assert len(mailbox.sent) == 1  # never twice


async def test_no_reply_when_sender_is_not_the_account_owner(client, headers, mailbox, fake_openai):
    await account()
    to = await address(client, headers)
    ev = event(to, email_id="em_spoof", sender="stranger@evil.example")
    mailbox.add("em_spoof", "a.pdf", make_pdf(1), "application/pdf")
    await deliver(client, ev)
    await process_pending()
    assert mailbox.sent == []  # cannot be used to spray replies at other people
    assert await doc_count() == 1  # the document is still processed and visible


async def test_no_reply_when_account_email_unknown(client, headers, mailbox, fake_openai):
    to = await address(client, headers)  # no row in the user table
    ev = event(to, email_id="em_nouser")
    mailbox.add("em_nouser", "a.pdf", make_pdf(1), "application/pdf")
    await deliver(client, ev)
    await process_pending()
    assert mailbox.sent == []


async def test_reply_reports_duplicate_and_out_of_credits(client, headers, mailbox, fake_openai):
    await account()
    to = await address(client, headers)
    pdf = make_pdf(1)
    first = event(to, email_id="em_1")
    mailbox.add("em_1", "same.pdf", pdf, "application/pdf")
    await deliver(client, first)
    await process_pending()
    second = event(to, email_id="em_2")
    mailbox.add("em_2", "same-again.pdf", pdf, "application/pdf")
    mailbox.add("em_2", "huge.pdf", make_pdf(6), "application/pdf")
    await deliver(client, second)
    mail = mailbox.sent[-1]
    assert "same-again.pdf: not processed (already uploaded before)" in mail["text"]
    assert "huge.pdf: not processed (not enough credits)" in mail["text"]


async def test_html_in_filenames_and_subjects_is_escaped(client, headers, mailbox, fake_openai):
    await account()
    to = await address(client, headers)
    ev = event(to, email_id="em_html", subject="Hi\r\nBcc: attacker@evil.example")
    mailbox.add("em_html", "<script>alert(1)</script>.pdf", make_pdf(1), "application/pdf")
    await deliver(client, ev)
    await process_pending()
    mail = mailbox.sent[0]
    assert "<script>" not in mail["html"] and "&lt;script&gt;" in mail["html"]
    assert "\n" not in mail["subject"] and "\r" not in mail["subject"]


# --------------------------------------------------------------------- limits ----


async def test_attachment_cap_and_unsupported_types(client, headers, mailbox, fake_openai):
    to = await address(client, headers)
    ev = event(to, email_id="em_many")
    for i in range(7):
        mailbox.add("em_many", f"f{i}.pdf", make_pdf(1, tag=f"{i:08x}"), "application/pdf")
    mailbox.add("em_many", "notes.docx", b"PK\x03\x04", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    await deliver(client, ev)
    async with get_sessionmaker()() as s:
        result = (await s.execute(text("SELECT result FROM inbound_emails WHERE id = 'em_many'"))).scalar()
    outcomes = [(x["outcome"], x.get("reason")) for x in result]
    assert outcomes.count(("queued", None)) == 5  # INBOUND_MAX_ATTACHMENTS
    assert outcomes.count(("skipped", "too_many_attachments")) == 2
    assert outcomes.count(("skipped", "unsupported_type")) == 1


async def test_daily_email_cap(client, headers, mailbox, monkeypatch):
    monkeypatch.setattr(settings, "INBOUND_EMAILS_PER_DAY", 2)
    to = await address(client, headers)
    statuses = []
    for i in range(3):
        ev = event(to, email_id=f"em_day_{i}")
        mailbox.add(ev["data"]["email_id"], "a.pdf", make_pdf(1, tag=f"{i:08x}"), "application/pdf")
        statuses.append((await deliver(client, ev)).json()["status"])
    assert statuses == ["processed", "processed", "rate_limited"]
    assert await doc_count() == 2


async def test_tiny_images_skipped_by_size_and_by_dimensions(client, headers, mailbox):
    to = await address(client, headers)
    ev = event(to, email_id="em_tiny")
    mailbox.add("em_tiny", "logo.png", make_png(50, 50, tag="0c"), "image/png", size=900)  # tiny by size
    mailbox.add("em_tiny", "banner.png", make_png(100, 80, tag="0d"), "image/png", size=40000)  # small by dimensions
    await deliver(client, ev)
    assert await doc_count() == 0


async def test_oversized_attachment_reported_not_downloaded(client, headers, mailbox, monkeypatch):
    monkeypatch.setattr(settings, "MAX_FILE_MB", 1)
    to = await address(client, headers)
    ev = event(to, email_id="em_big")
    mailbox.add("em_big", "big.pdf", make_pdf(1), "application/pdf", size=5 * 1024 * 1024)
    await deliver(client, ev)
    async with get_sessionmaker()() as s:
        result = (await s.execute(text("SELECT result FROM inbound_emails WHERE id = 'em_big'"))).scalar()
    assert result[0]["error_code"] == "FILE_TOO_LARGE"
