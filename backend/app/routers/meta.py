from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.db import get_sessionmaker
from app.errors import ApiError

router = APIRouter(tags=["meta"])


@router.get("/healthz")
async def healthz() -> dict:
    """Liveness: does not touch the database."""
    return {"status": "ok"}


@router.get("/readyz")
async def readyz() -> dict:
    """Readiness: checks the database."""
    try:
        async with get_sessionmaker()() as s:
            await s.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        raise ApiError(503, "DB_UNAVAILABLE", "Database is not reachable.") from None
    return {"status": "ok"}


@router.get("/v1/meta/limits")
async def limits() -> dict:
    return {
        "max_file_mb": settings.MAX_FILE_MB,
        "max_pdf_pages": settings.MAX_PDF_PAGES,
        "max_files_per_upload": settings.MAX_FILES_PER_UPLOAD,
        "max_inflight_per_user": settings.MAX_INFLIGHT_PER_USER,
        "uploads_per_hour": settings.UPLOADS_PER_HOUR,
        "accepted_types": ["application/pdf", "image/png", "image/jpeg"],
        "credits_per_page": 1,
        "signup_credits": settings.SIGNUP_CREDITS,
        "retention_choices_days": settings.retention_choices,
        "inbound_email_enabled": bool(settings.INBOUND_EMAIL_DOMAIN),
        "inbound_email_domain": settings.INBOUND_EMAIL_DOMAIN or None,
        "inbound_max_attachments": settings.INBOUND_MAX_ATTACHMENTS,
        "export_formats": ["json", "csv", "xlsx"],
    }
