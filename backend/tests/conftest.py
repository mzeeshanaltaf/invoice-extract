"""Shared fixtures. Needs a local Postgres (see backend/README.md); default port 5434.

Test settings are applied through the environment BEFORE the app is imported.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import time
from pathlib import Path

import asyncpg
import jwt
import pytest
import pytest_asyncio
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

BACKEND = Path(__file__).resolve().parent.parent
PG_ADMIN = os.environ.get("TEST_PG_ADMIN_URL", "postgresql://postgres:devpass@127.0.0.1:5434/postgres")
TEST_DB = "invoicextract_test"
TEST_URL = PG_ADMIN.rsplit("/", 1)[0] + f"/{TEST_DB}"

os.environ.update(
    {
        "DATABASE_URL": TEST_URL,
        "ENVIRONMENT": "test",
        "WORKER_ENABLED": "false",
        "OPENAI_API_KEY": "sk-test-not-real",
        "BETTER_AUTH_URL": "http://auth.test",
        "OPENAI_BACKOFF_BASE_SECONDS": "0",
        "STORAGE_DRIVER": "local",
        "INBOUND_EMAIL_DOMAIN": "in.test.example",
        "RESEND_WEBHOOK_SECRET": "whsec_" + "dGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQ=",
        "RESEND_API_KEY": "re_test",
        "RESEND_FROM_EMAIL": "InvoicExtract <noreply@test.example>",
        "ADMIN_API_KEY": "admin-test-key",
        "ALLOWED_ORIGINS": "http://localhost:3000",
        "JWT_DEV_PUBLIC_KEY_FILE": "",
    }
)

OLD_AND_BETTER_AUTH_DDL = """
DROP SCHEMA IF EXISTS invoice_extract CASCADE;
CREATE SCHEMA invoice_extract;
-- stand-ins for tables the backend must never touch
CREATE TABLE invoice_extract."user" (id text primary key, email text, name text);
CREATE TABLE invoice_extract.user_documents (file_id uuid primary key default gen_random_uuid(), user_id text, file_name text);
CREATE TABLE invoice_extract.user_credit_accounts (user_id text primary key, current_balance int);
INSERT INTO invoice_extract.user_documents (user_id, file_name) VALUES ('legacy', 'old.pdf');
INSERT INTO invoice_extract.user_credit_accounts VALUES ('legacy', 3);
"""


def _prepare_database() -> None:
    async def go() -> None:
        conn = await asyncpg.connect(PG_ADMIN)
        try:
            if not await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", TEST_DB):
                await conn.execute(f'CREATE DATABASE "{TEST_DB}"')
        finally:
            await conn.close()
        conn = await asyncpg.connect(TEST_URL)
        try:
            await conn.execute(OLD_AND_BETTER_AUTH_DDL)
        finally:
            await conn.close()

    asyncio.run(go())
    # A real `alembic upgrade head` on the clean schema is part of what this suite verifies.
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND, check=True, env=os.environ.copy())


_prepare_database()

from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import auth  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import dispose_engine, get_engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services import extraction, gate, storage  # noqa: E402
from tests.helpers import FakeOpenAI  # noqa: E402

TABLES = "credit_transactions, documents, credit_accounts, user_settings, inbound_emails"


@pytest.fixture(scope="session")
def keypair(tmp_path_factory):
    private = Ed25519PrivateKey.generate()
    other = Ed25519PrivateKey.generate()
    pub_pem = private.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    path = tmp_path_factory.mktemp("keys") / "dev_public.pem"
    path.write_bytes(pub_pem)
    return {"private": private, "other": other, "public_path": path}


@pytest_asyncio.fixture(autouse=True)
async def _isolate(keypair, tmp_path, monkeypatch):
    """Clean tables, fresh object store, dev JWT key, no accidental real OpenAI calls."""
    async with get_engine().begin() as conn:
        await conn.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))
        await conn.execute(text('DELETE FROM "user"'))  # Better Auth stand-in, owned by the tests only
    auth.reset_auth_state()
    monkeypatch.setattr(settings, "JWT_DEV_PUBLIC_KEY_FILE", str(keypair["public_path"]))
    store = storage.LocalStorage(str(tmp_path / "objects"))
    storage.set_storage(store)
    fake = FakeOpenAI()
    monkeypatch.setattr(gate, "get_client", lambda: fake)
    monkeypatch.setattr(extraction, "get_client", lambda: fake)
    yield
    storage.set_storage(None)


@pytest.fixture
def fake_openai(monkeypatch) -> FakeOpenAI:
    # same instance the autouse fixture installed: re-fetch through the patched attribute
    return gate.get_client()  # type: ignore[return-value]


@pytest.fixture
def store() -> storage.LocalStorage:
    return storage.get_storage()  # type: ignore[return-value]


def mint(private_key, sub: str = "user_a", *, exp_in: int = 900, iss: str | None = None, aud: str | None = None, **extra) -> str:
    now = int(time.time())
    claims = {
        "sub": sub,
        "iss": iss or settings.jwt_issuer,
        "aud": aud or settings.jwt_audience,
        "iat": now,
        "exp": now + exp_in,
        **extra,
    }
    return jwt.encode(claims, private_key, algorithm="EdDSA", headers={"kid": "test-key"})


@pytest.fixture
def headers(keypair):
    def make(user: str = "user_a") -> dict[str, str]:
        return {"Authorization": f"Bearer {mint(keypair['private'], user)}"}

    return make


@pytest_asyncio.fixture
async def client():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _dispose_at_end():
    yield
    await dispose_engine()
