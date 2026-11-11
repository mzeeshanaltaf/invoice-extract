from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import auth
from app.auth import User, current_user
from app.db import get_session
from app.models import CreditAccount, Document, InboundEmail, UserSettings
from app.services import storage

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/account", tags=["account"])


@router.delete("")
async def delete_account(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> dict:
    """Remove every trace of the user's data: documents, credits (and ledger), settings, stored files.

    Deleting the Better Auth user itself stays the front end's job.
    """
    count = await session.scalar(select(func.count()).select_from(Document).where(Document.user_id == user.id)) or 0
    await session.execute(delete(Document).where(Document.user_id == user.id))
    await session.execute(delete(CreditAccount).where(CreditAccount.user_id == user.id))  # ledger cascades
    await session.execute(delete(UserSettings).where(UserSettings.user_id == user.id))
    await session.execute(delete(InboundEmail).where(InboundEmail.user_id == user.id))
    await session.commit()
    auth.forget_user(user.id)
    try:
        await storage.delete_prefix(f"{user.id}/")
    except Exception:  # noqa: BLE001
        log.exception("account purge: object delete failed for %s; the orphan sweep will retry", user.id)
    return {"deleted": True, "documents_deleted": int(count)}
