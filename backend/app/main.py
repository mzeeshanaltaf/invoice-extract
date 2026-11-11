"""App factory. Run: uvicorn app.main:app --port 8000"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import dispose_engine
from app.errors import install_handlers
from app.middleware import BodyLimitMiddleware
from app.routers import account, analytics, credits, documents, exports, inbound, meta, user_settings

log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if settings.is_production and settings.JWT_DEV_PUBLIC_KEY_FILE:
        raise RuntimeError("JWT_DEV_PUBLIC_KEY_FILE is a test-only shortcut and must not be set in production")
    from app.services import storage
    from app.services.worker import worker

    await asyncio.to_thread(storage.get_storage)  # fail fast on bad storage config; creates the S3 bucket
    if settings.WORKER_ENABLED:
        await worker.start()
    try:
        yield
    finally:
        if settings.WORKER_ENABLED:
            await worker.stop()
        await dispose_engine()


def create_app() -> FastAPI:
    app = FastAPI(title="InvoicExtract API", version="1.0.0", lifespan=lifespan)
    install_handlers(app)
    app.add_middleware(BodyLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Content-Disposition"],
        max_age=600,
    )
    for r in (meta, documents, exports, credits, analytics, account, user_settings, inbound):
        app.include_router(r.router)
    return app


app = create_app()
