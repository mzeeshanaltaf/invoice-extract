"""Postgres-backed job loop (in-process asyncio). Claims rows with FOR UPDATE SKIP LOCKED."""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update

from app.config import settings
from app.db import get_sessionmaker
from app.models import Document
from app.services import checks, credits, storage
from app.services.extraction import ExtractionError, extract
from app.services.gate import GateError, run_gate
from app.services.rendering import render

log = logging.getLogger(__name__)

FAIL_MESSAGE = "We couldn't process this document right now. No credits were used; you can retry it."


async def requeue_in_flight() -> int:
    """Rows left mid-flight by a restart go back to the queue (or fail after too many attempts)."""
    async with get_sessionmaker()() as s:
        await s.execute(
            update(Document)
            .where(Document.status.in_(("validating", "extracting")), Document.attempts >= settings.MAX_ATTEMPTS)
            .values(status="failed", status_detail=FAIL_MESSAGE)
        )
        res = await s.execute(
            update(Document).where(Document.status.in_(("validating", "extracting"))).values(status="queued")
        )
        await s.commit()
        return res.rowcount or 0


async def claim_one() -> tuple[uuid.UUID, int] | None:
    async with get_sessionmaker()() as s:
        sub = (
            select(Document.id)
            .where(Document.status == "queued")
            .order_by(Document.created_at)
            .limit(1)
            .with_for_update(skip_locked=True)
            .scalar_subquery()
        )
        row = (
            await s.execute(
                update(Document)
                .where(Document.id == sub)
                .values(status="validating", attempts=Document.attempts + 1)
                .returning(Document.id, Document.attempts)
            )
        ).first()
        await s.commit()
        return (row[0], row[1]) if row else None


async def _guarded(doc_id: uuid.UUID, attempt: int, expected: tuple[str, ...], **values: Any) -> bool:
    """Update only if this job still owns the row (not deleted, not re-claimed by a restart)."""
    async with get_sessionmaker()() as s:
        res = await s.execute(
            update(Document)
            .where(Document.id == doc_id, Document.attempts == attempt, Document.status.in_(expected))
            .values(**values)
        )
        await s.commit()
        return (res.rowcount or 0) > 0


async def _notify_finished(doc_id: uuid.UUID) -> None:
    try:
        from app.services import inbound

        await inbound.on_document_finished(doc_id)
    except Exception:  # noqa: BLE001
        log.exception("inbound summary failed for %s", doc_id)


async def _fail(doc_id: uuid.UUID, attempt: int, detail: str, message: str = FAIL_MESSAGE) -> None:
    if await _guarded(
        doc_id, attempt, ("validating", "extracting"), status="failed", status_detail=message, usage={"error": detail[:500]}
    ):
        await _notify_finished(doc_id)


async def process_document(doc_id: uuid.UUID, attempt: int) -> None:
    async with get_sessionmaker()() as s:
        doc = await s.get(Document, doc_id)
        if doc is None or doc.status != "validating" or doc.attempts != attempt:
            return
        key, mime, user_id, pages, file_name = doc.storage_key, doc.mime_type, doc.user_id, doc.num_pages, doc.file_name
    try:
        if not key:
            await _fail(doc_id, attempt, "source file missing", "The source file is no longer available. Upload it again.")
            return
        data = await storage.get(key)
        rendered = await asyncio.to_thread(render, data, mime)

        gate = await run_gate(rendered.pages)
        if not gate.accepted:
            if await _guarded(
                doc_id,
                attempt,
                ("validating",),
                status="rejected",
                status_detail=gate.reason,
                gate=gate.as_json(),
                storage_key=None,
                file_deleted_at=datetime.now(timezone.utc),
                usage={"gate": gate.usage},
            ):
                await storage.delete(key)  # a failed delete is retried by the orphan sweep
                await _notify_finished(doc_id)
            return

        if not await _guarded(doc_id, attempt, ("validating",), status="extracting", gate=gate.as_json()):
            return

        outcome = await extract(rendered.pages, rendered.text_hint)
        invoice_data = outcome.result.invoice_data.model_dump()
        warnings = checks.run_checks(invoice_data)
        usage = {**outcome.usage, "gate": gate.usage}

        # One transaction: mark processed, deduct credits, write the ledger row.
        async with get_sessionmaker()() as s:
            try:
                res = await s.execute(
                    update(Document)
                    .where(Document.id == doc_id, Document.attempts == attempt, Document.status == "extracting")
                    .values(
                        status="processed",
                        status_detail=None,
                        markdown_text=outcome.result.markdown_text,
                        invoice_data=invoice_data,
                        extraction_meta={
                            "confidence": outcome.result.confidence,
                            "description": outcome.result.description,
                            "detected_signals": outcome.result.detected_signals,
                        },
                        warnings=warnings,
                        usage=usage,
                        processed_at=datetime.now(timezone.utc),
                    )
                )
                if (res.rowcount or 0) == 0:
                    await s.rollback()
                    return  # deleted or superseded while we worked: no charge
                await credits.deduct(s, user_id, doc_id, pages, file_name)
                await s.commit()
            except credits.InsufficientCredits:
                await s.rollback()
                await _fail(doc_id, attempt, "insufficient credits at charge time", "Not enough credits to complete processing. Top up and retry; nothing was charged.")
                return
        await _notify_finished(doc_id)
    except GateError as e:
        await _fail(doc_id, attempt, f"gate: {e}")
    except ExtractionError as e:
        await _fail(doc_id, attempt, f"extraction: {e}")
    except Exception as e:  # noqa: BLE001
        log.exception("processing %s crashed", doc_id)
        await _fail(doc_id, attempt, f"{type(e).__name__}: {e}")


async def process_pending() -> int:
    """Claim and process queued documents one at a time until the queue is empty (tests, scripts)."""
    n = 0
    while (claimed := await claim_one()) is not None:
        await process_document(*claimed)
        n += 1
    return n


class Worker:
    def __init__(self) -> None:
        self._wake = asyncio.Event()
        self._stop = False
        self._tasks: set[asyncio.Task] = set()
        self._main: asyncio.Task | None = None
        self._sweeper: asyncio.Task | None = None

    def notify(self) -> None:
        self._wake.set()

    async def start(self) -> None:
        n = await requeue_in_flight()
        if n:
            log.info("re-queued %s documents left mid-flight", n)
        self._main = asyncio.create_task(self._loop(), name="worker-loop")
        self._sweeper = asyncio.create_task(self._sweep_loop(), name="retention-sweep")

    async def stop(self) -> None:
        self._stop = True
        self._wake.set()
        for t in [self._main, self._sweeper, *self._tasks]:
            if t:
                t.cancel()
        await asyncio.gather(*[t for t in [self._main, self._sweeper, *self._tasks] if t], return_exceptions=True)

    async def _run(self, claimed: tuple[uuid.UUID, int], sem: asyncio.Semaphore) -> None:
        try:
            await process_document(*claimed)
        finally:
            sem.release()
            self._wake.set()

    async def _loop(self) -> None:
        sem = asyncio.Semaphore(settings.WORKER_CONCURRENCY)
        while not self._stop:
            await sem.acquire()
            try:
                claimed = await claim_one()
            except Exception:  # noqa: BLE001
                log.exception("claim failed")
                claimed = None
            if claimed is None:
                sem.release()
                try:
                    await asyncio.wait_for(self._wake.wait(), timeout=settings.WORKER_POLL_SECONDS)
                except asyncio.TimeoutError:
                    pass
                self._wake.clear()
                continue
            task = asyncio.create_task(self._run(claimed, sem))
            self._tasks.add(task)
            task.add_done_callback(self._tasks.discard)

    async def _sweep_loop(self) -> None:
        from app.services import retention

        await asyncio.sleep(30)
        while not self._stop:
            try:
                await retention.run_sweep()
            except Exception:  # noqa: BLE001
                log.exception("retention sweep failed")
            await asyncio.sleep(max(1, settings.RETENTION_SWEEP_MINUTES) * 60)


worker = Worker()
