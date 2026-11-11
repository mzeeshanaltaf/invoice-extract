from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import User, current_user
from app.config import settings
from app.db import get_session
from app.errors import ApiError
from app.models import Document
from app.routers.documents import _check_format, _export_response

router = APIRouter(prefix="/v1/exports", tags=["exports"])


class ExportBody(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1)
    format: str = "xlsx"


@router.post("")
async def export_many(body: ExportBody, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Export several documents into one file. Unprocessed or unknown ids are skipped."""
    fmt = _check_format(body.format)
    ids = list(dict.fromkeys(body.ids))
    if len(ids) > settings.EXPORT_MAX_DOCS:
        raise ApiError(422, "VALIDATION_ERROR", f"At most {settings.EXPORT_MAX_DOCS} documents per export.")
    docs = (
        await session.scalars(
            select(Document)
            .where(Document.user_id == user.id, Document.id.in_(ids), Document.status == "processed")
            .order_by(Document.created_at)
        )
    ).all()
    if not docs:
        raise ApiError(409, "NOT_EXPORTABLE", "None of the selected documents are processed.")
    return _export_response(list(docs), fmt)
