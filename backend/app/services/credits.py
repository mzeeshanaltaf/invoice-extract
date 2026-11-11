"""Credit accounts: signup bonus, soft hold for in-flight documents, deduction, history."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import IN_FLIGHT, CreditAccount, CreditTransaction, Document


class InsufficientCredits(Exception):
    def __init__(self, balance: int, held: int, required: int) -> None:
        self.balance, self.held, self.required = balance, held, required
        super().__init__("insufficient credits")

    @property
    def available(self) -> int:
        return self.balance - self.held


async def ensure_account(session: AsyncSession, user_id: str) -> bool:
    """Create the account with the signup bonus, idempotently. Returns True if newly created."""
    stmt = (
        pg_insert(CreditAccount)
        .values(user_id=user_id, balance=settings.SIGNUP_CREDITS)
        .on_conflict_do_nothing(index_elements=[CreditAccount.user_id])
        .returning(CreditAccount.user_id)
    )
    created = (await session.execute(stmt)).first() is not None
    if created and settings.SIGNUP_CREDITS > 0:
        session.add(
            CreditTransaction(
                user_id=user_id,
                transaction_type="signup_bonus",
                credits_delta=settings.SIGNUP_CREDITS,
                description="Free credits on signup",
            )
        )
        await session.flush()
    return created


async def lock_account(session: AsyncSession, user_id: str) -> int:
    """Row-lock the account (serialises concurrent uploads) and return the balance."""
    row = (
        await session.execute(select(CreditAccount.balance).where(CreditAccount.user_id == user_id).with_for_update())
    ).first()
    if row is None:
        await ensure_account(session, user_id)
        row = (
            await session.execute(
                select(CreditAccount.balance).where(CreditAccount.user_id == user_id).with_for_update()
            )
        ).first()
    return int(row[0])


async def held_pages(session: AsyncSession, user_id: str) -> int:
    value = await session.scalar(
        select(func.coalesce(func.sum(Document.num_pages), 0)).where(
            Document.user_id == user_id, Document.status.in_(IN_FLIGHT)
        )
    )
    return int(value or 0)


async def balance_info(session: AsyncSession, user_id: str) -> dict[str, int]:
    balance = await session.scalar(select(CreditAccount.balance).where(CreditAccount.user_id == user_id)) or 0
    held = await held_pages(session, user_id)
    return {"current_balance": int(balance), "held": held, "available": int(balance) - held}


async def check_available(session: AsyncSession, user_id: str, pages: int) -> None:
    """Call with the account row locked. Raises InsufficientCredits."""
    balance = await lock_account(session, user_id)
    held = await held_pages(session, user_id)
    if balance - held < pages:
        raise InsufficientCredits(balance, held, pages)


async def deduct(session: AsyncSession, user_id: str, doc_id: uuid.UUID, pages: int, file_name: str) -> None:
    """Deduct pages and write the ledger row. Raises InsufficientCredits if the balance is short."""
    res = await session.execute(
        update(CreditAccount)
        .where(CreditAccount.user_id == user_id, CreditAccount.balance >= pages)
        .values(balance=CreditAccount.balance - pages)
        .returning(CreditAccount.balance)
    )
    if res.first() is None:
        balance = await session.scalar(select(CreditAccount.balance).where(CreditAccount.user_id == user_id)) or 0
        raise InsufficientCredits(int(balance), 0, pages)
    session.add(
        CreditTransaction(
            user_id=user_id,
            transaction_type="document_processing",
            credits_delta=-pages,
            reference_document_id=doc_id,
            file_name_snapshot=file_name,
            description=f"{pages} page{'s' if pages != 1 else ''} processed",
        )
    )


def transaction_to_dict(t: CreditTransaction) -> dict[str, Any]:
    return {
        "transaction_id": str(t.id),
        "transaction_type": t.transaction_type,
        "credits_delta": t.credits_delta,
        "reference_file_id": str(t.reference_document_id) if t.reference_document_id else None,
        "file_name_snapshot": t.file_name_snapshot,
        "description": t.description,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


async def history(session: AsyncSession, user_id: str, limit: int, offset: int) -> tuple[list[dict[str, Any]], int]:
    rows = (
        await session.scalars(
            select(CreditTransaction)
            .where(CreditTransaction.user_id == user_id)
            .order_by(CreditTransaction.created_at.desc(), CreditTransaction.id)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    total = await session.scalar(select(func.count()).select_from(CreditTransaction).where(CreditTransaction.user_id == user_id))
    return [transaction_to_dict(t) for t in rows], int(total or 0)


__all__ = [
    "InsufficientCredits",
    "ensure_account",
    "lock_account",
    "held_pages",
    "balance_info",
    "check_available",
    "deduct",
    "history",
    "transaction_to_dict",
]
