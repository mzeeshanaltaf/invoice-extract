"""Async engine pinned to the invoice_extract schema."""

from __future__ import annotations

from collections.abc import AsyncIterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _clean_url(url: str) -> tuple[str, dict]:
    """asyncpg rejects libpq-style query args such as sslmode; translate them."""
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    connect_args: dict = {}
    sslmode = query.pop("sslmode", None)
    if sslmode in ("require", "verify-ca", "verify-full"):
        connect_args["ssl"] = True
    query.pop("schema", None)
    cleaned = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return cleaned, connect_args


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        url, connect_args = _clean_url(settings.DATABASE_URL)
        connect_args["server_settings"] = {"search_path": settings.DB_SCHEMA}
        _engine = create_async_engine(url, pool_size=10, max_overflow=10, pool_pre_ping=True, connect_args=connect_args)
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _sessionmaker = None
