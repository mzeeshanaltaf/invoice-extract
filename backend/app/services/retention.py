"""Periodic sweep: expire source files per user setting, and retry orphaned object deletions."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, literal_column, select, update

from app.config import settings
from app.db import get_sessionmaker
from app.models import Document, UserSettings
from app.services import storage

log = logging.getLogger(__name__)

BATCH = 500


async def expire_files() -> int:
    """Delete the source object for documents older than the user's retention window."""
    removed = 0
    sm = get_sessionmaker()
    async with sm() as s:
        rows = (
            await s.execute(
                select(Document.id, Document.storage_key)
                .join(UserSettings, UserSettings.user_id == Document.user_id)
                .where(
                    Document.storage_key.is_not(None),
                    UserSettings.retention_days.is_not(None),
                    Document.status.in_(("processed", "failed")),
                    func.coalesce(Document.processed_at, Document.updated_at)
                    < func.now() - UserSettings.retention_days * literal_column("interval '1 day'"),
                )
                .limit(BATCH)
            )
        ).all()
    for doc_id, key in rows:
        if await storage.delete(key):
            async with sm() as s:
                await s.execute(
                    update(Document)
                    .where(Document.id == doc_id)
                    .values(storage_key=None, file_deleted_at=datetime.now(timezone.utc))
                )
                await s.commit()
            removed += 1
    return removed


def _doc_id_from_key(key: str) -> UUID | None:
    parts = key.split("/")
    if len(parts) != 3:
        return None
    try:
        return UUID(parts[1])
    except ValueError:
        return None


async def remove_orphans() -> int:
    """Delete stored objects that no document row points at (failed deletes, crashed uploads)."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.ORPHAN_MIN_AGE_MINUTES)
    objects = await asyncio.to_thread(lambda: [o for o in storage.get_storage().list_objects() if o.last_modified < cutoff])
    if not objects:
        return 0
    removed = 0
    async with get_sessionmaker()() as s:
        for i in range(0, len(objects), BATCH):
            chunk = objects[i : i + BATCH]
            ids = [d for o in chunk if (d := _doc_id_from_key(o.key))]
            live = set()
            if ids:
                live = {
                    row.storage_key
                    for row in (await s.execute(select(Document.storage_key).where(Document.id.in_(ids)))).all()
                }
            for o in chunk:
                if o.key not in live and await storage.delete(o.key):
                    removed += 1
    return removed


async def run_sweep() -> dict[str, int]:
    expired = await expire_files()
    orphans = await remove_orphans()
    if expired or orphans:
        log.info("retention sweep: %s expired, %s orphans removed", expired, orphans)
    return {"expired": expired, "orphans_removed": orphans}
