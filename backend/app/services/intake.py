"""Synchronous intake: validate a file, de-duplicate, check credits, store it, queue it.

Used by both the upload endpoint and email-in, so they share limits, codes and credit rules.
"""

from __future__ import annotations

import hashlib
import io
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import IN_FLIGHT, Document
from app.services import credits, storage
from app.services.rendering import PDFIUM_LOCK

log = logging.getLogger(__name__)

ERROR_MESSAGES = {
    "INVALID_DOCUMENT": "Only PDF, PNG and JPEG files that can be opened are supported.",
    "FILE_TOO_LARGE": "File is larger than the {max_mb} MB limit.",
    "PAGE_LIMIT_EXCEEDED": "PDF has more than {max_pages} pages.",
    "PDF_ENCRYPTED": "PDF is password protected. Remove the password and upload it again.",
    "DUPLICATE_DOCUMENT": "This file has already been uploaded.",
    "INSUFFICIENT_CREDITS": "Not enough credits to process this document.",
    "TOO_MANY_IN_FLIGHT": "Too many documents are still processing. Wait for some to finish.",
    "RATE_LIMITED": "Hourly upload limit reached. Try again later.",
    "EMPTY_FILE": "The file is empty.",
}


@dataclass
class FileResult:
    file_name: str
    success: bool
    document_id: str | None = None
    status: str | None = None
    error_code: str | None = None
    message: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_name": self.file_name,
            "success": self.success,
            "document_id": self.document_id,
            "status": self.status,
            "error_code": self.error_code,
            "message": self.message,
            "details": self.details,
        }


class IntakeError(Exception):
    def __init__(self, code: str, **details: Any) -> None:
        super().__init__(code)
        self.code = code
        self.details = details

    @property
    def message(self) -> str:
        return ERROR_MESSAGES[self.code].format(max_mb=settings.MAX_FILE_MB, max_pages=settings.MAX_PDF_PAGES)


@dataclass
class Inspected:
    mime_type: str
    ext: str
    num_pages: int


def sniff_type(data: bytes) -> tuple[str, str] | None:
    """Type by magic bytes, never by the client's claim."""
    if data.startswith(b"%PDF-"):
        return "application/pdf", "pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    return None


def inspect_file(data: bytes) -> Inspected:
    """Raises IntakeError for anything that should not be queued."""
    if not data:
        raise IntakeError("EMPTY_FILE")
    if len(data) > settings.max_file_bytes:
        raise IntakeError("FILE_TOO_LARGE")
    sniffed = sniff_type(data)
    if sniffed is None:
        raise IntakeError("INVALID_DOCUMENT")
    mime, ext = sniffed

    if mime == "application/pdf":
        with PDFIUM_LOCK:
            try:
                pdf = pdfium.PdfDocument(data)
            except pdfium.PdfiumError as e:
                if getattr(e, "err_code", None) == pdfium_c.FPDF_ERR_PASSWORD:
                    raise IntakeError("PDF_ENCRYPTED") from None
                raise IntakeError("INVALID_DOCUMENT") from None
            try:
                pages = len(pdf)
            finally:
                pdf.close()
        if pages < 1:
            raise IntakeError("INVALID_DOCUMENT")
        if pages > settings.MAX_PDF_PAGES:
            raise IntakeError("PAGE_LIMIT_EXCEEDED", pages=pages, max_pages=settings.MAX_PDF_PAGES)
        return Inspected(mime, ext, pages)

    # images: read dimensions from the header only, then refuse decompression bombs
    try:
        with Image.open(io.BytesIO(data)) as im:
            width, height = im.size
            fmt = im.format
    except Exception:  # noqa: BLE001
        raise IntakeError("INVALID_DOCUMENT") from None
    if fmt not in ("PNG", "JPEG") or width * height > settings.MAX_IMAGE_PIXELS:
        raise IntakeError("INVALID_DOCUMENT", reason="image_too_large" if fmt in ("PNG", "JPEG") else "format")
    return Inspected(mime, ext, 1)


def _clean_name(name: str | None) -> str:
    name = (name or "document").replace("\\", "/").rsplit("/", 1)[-1].strip()
    return (name or "document")[:255]


async def ingest_file(
    session: AsyncSession,
    user_id: str,
    file_name: str | None,
    data: bytes,
    *,
    source: str = "upload",
    source_detail: dict[str, Any] | None = None,
) -> FileResult:
    """Validate and queue one file. Never raises for user-caused problems; returns a FileResult."""
    name = _clean_name(file_name)
    try:
        info = inspect_file(data)
    except IntakeError as e:
        return FileResult(name, False, error_code=e.code, message=e.message, details=e.details)

    checksum = hashlib.sha256(data).hexdigest()
    doc_id = uuid.uuid4()
    key = storage.build_key(user_id, str(doc_id), info.ext)
    stored = False
    try:
        # Serialise per user: lock the credit account row for the whole check-and-insert.
        await credits.lock_account(session, user_id)

        existing = (
            await session.execute(
                select(Document.id, Document.status, Document.file_name).where(
                    Document.user_id == user_id, Document.checksum == checksum
                )
            )
        ).first()
        if existing:
            await session.rollback()
            return FileResult(
                name,
                False,
                error_code="DUPLICATE_DOCUMENT",
                message=ERROR_MESSAGES["DUPLICATE_DOCUMENT"],
                details={
                    "existing_document_id": str(existing.id),
                    "existing_file_name": existing.file_name,
                    "existing_status": existing.status,
                },
            )

        in_flight = await session.scalar(
            select(func.count()).select_from(Document).where(Document.user_id == user_id, Document.status.in_(IN_FLIGHT))
        )
        if (in_flight or 0) >= settings.MAX_INFLIGHT_PER_USER:
            await session.rollback()
            return FileResult(name, False, error_code="TOO_MANY_IN_FLIGHT", message=ERROR_MESSAGES["TOO_MANY_IN_FLIGHT"])

        hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        recent = await session.scalar(
            select(func.count()).select_from(Document).where(Document.user_id == user_id, Document.created_at >= hour_ago)
        )
        if (recent or 0) >= settings.UPLOADS_PER_HOUR:
            await session.rollback()
            return FileResult(name, False, error_code="RATE_LIMITED", message=ERROR_MESSAGES["RATE_LIMITED"])

        try:
            await credits.check_available(session, user_id, info.num_pages)
        except credits.InsufficientCredits as e:
            await session.rollback()
            return FileResult(
                name,
                False,
                error_code="INSUFFICIENT_CREDITS",
                message=ERROR_MESSAGES["INSUFFICIENT_CREDITS"],
                details={"current_balance": e.balance, "held": e.held, "available": e.available, "required": e.required},
            )

        await storage.put(key, data, info.mime_type)
        stored = True
        session.add(
            Document(
                id=doc_id,
                user_id=user_id,
                file_name=name,
                mime_type=info.mime_type,
                file_size=len(data),
                num_pages=info.num_pages,
                checksum=checksum,
                storage_key=key,
                source=source,
                source_detail=source_detail,
                status="queued",
            )
        )
        await session.commit()
        return FileResult(name, True, document_id=str(doc_id), status="queued", details={"num_pages": info.num_pages})
    except IntegrityError:
        # Lost a race on (user_id, checksum): treat as duplicate.
        await session.rollback()
        if stored:
            await storage.delete(key)
        row = (
            await session.execute(
                select(Document.id, Document.status, Document.file_name).where(
                    Document.user_id == user_id, Document.checksum == checksum
                )
            )
        ).first()
        return FileResult(
            name,
            False,
            error_code="DUPLICATE_DOCUMENT",
            message=ERROR_MESSAGES["DUPLICATE_DOCUMENT"],
            details={"existing_document_id": str(row.id) if row else None},
        )
    except Exception:
        await session.rollback()
        if stored:
            await storage.delete(key)
        raise
