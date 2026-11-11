from __future__ import annotations

import asyncio
import uuid
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import Text, delete, func, literal, or_, select, type_coerce, update
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import User, current_user
from app.config import settings
from app.db import get_session
from app.errors import ApiError
from app.models import STATUSES, Document
from app.schemas_invoice import InvoiceData
from app.services import checks, credits, exports, intake, storage
from app.services.serialize import document_detail, document_summary
from app.services.worker import worker

router = APIRouter(prefix="/v1/documents", tags=["documents"])


async def get_owned(session: AsyncSession, user_id: str, doc_id: uuid.UUID) -> Document:
    doc = await session.scalar(select(Document).where(Document.id == doc_id, Document.user_id == user_id))
    if doc is None:
        raise ApiError(404, "NOT_FOUND", "Document not found.")
    return doc


# ------------------------------------------------------------------ upload ----


@router.post("", status_code=202)
async def upload(
    files: list[UploadFile] | None = File(None, description="One or more PDF/PNG/JPEG files"),
    file: list[UploadFile] | None = File(None, description="Alias of `files`"),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Queue 1..N files. Returns one result per file; processing continues in the background."""
    uploads = [*(files or []), *(file or [])]
    if not uploads:
        raise ApiError(400, "NO_FILES", "Attach at least one file as multipart field `files`.")
    if len(uploads) > settings.MAX_FILES_PER_UPLOAD:
        raise ApiError(400, "TOO_MANY_FILES", f"At most {settings.MAX_FILES_PER_UPLOAD} files per upload.")
    results = []
    for f in uploads:
        data = await f.read(settings.max_file_bytes + 1)  # one extra byte detects oversize without buffering it all
        await f.close()
        results.append(await intake.ingest_file(session, user.id, f.filename, data))
    worker.notify()
    accepted = sum(1 for r in results if r.success)
    return {"results": [r.to_dict() for r in results], "accepted": accepted, "rejected": len(results) - accepted}


# -------------------------------------------------------------------- list ----


def _like(q: str) -> str:
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


@router.get("")
async def list_documents(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=100, description="Search file name, seller, buyer, invoice number"),
    status: str | None = Query(None, description="Comma-separated statuses"),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    conds = [Document.user_id == user.id]
    if status:
        wanted = [s.strip() for s in status.split(",") if s.strip()]
        bad = [s for s in wanted if s not in STATUSES]
        if bad:
            raise ApiError(422, "VALIDATION_ERROR", f"Unknown status: {', '.join(bad)}")
        conds.append(Document.status.in_(wanted))
    if q and q.strip():
        pat = _like(q.strip())
        eff = type_coerce(func.coalesce(Document.edited_data, Document.invoice_data), JSONB)

        def field(*path: str):
            return eff.op("#>>")(literal(list(path), ARRAY(Text)))

        conds.append(
            or_(
                Document.file_name.ilike(pat, escape="\\"),
                field("seller", "name").ilike(pat, escape="\\"),
                field("seller", "company_name").ilike(pat, escape="\\"),
                field("buyer", "name").ilike(pat, escape="\\"),
                field("buyer", "company_name").ilike(pat, escape="\\"),
                field("invoice_metadata", "invoice_number").ilike(pat, escape="\\"),
            )
        )
    total = await session.scalar(select(func.count()).select_from(Document).where(*conds))
    rows = (
        await session.scalars(
            select(Document).where(*conds).order_by(Document.created_at.desc(), Document.id).limit(limit).offset(offset)
        )
    ).all()
    return {"items": [document_summary(d) for d in rows], "total": int(total or 0), "limit": limit, "offset": offset}


# ------------------------------------------------------------------ delete ----


async def delete_documents(session: AsyncSession, user_id: str, ids: list[uuid.UUID]) -> list[str]:
    rows = (
        await session.execute(select(Document.id, Document.storage_key).where(Document.user_id == user_id, Document.id.in_(ids)))
    ).all()
    if not rows:
        return []
    await session.execute(delete(Document).where(Document.user_id == user_id, Document.id.in_([r.id for r in rows])))
    await session.commit()
    for r in rows:
        await storage.delete(r.storage_key)  # failures are logged and retried by the sweep
    return [str(r.id) for r in rows]


class DeleteBody(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1)


@router.post("/delete")
async def delete_many(
    body: DeleteBody, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    if len(body.ids) > settings.DELETE_MAX_IDS:
        raise ApiError(422, "VALIDATION_ERROR", f"At most {settings.DELETE_MAX_IDS} ids per request.")
    deleted = await delete_documents(session, user.id, list(dict.fromkeys(body.ids)))
    return {"deleted": len(deleted), "ids": deleted}


# ------------------------------------------------------------------ detail ----


@router.get("/{doc_id}")
async def get_document(
    doc_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    return document_detail(await get_owned(session, user.id, doc_id))


@router.delete("/{doc_id}")
async def delete_one(
    doc_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    deleted = await delete_documents(session, user.id, [doc_id])
    if not deleted:
        raise ApiError(404, "NOT_FOUND", "Document not found.")
    return {"deleted": 1, "ids": deleted}


@router.get("/{doc_id}/file")
async def get_file(
    doc_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> StreamingResponse:
    """Stream the source file through the API (ownership checked; the browser never talks to storage)."""
    doc = await get_owned(session, user.id, doc_id)
    if not doc.storage_key:
        raise ApiError(410, "FILE_REMOVED", "The source file has been removed.", file_deleted_at=doc.file_deleted_at.isoformat() if doc.file_deleted_at else None)
    store = storage.get_storage()
    if not await asyncio.to_thread(store.exists, doc.storage_key):
        raise ApiError(404, "FILE_MISSING", "The source file could not be found.")
    headers = {
        "Content-Disposition": f"inline; filename*=UTF-8''{quote(doc.file_name)}",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Length": str(doc.file_size),
    }
    return StreamingResponse(store.stream(doc.storage_key), media_type=doc.mime_type, headers=headers)


# -------------------------------------------------------------------- edit ----


class EditBody(BaseModel):
    """`edited_data`: the complete corrected invoice, or null to reset to the model output."""

    edited_data: InvoiceData | None


@router.patch("/{doc_id}")
async def edit_document(
    doc_id: uuid.UUID, body: EditBody, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    if "edited_data" not in body.model_fields_set:
        raise ApiError(422, "VALIDATION_ERROR", "`edited_data` is required (send null to reset).")
    doc = await get_owned(session, user.id, doc_id)
    if doc.status != "processed":
        raise ApiError(409, "NOT_EDITABLE", "Only processed documents can be edited.")
    edited = body.edited_data.model_dump() if body.edited_data is not None else None
    doc.edited_data = edited
    doc.warnings = checks.run_checks(edited if edited is not None else doc.invoice_data)
    await session.commit()
    await session.refresh(doc)
    return document_detail(doc)


# ------------------------------------------------------------------- retry ----


@router.post("/{doc_id}/retry", status_code=202)
async def retry_document(
    doc_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    doc = await get_owned(session, user.id, doc_id)
    if doc.status != "failed":
        raise ApiError(409, "NOT_RETRYABLE", "Only failed documents can be retried.")
    if not doc.storage_key:
        raise ApiError(410, "FILE_REMOVED", "The source file has been removed. Upload it again.")
    try:
        await credits.check_available(session, user.id, doc.num_pages)
    except credits.InsufficientCredits as e:
        await session.rollback()
        raise ApiError(402, "INSUFFICIENT_CREDITS", intake.ERROR_MESSAGES["INSUFFICIENT_CREDITS"], current_balance=e.balance, held=e.held, available=e.available, required=e.required) from None
    await session.execute(
        update(Document).where(Document.id == doc.id).values(status="queued", status_detail=None, attempts=0, usage=None)
    )
    await session.commit()
    worker.notify()
    await session.refresh(doc)
    return document_summary(doc)


# ------------------------------------------------------------------ export ----


def _check_format(fmt: str) -> str:
    if fmt not in exports.FORMATS:
        raise ApiError(422, "VALIDATION_ERROR", "format must be json, csv or xlsx.")
    return fmt


def _export_response(docs: list[Document], fmt: str) -> StreamingResponse:
    out = exports.build_export(docs, fmt)
    return StreamingResponse(
        iter([out.content]),
        media_type=out.media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(out.filename)}", "Cache-Control": "private, no-store"},
    )


@router.get("/{doc_id}/export")
async def export_one(
    doc_id: uuid.UUID,
    format: str = Query("json"),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    fmt = _check_format(format)
    doc = await get_owned(session, user.id, doc_id)
    if doc.status != "processed":
        raise ApiError(409, "NOT_EXPORTABLE", "Only processed documents can be exported.")
    return _export_response([doc], fmt)
