from sqlalchemy import text

from app.config import settings
from app.db import get_sessionmaker
from app.services.worker import process_pending
from tests.helpers import make_pdf, make_png, upload_files


async def add(client, headers, user="user_a", pages=1, data=None, name="x.pdf", mime="application/pdf"):
    r = await client.post("/v1/documents", files=upload_files((name, data or make_pdf(pages), mime)), headers=headers(user))
    return r.json()["results"][0]["document_id"]


# ----------------------------------------------------------------- public ----


async def test_health_and_ready(client):
    assert (await client.get("/healthz")).json() == {"status": "ok"}
    assert (await client.get("/readyz")).json() == {"status": "ok"}


async def test_limits_are_public_and_match_config(client):
    r = await client.get("/v1/meta/limits")
    body = r.json()
    assert r.status_code == 200
    assert body["max_file_mb"] == 10 and body["max_pdf_pages"] == 10 and body["max_files_per_upload"] == 10
    assert body["signup_credits"] == 5 and body["retention_choices_days"] == [7, 30, 90]
    assert body["inbound_email_enabled"] is True and body["accepted_types"] == ["application/pdf", "image/png", "image/jpeg"]


async def test_openapi_lists_every_planned_endpoint(client):
    paths = (await client.get("/openapi.json")).json()["paths"]
    expected = {
        "/healthz": {"get"},
        "/v1/meta/limits": {"get"},
        "/v1/documents": {"get", "post"},
        "/v1/documents/{doc_id}": {"get", "patch", "delete"},
        "/v1/documents/{doc_id}/file": {"get"},
        "/v1/documents/{doc_id}/retry": {"post"},
        "/v1/documents/delete": {"post"},
        "/v1/documents/{doc_id}/export": {"get"},
        "/v1/exports": {"post"},
        "/v1/credits": {"get"},
        "/v1/credits/transactions": {"get"},
        "/v1/analytics": {"get"},
        "/v1/overview": {"get"},
        "/v1/account": {"delete"},
        "/v1/admin/analytics": {"get"},
        "/v1/settings": {"get", "patch"},
        "/v1/settings/inbound-address/regenerate": {"post"},
        "/v1/inbound/email": {"post"},
    }
    for path, methods in expected.items():
        assert methods <= set(paths[path]), path


async def test_cors_allows_only_the_frontend_origin(client):
    ok = await client.options(
        "/v1/credits", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"}
    )
    assert ok.headers["access-control-allow-origin"] == "http://localhost:3000"
    bad = await client.options("/v1/credits", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers


async def test_every_data_route_requires_a_token(client):
    for method, path in [
        ("get", "/v1/documents"),
        ("post", "/v1/documents"),
        ("get", "/v1/credits"),
        ("get", "/v1/credits/transactions"),
        ("get", "/v1/analytics"),
        ("get", "/v1/overview"),
        ("delete", "/v1/account"),
        ("get", "/v1/settings"),
        ("patch", "/v1/settings"),
        ("post", "/v1/settings/inbound-address/regenerate"),
        ("post", "/v1/exports"),
        ("post", "/v1/documents/delete"),
    ]:
        r = await getattr(client, method)(path)
        assert r.status_code == 401, (method, path)


# --------------------------------------------------------------- analytics ----


async def test_analytics_overview_credits(client, headers, fake_openai):
    await add(client, headers, pages=2, name="a.pdf")
    await add(client, headers, data=make_png(tag="0e"), mime="image/png", name="b.png")
    await process_pending()
    await add(client, headers, name="queued.pdf")  # not counted until processed
    a = (await client.get("/v1/analytics", headers=headers("user_a"))).json()
    assert a == {"total_documents_processed": 2, "total_pages_processed": 3, "total_pdfs_processed": 1, "total_images_processed": 1}

    o = (await client.get("/v1/overview", headers=headers("user_a"))).json()
    assert o["remaining_credit"] == 2 and o["credits"] == {"current_balance": 2, "held": 1, "available": 1}
    assert o["user_analytics"] == a and o["documents_total"] == 3 and len(o["user_documents"]) == 3
    assert all("file_base64" not in d and "markdown_text" not in d for d in o["user_documents"])
    assert [t["transaction_type"] for t in o["credit_history"]].count("document_processing") == 2
    assert o["credit_history"][0]["created_at"] >= o["credit_history"][-1]["created_at"]  # newest first

    assert (await client.get("/v1/analytics", headers=headers("user_b"))).json()["total_documents_processed"] == 0


async def test_transactions_paging(client, headers, fake_openai):
    for i in range(3):
        await add(client, headers, data=make_pdf(1, tag=f"{i:08x}"), name=f"{i}.pdf")
    await process_pending()
    page = (await client.get("/v1/credits/transactions?limit=2&offset=0", headers=headers("user_a"))).json()
    assert page["total"] == 4 and len(page["items"]) == 2


async def test_admin_analytics_needs_api_key(client, headers, fake_openai):
    await add(client, headers, "user_a")
    await add(client, headers, "user_b")
    await process_pending()
    assert (await client.get("/v1/admin/analytics")).status_code == 401
    assert (await client.get("/v1/admin/analytics", headers={"x-api-key": "wrong"})).status_code == 401
    assert (await client.get("/v1/admin/analytics", headers=headers("user_a"))).status_code == 401  # a user JWT is not enough
    r = await client.get("/v1/admin/analytics", headers={"x-api-key": settings.ADMIN_API_KEY})
    assert r.status_code == 200
    assert r.json() == {
        "total_documents_processed": 2,
        "total_pages_processed": 2,
        "total_pdfs_processed": 2,
        "total_images_processed": 0,
        "total_unique_users": 2,
    }


async def test_admin_disabled_when_key_unset(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_API_KEY", "")
    assert (await client.get("/v1/admin/analytics", headers={"x-api-key": ""})).status_code == 401


# ---------------------------------------------------------------- settings ----


async def test_settings_defaults_and_validation(client, headers):
    s = (await client.get("/v1/settings", headers=headers("user_a"))).json()
    assert s["retention_days"] is None and s["retention_choices_days"] == [7, 30, 90]
    assert s["inbound_enabled"] is True and s["inbound_address"].endswith("@in.test.example")
    again = (await client.get("/v1/settings", headers=headers("user_a"))).json()
    assert again["inbound_address"] == s["inbound_address"]  # stable until regenerated
    assert (await client.get("/v1/settings", headers=headers("user_b"))).json()["inbound_address"] != s["inbound_address"]

    r = await client.patch("/v1/settings", json={"retention_days": 30}, headers=headers("user_a"))
    assert r.json()["retention_days"] == 30
    r = await client.patch("/v1/settings", json={"inbound_enabled": False}, headers=headers("user_a"))
    assert r.json()["retention_days"] == 30 and r.json()["inbound_enabled"] is False  # untouched fields stay
    assert (await client.patch("/v1/settings", json={"retention_days": 45}, headers=headers("user_a"))).status_code == 422
    r = await client.patch("/v1/settings", json={"retention_days": None}, headers=headers("user_a"))
    assert r.json()["retention_days"] is None


async def test_inbound_address_absent_when_domain_not_configured(client, headers, monkeypatch):
    monkeypatch.setattr(settings, "INBOUND_EMAIL_DOMAIN", "")
    s = (await client.get("/v1/settings", headers=headers("user_a"))).json()
    assert s["inbound_address"] is None and s["inbound_available"] is False


# --------------------------------------------------------------- migration ----


async def test_migration_created_only_new_tables_and_left_others_alone():
    async with get_sessionmaker()() as s:
        tables = {r[0] for r in (await s.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'invoice_extract'"))).all()}
        assert tables == {
            "alembic_version",
            "documents",
            "user_settings",
            "inbound_emails",
            "credit_accounts",
            "credit_transactions",
            "user",  # Better Auth stand-in created by the test setup
            "user_documents",  # old n8n tables stand-ins
            "user_credit_accounts",
        }
        # the stand-ins for old / Better Auth tables are byte-for-byte what the test setup made
        assert (await s.execute(text("SELECT file_name FROM user_documents"))).scalar() == "old.pdf"
        assert (await s.execute(text("SELECT current_balance FROM user_credit_accounts"))).scalar() == 3
        cols = [r[0] for r in (await s.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'user_documents' ORDER BY ordinal_position"))).all()]
        assert cols == ["file_id", "user_id", "file_name"]
        assert (await s.execute(text("SELECT version_num FROM alembic_version"))).scalar() == "0001"
