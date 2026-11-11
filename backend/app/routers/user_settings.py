from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import User, current_user
from app.config import settings
from app.db import get_session
from app.errors import ApiError
from app.models import UserSettings
from app.services.inbound import inbound_address, new_token

router = APIRouter(prefix="/v1/settings", tags=["settings"])


async def get_or_create(session: AsyncSession, user_id: str) -> UserSettings:
    await session.execute(
        pg_insert(UserSettings)
        .values(user_id=user_id, inbound_token=new_token(), inbound_enabled=True)
        .on_conflict_do_nothing(index_elements=[UserSettings.user_id])
    )
    await session.commit()
    return await session.get(UserSettings, user_id, populate_existing=True)  # type: ignore[return-value]


def to_dict(s: UserSettings) -> dict[str, Any]:
    return {
        "retention_days": s.retention_days,
        "retention_choices_days": settings.retention_choices,
        "inbound_enabled": s.inbound_enabled,
        "inbound_address": inbound_address(s.inbound_token),
        "inbound_available": bool(settings.INBOUND_EMAIL_DOMAIN),
    }


@router.get("")
async def get_settings(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> dict:
    return to_dict(await get_or_create(session, user.id))


class SettingsPatch(BaseModel):
    retention_days: int | None = None  # null = keep source files
    inbound_enabled: bool | None = None


@router.patch("")
async def patch_settings(
    body: SettingsPatch, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict:
    s = await get_or_create(session, user.id)
    changes: dict[str, Any] = {}
    if "retention_days" in body.model_fields_set:
        if body.retention_days is not None and body.retention_days not in settings.retention_choices:
            raise ApiError(422, "VALIDATION_ERROR", f"retention_days must be null or one of {settings.retention_choices}.")
        changes["retention_days"] = body.retention_days
    if "inbound_enabled" in body.model_fields_set and body.inbound_enabled is not None:
        changes["inbound_enabled"] = body.inbound_enabled
    if changes:
        await session.execute(update(UserSettings).where(UserSettings.user_id == user.id).values(**changes))
        await session.commit()
        s = await session.get(UserSettings, user.id, populate_existing=True)  # type: ignore[assignment]
    return to_dict(s)


@router.post("/inbound-address/regenerate")
async def regenerate_address(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> dict:
    """Rotate the personal email-in address. The old address stops working immediately."""
    await get_or_create(session, user.id)
    await session.execute(
        update(UserSettings).where(UserSettings.user_id == user.id).values(inbound_token=new_token(), inbound_enabled=True)
    )
    await session.commit()
    return to_dict(await session.get(UserSettings, user.id, populate_existing=True))  # type: ignore[arg-type]
