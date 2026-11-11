"""Verify the Better Auth JWT (JWKS, cached) and expose the user id (`sub`) as a dependency."""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import Depends, Request
from jwt import PyJWKClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.errors import ApiError

log = logging.getLogger(__name__)

# Better Auth ids are 32 random alphanumerics; this also keeps ids safe inside storage keys.
USER_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,128}$")

_jwks_client: PyJWKClient | None = None
_dev_key: Any = None
_known_users: set[str] = set()


def reset_auth_state() -> None:
    """Test hook: drop cached keys and the known-user cache."""
    global _jwks_client, _dev_key
    _jwks_client = None
    _dev_key = None
    _known_users.clear()


def forget_user(user_id: str) -> None:
    _known_users.discard(user_id)


def _signing_key(token: str) -> Any:
    global _jwks_client, _dev_key
    if settings.JWT_DEV_PUBLIC_KEY_FILE:
        if settings.is_production:
            raise RuntimeError("JWT_DEV_PUBLIC_KEY_FILE must not be set in production")
        if _dev_key is None:
            with open(settings.JWT_DEV_PUBLIC_KEY_FILE, "rb") as f:
                _dev_key = f.read()
        return _dev_key
    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.jwt_jwks_url, cache_keys=True, lifespan=3600, timeout=10)
    return _jwks_client.get_signing_key_from_jwt(token).key


def _verify_sync(token: str) -> dict[str, Any]:
    key = _signing_key(token)
    return jwt.decode(
        token,
        key,
        algorithms=settings.jwt_algorithms,
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
        leeway=settings.JWT_LEEWAY_SECONDS,
        options={"require": ["exp", "sub", "iss", "aud"]},
    )


async def verify_token(token: str) -> str:
    """Return the user id for a valid token, or raise ApiError(401)."""
    try:
        claims = await asyncio.to_thread(_verify_sync, token)
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "TOKEN_EXPIRED", "The session token has expired.") from None
    except (jwt.PyJWTError, OSError) as e:
        log.info("jwt rejected: %s", type(e).__name__)
        raise ApiError(401, "INVALID_TOKEN", "Invalid authentication token.") from None
    sub = claims.get("sub")
    if not isinstance(sub, str) or not USER_ID_RE.match(sub):
        raise ApiError(401, "INVALID_TOKEN", "Invalid authentication token.")
    return sub


@dataclass
class User:
    id: str


async def current_user(request: Request, session: AsyncSession = Depends(get_session)) -> User:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise ApiError(401, "UNAUTHORIZED", "Missing bearer token.")
    user_id = await verify_token(token.strip())
    if user_id not in _known_users:
        from app.services import credits

        await credits.ensure_account(session, user_id)
        await session.commit()
        _known_users.add(user_id)
    return User(id=user_id)
