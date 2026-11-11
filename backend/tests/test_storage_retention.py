import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update

from app.config import settings
from app.db import get_sessionmaker
from app.models import Document
from app.services import retention, storage
from app.services.worker import process_pending
from tests.helpers import NON_INVOICE_COLOR, make_pdf, make_png, upload_files


async def add(client, headers, user="user_a", data=None, name=None, mime="application/pdf"):
    r = await client.post("/v1/documents", files=upload_files((name or f"{uuid.uuid4().hex[:6]}.pdf", data or make_pdf(1), mime)), headers=headers(user))
    return r.json()["results"][0]["document_id"]


def keys(store):
    return sorted(o.key for o in store.list_objects())


# ---------------------------------------------------------------- lifecycle ----


async def test_object_written_on_intake_under_user_and_document_prefix(client, headers, store):
    doc = await add(client, headers)
    assert keys(store) == [f"user_a/{doc}/original.pdf"]
    async with get_sessionmaker()() as s:
        row = await s.get(Document, uuid.UUID(doc))
        assert row.storage_key == f"user_a/{doc}/original.pdf"


async def test_object_removed_on_delete(client, headers, store):
    doc = await add(client, headers)
    await client.delete(f"/v1/documents/{doc}", headers=headers("user_a"))
    assert keys(store) == []


async def test_object_removed_when_rejected_as_non_invoice(client, headers, store, fake_openai):
    await add(client, headers, data=make_png(color=NON_INVOICE_COLOR), mime="image/png", name="x.png")
    await process_pending()
    assert keys(store) == []


async def test_account_purge_removes_everything_for_that_user_only(client, headers, store, fake_openai):
    for _ in range(2):
        await add(client, headers, "user_a")
    theirs = await add(client, headers, "user_b")
    await process_pending()
    r = await client.patch("/v1/settings", json={"retention_days": 30}, headers=headers("user_a"))
    assert r.status_code == 200
    r = await client.delete("/v1/account", headers=headers("user_a"))
    assert r.status_code == 200 and r.json() == {"deleted": True, "documents_deleted": 2}
    assert keys(store) == [f"user_b/{theirs}/original.pdf"]
    # data is gone: a fresh request starts a brand-new account (signup bonus again, no documents)
    assert (await client.get("/v1/documents", headers=headers("user_a"))).json()["total"] == 0
    assert (await client.get("/v1/credits", headers=headers("user_a"))).json()["current_balance"] == 5
    assert (await client.get("/v1/settings", headers=headers("user_a"))).json()["retention_days"] is None
    assert (await client.get(f"/v1/documents/{theirs}", headers=headers("user_b"))).status_code == 200


async def test_account_purge_deletes_ledger_with_account(client, headers):
    await client.get("/v1/credits", headers=headers("user_a"))
    await client.delete("/v1/account", headers=headers("user_a"))
    # the old n8n bug deleted the accounts table twice and never the transactions; make sure none survive
    from sqlalchemy import text

    async with get_sessionmaker()() as s:
        left = (await s.execute(text("SELECT count(*) FROM credit_transactions WHERE user_id = 'user_a' AND transaction_type <> 'signup_bonus'"))).scalar()
        assert left == 0


async def test_failed_object_delete_is_retried_by_the_orphan_sweep(client, headers, store, monkeypatch):
    doc = await add(client, headers)
    real_delete = store.delete
    calls = {"n": 0}

    def flaky(key):
        calls["n"] += 1
        raise OSError("storage down")

    monkeypatch.setattr(store, "delete", flaky)
    r = await client.delete(f"/v1/documents/{doc}", headers=headers("user_a"))
    assert r.status_code == 200  # the user's delete still succeeds
    assert len(keys(store)) == 1  # object lingers...
    monkeypatch.setattr(store, "delete", real_delete)
    monkeypatch.setattr(settings, "ORPHAN_MIN_AGE_MINUTES", 0)
    await retention.run_sweep()
    assert keys(store) == []  # ...until the sweep removes it


async def test_orphan_sweep_spares_young_objects_and_live_documents(client, headers, store, monkeypatch):
    live = await add(client, headers)
    store.put(f"user_a/{uuid.uuid4()}/original.pdf", b"x", "application/pdf")  # no row points at it
    assert (await retention.run_sweep())["orphans_removed"] == 0  # too young: might be an in-flight upload
    monkeypatch.setattr(settings, "ORPHAN_MIN_AGE_MINUTES", 0)
    assert (await retention.run_sweep())["orphans_removed"] == 1
    assert keys(store) == [f"user_a/{live}/original.pdf"]


# ---------------------------------------------------------------- retention ----


async def backdate(doc_id, days):
    async with get_sessionmaker()() as s:
        ts = datetime.now(timezone.utc) - timedelta(days=days)
        await s.execute(update(Document).where(Document.id == uuid.UUID(doc_id)).values(processed_at=ts))
        await s.commit()


async def test_sweep_removes_only_the_file_and_leaves_the_data(client, headers, store, fake_openai):
    old, fresh = await add(client, headers), await add(client, headers)
    await process_pending()
    await client.patch("/v1/settings", json={"retention_days": 7}, headers=headers("user_a"))
    await backdate(old, 10)
    await backdate(fresh, 2)

    assert (await retention.run_sweep())["expired"] == 1
    d = (await client.get(f"/v1/documents/{old}", headers=headers("user_a"))).json()
    assert d["file_available"] is False and d["file_deleted_at"] is not None
    assert d["status"] == "processed" and d["invoice_data"]["invoice_metadata"]["invoice_number"] == "INV-2026-0042"
    assert d["markdown_text"]
    assert (await client.get(f"/v1/documents/{old}/export?format=json", headers=headers("user_a"))).status_code == 200  # exports stay
    r = await client.get(f"/v1/documents/{old}/file", headers=headers("user_a"))
    assert r.status_code == 410 and r.json()["error"]["code"] == "FILE_REMOVED"
    assert keys(store) == [f"user_a/{fresh}/original.pdf"]  # the young document keeps its file


async def test_default_keeps_files_forever(client, headers, store, fake_openai):
    doc = await add(client, headers)
    await process_pending()
    await backdate(doc, 400)
    assert (await retention.run_sweep())["expired"] == 0
    assert len(keys(store)) == 1


async def test_changing_setting_applies_to_existing_documents_on_next_sweep(client, headers, store, fake_openai):
    doc = await add(client, headers)
    await process_pending()
    await backdate(doc, 40)
    assert (await retention.run_sweep())["expired"] == 0
    await client.patch("/v1/settings", json={"retention_days": 30}, headers=headers("user_a"))
    assert (await retention.run_sweep())["expired"] == 1
    await client.patch("/v1/settings", json={"retention_days": None}, headers=headers("user_a"))  # back to forever: nothing more to do
    assert (await retention.run_sweep())["expired"] == 0


async def test_retention_is_per_user(client, headers, store, fake_openai):
    a, b = await add(client, headers, "user_a"), await add(client, headers, "user_b")
    await process_pending()
    await client.patch("/v1/settings", json={"retention_days": 7}, headers=headers("user_a"))
    await client.get("/v1/settings", headers=headers("user_b"))
    await backdate(a, 30)
    await backdate(b, 30)
    await retention.run_sweep()
    assert keys(store) == [f"user_b/{b}/original.pdf"]


async def test_reupload_after_removal_reports_duplicate_and_links_to_it(client, headers, store, fake_openai):
    pdf = make_pdf(1)
    doc = await add(client, headers, data=pdf)
    await process_pending()
    await client.patch("/v1/settings", json={"retention_days": 7}, headers=headers("user_a"))
    await backdate(doc, 9)
    await retention.run_sweep()
    again = (await client.post("/v1/documents", files=upload_files(("again.pdf", pdf, "application/pdf")), headers=headers("user_a"))).json()["results"][0]
    assert again["error_code"] == "DUPLICATE_DOCUMENT"
    assert again["details"]["existing_document_id"] == doc and again["details"]["existing_status"] == "processed"


async def test_failed_delete_during_expiry_is_retried_next_sweep(client, headers, store, fake_openai, monkeypatch):
    doc = await add(client, headers)
    await process_pending()
    await client.patch("/v1/settings", json={"retention_days": 7}, headers=headers("user_a"))
    await backdate(doc, 9)
    real = store.delete
    monkeypatch.setattr(store, "delete", lambda k: (_ for _ in ()).throw(OSError("down")))
    assert (await retention.run_sweep())["expired"] == 0
    assert (await client.get(f"/v1/documents/{doc}", headers=headers("user_a"))).json()["file_available"] is True
    monkeypatch.setattr(store, "delete", real)
    assert (await retention.run_sweep())["expired"] == 1


# --------------------------------------------------------------- S3 / MinIO ----


@pytest.mark.skipif(not os.environ.get("TEST_S3_ENDPOINT"), reason="set TEST_S3_ENDPOINT/ACCESS/SECRET to run against MinIO")
def test_s3_driver_roundtrip(monkeypatch):
    monkeypatch.setattr(settings, "S3_ENDPOINT", os.environ["TEST_S3_ENDPOINT"])
    monkeypatch.setattr(settings, "S3_ACCESS_KEY", os.environ["TEST_S3_ACCESS_KEY"])
    monkeypatch.setattr(settings, "S3_SECRET_KEY", os.environ["TEST_S3_SECRET_KEY"])
    monkeypatch.setattr(settings, "S3_BUCKET", f"test-{uuid.uuid4().hex[:8]}")
    s3 = storage.S3Storage()
    s3.ensure_bucket()
    s3.put("u1/d1/original.pdf", b"hello", "application/pdf")
    s3.put("u1/d2/original.png", b"world", "image/png")
    s3.put("u2/d3/original.pdf", b"other", "application/pdf")
    assert s3.exists("u1/d1/original.pdf") and s3.get("u1/d1/original.pdf") == b"hello"
    assert b"".join(s3.stream("u1/d2/original.png")) == b"world"
    assert sorted(o.key for o in s3.list_objects()) == ["u1/d1/original.pdf", "u1/d2/original.png", "u2/d3/original.pdf"]
    s3.delete("u1/d1/original.pdf")
    assert not s3.exists("u1/d1/original.pdf")
    assert s3.delete_prefix("u1/") == 1
    assert [o.key for o in s3.list_objects()] == ["u2/d3/original.pdf"]
    s3.delete_prefix("u2/")
    s3.client.delete_bucket(Bucket=settings.S3_BUCKET)
