from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import User, current_user
from app.db import get_session
from app.services import credits

router = APIRouter(prefix="/v1/credits", tags=["credits"])


@router.get("")
async def get_credits(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> dict:
    """`current_balance` is what the account holds; `held` is reserved by documents still processing."""
    return await credits.balance_info(session, user.id)


@router.get("/transactions")
async def transactions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    items, total = await credits.history(session, user.id, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}
