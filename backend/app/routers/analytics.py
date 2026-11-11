from __future__ import annotations

import hmac
from typing import Any

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import User, current_user
from app.config import settings
from app.db import get_session
from app.errors import ApiError
from app.models import Document
from app.services import credits
from app.services.serialize import document_summary

router = APIRouter(tags=["analytics"])


def _agg_columns():
    processed = Document.status == "processed"
    return [
        func.count().filter(processed).label("total_documents_processed"),
        func.coalesce(func.sum(Document.num_pages).filter(processed), 0).label("total_pages_processed"),
        func.count().filter(processed, Document.mime_type == "application/pdf").label("total_pdfs_processed"),
        func.count().filter(processed, Document.mime_type.like("image/%")).label("total_images_processed"),
    ]


async def user_analytics(session: AsyncSession, user_id: str) -> dict[str, int]:
    row = (await session.execute(select(*_agg_columns()).where(Document.user_id == user_id))).one()
    return {k: int(v or 0) for k, v in row._mapping.items()}


@router.get("/v1/analytics")
async def analytics(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> dict[str, int]:
    return await user_analytics(session, user.id)


@router.get("/v1/overview")
async def overview(
    documents_limit: int = Query(50, ge=1, le=200),
    history_limit: int = Query(50, ge=1, le=200),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Everything the dashboard needs in one call. No file payloads."""
    bal = await credits.balance_info(session, user.id)
    history, _ = await credits.history(session, user.id, history_limit, 0)
    docs = (
        await session.scalars(
            select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc(), Document.id).limit(documents_limit)
        )
    ).all()
    total = await session.scalar(select(func.count()).select_from(Document).where(Document.user_id == user.id))
    return {
        "remaining_credit": bal["current_balance"],
        "credits": bal,
        "credit_history": history,
        "user_analytics": await user_analytics(session, user.id),
        "user_documents": [document_summary(d) for d in docs],
        "documents_total": int(total or 0),
    }


@router.get("/v1/admin/analytics", tags=["admin"])
async def admin_analytics(
    x_api_key: str | None = Header(None), session: AsyncSession = Depends(get_session)
) -> dict[str, int]:
    expected = settings.ADMIN_API_KEY
    if not expected or not x_api_key or not hmac.compare_digest(x_api_key.encode(), expected.encode()):
        raise ApiError(401, "UNAUTHORIZED", "Invalid API key.")
    row = (await session.execute(select(*_agg_columns(), func.count(func.distinct(Document.user_id)).label("total_unique_users")))).one()
    return {k: int(v or 0) for k, v in row._mapping.items()}
