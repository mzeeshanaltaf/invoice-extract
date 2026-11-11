from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.services import inbound

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/inbound", tags=["inbound"])


@router.post("/email")
async def inbound_email(request: Request, session: AsyncSession = Depends(get_session)) -> dict:
    """Resend `email.received` webhook (Svix-signed, no JWT)."""
    payload = await request.body()
    event = inbound.verify_webhook(payload, dict(request.headers))
    if not isinstance(event, dict):
        event = json.loads(payload)
    if event.get("type") != "email.received":
        return {"status": "ignored"}
    return await inbound.handle_email_received(session, event.get("data") or {})
