import uuid

import pytest
from sqlalchemy import func, select, update

from app.config import settings
from app.db import get_sessionmaker
from app.models import CreditTransaction, Document
from app.services.gate import GateError
from app.services.worker import claim_one, process_document, process_pending, requeue_in_flight
from tests.helpers import NON_INVOICE_COLOR, bad_request_error, make_pdf, make_png, rate_limit_error, sample_result, timeout_error, upload_files
from app.schemas_invoice import InvoiceData


async def upload(client, headers, name, data, mime="application/pdf", user="user_a"):
    r = await client.post("/v1/documents", files=upload_files((name, data, mime)), headers=headers(user))
    res = r.json()["results"][0]
    return res


async def detail(client, headers, doc_id, user="user_a"):
    r = await client.get(f"/v1/documents/{doc_id}", headers=headers(user))
    assert r.status_code == 200, r.text
    return r.json()


async def balance(client, headers, user="user_a"):
    return (await client.get("/v1/credits", headers=headers(user))).json()


async def test_happy_path_processes_and_charges(client, headers, fake_openai, store):
    res = await upload(client, headers, "inv.pdf", make_pdf(2))
    assert await process_pending() == 1
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "processed"
    assert d["invoice_data"]["invoice_metadata"]["invoice_number"] == "INV-2026-0042"
    assert d["invoice_data"]["totals"]["grand_total"] == 108
    assert d["markdown_text"].startswith("# Invoice")
    assert d["confidence"] == "high" and d["gate"]["accepted"] is True
    assert d["warnings"] == []
    assert d["usage"]["service_tier_used"] == "flex"  # primary tier from config
    assert fake_openai.parse_tiers == ["flex"]
    # 2 pages charged, ledger row written
    assert (await balance(client, headers)) == {"current_balance": 3, "held": 0, "available": 3}
    tx = (await client.get("/v1/credits/transactions", headers=headers("user_a"))).json()["items"]
    charge = [t for t in tx if t["transaction_type"] == "document_processing"][0]
    assert charge["credits_delta"] == -2 and charge["reference_file_id"] == res["document_id"] and charge["file_name_snapshot"] == "inv.pdf"
    # the source file is kept (default retention)
    assert d["file_available"] is True and len(list(store.list_objects())) == 1


async def test_image_goes_through_the_same_pipeline(client, headers, fake_openai):
    res = await upload(client, headers, "photo.png", make_png(tag="0a"), "image/png")
    await process_pending()
    assert (await detail(client, headers, res["document_id"]))["status"] == "processed"
    assert (await balance(client, headers))["current_balance"] == 4


async def test_non_invoice_rejected_no_charge_and_file_discarded(client, headers, fake_openai, store):
    res = await upload(client, headers, "cat.png", make_png(color=NON_INVOICE_COLOR), "image/png")
    assert len(list(store.list_objects())) == 1
    await process_pending()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "rejected" and d["error_code"] == "NOT_AN_INVOICE"
    assert "invoice" in d["status_detail"].lower()
    assert d["file_available"] is False
    assert list(store.list_objects()) == []  # stored bytes discarded
    assert fake_openai.parse_tiers == []  # never reached extraction
    assert (await balance(client, headers))["current_balance"] == 5
    r = await client.get(f"/v1/documents/{res['document_id']}/file", headers=headers("user_a"))
    assert r.status_code == 410


async def test_unreadable_scan_gets_retake_message(client, headers, fake_openai):
    fake_openai.legibility = 0.2
    fake_openai.is_invoice_probability = 0.3  # an invoice-shaped document too blurry to judge
    res = await upload(client, headers, "blurry.pdf", make_pdf(1))
    await process_pending()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "rejected" and d["error_code"] == "UNREADABLE"
    assert "retake" in d["status_detail"].lower()
    assert (await balance(client, headers))["current_balance"] == 5


async def test_flex_retry_then_success_on_flex(client, headers, fake_openai):
    fake_openai.parse_script = [rate_limit_error(), timeout_error()]
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    await process_pending()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "processed"
    assert fake_openai.parse_tiers == ["flex", "flex", "flex"]
    assert d["usage"]["service_tier_used"] == "flex" and d["usage"]["primary_attempts"] == 3 and d["usage"]["fallback_used"] is False


async def test_flex_exhausted_falls_back_to_default_tier(client, headers, fake_openai):
    fake_openai.parse_script = [rate_limit_error()] * 3
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    await process_pending()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "processed"
    assert fake_openai.parse_tiers == ["flex", "flex", "flex", "default"]
    assert d["usage"]["service_tier_used"] == "default" and d["usage"]["fallback_used"] is True
    assert (await balance(client, headers))["current_balance"] == 4


async def test_fallback_disabled_fails_without_charge(client, headers, fake_openai, monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_FLEX_FALLBACK_TIER", "")
    fake_openai.parse_script = [rate_limit_error()] * 3
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    await process_pending()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "failed" and "retry" in d["status_detail"].lower()
    assert fake_openai.parse_tiers == ["flex"] * 3
    assert (await balance(client, headers))["current_balance"] == 5


async def test_hard_failure_no_charge_then_retry_succeeds(client, headers, fake_openai):
    fake_openai.parse_script = [rate_limit_error()] * 3 + [timeout_error()]  # flex x3 + fallback all fail
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    await process_pending()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "failed"
    assert (await balance(client, headers))["current_balance"] == 5
    async with get_sessionmaker()() as s:
        assert await s.scalar(select(func.count()).select_from(CreditTransaction).where(CreditTransaction.transaction_type == "document_processing")) == 0
    # user retries: queued again, then processed and charged once
    r = await client.post(f"/v1/documents/{res['document_id']}/retry", headers=headers("user_a"))
    assert r.status_code == 202 and r.json()["status"] == "queued"
    await process_pending()
    assert (await detail(client, headers, res["document_id"]))["status"] == "processed"
    assert (await balance(client, headers))["current_balance"] == 4


async def test_non_retryable_error_fails_fast(client, headers, fake_openai):
    fake_openai.parse_script = [bad_request_error()]
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    await process_pending()
    assert (await detail(client, headers, res["document_id"]))["status"] == "failed"
    assert fake_openai.parse_tiers == ["flex"]  # no retries, no fallback for a 400


async def test_gate_error_is_a_failure_not_a_rejection(client, headers, fake_openai):
    fake_openai.gate_error = RuntimeError("boom")
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    await process_pending()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "failed"
    assert (await balance(client, headers))["current_balance"] == 5


async def test_retry_only_for_failed(client, headers, fake_openai):
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    r = await client.post(f"/v1/documents/{res['document_id']}/retry", headers=headers("user_a"))
    assert r.status_code == 409 and r.json()["error"]["code"] == "NOT_RETRYABLE"


async def test_sanity_checks_become_warnings_not_failures(client, headers, fake_openai):
    bad = InvoiceData.model_validate(
        {
            "invoice_metadata": {"invoice_date": "2026-05-10", "due_date": "2026-04-01"},
            "line_items": [{"description": "x", "line_total": 10}, {"description": "y", "line_total": 10}],
            "totals": {"subtotal": 50, "tax_total": 5, "grand_total": 99},
        }
    )
    fake_openai.result = sample_result(invoice_data=bad)
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    await process_pending()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "processed"
    assert {w["code"] for w in d["warnings"]} == {"LINE_TOTALS_MISMATCH", "GRAND_TOTAL_MISMATCH", "DUE_BEFORE_ISSUE"}
    assert (await balance(client, headers))["current_balance"] == 4  # still charged: processing succeeded


async def test_missing_values_stay_null_not_zero(client, headers, fake_openai):
    d = await detail(client, headers, (await _processed(client, headers))["document_id"])
    assert d["invoice_data"]["totals"]["shipping_cost"] is None
    assert d["invoice_data"]["seller"]["contact"]["email"] is None


async def _processed(client, headers):
    res = await upload(client, headers, f"{uuid.uuid4().hex}.pdf", make_pdf(1))
    await process_pending()
    return res


async def test_claim_is_exclusive_and_skip_locked(client, headers, fake_openai):
    await upload(client, headers, "a.pdf", make_pdf(1))
    a = await claim_one()
    b = await claim_one()
    assert a is not None and b is None  # a second claimer finds nothing


async def test_restart_requeues_in_flight_rows(client, headers, fake_openai):
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    claimed = await claim_one()  # worker "crashes" while the row is validating
    assert claimed is not None
    assert (await detail(client, headers, res["document_id"]))["status"] == "validating"
    assert await requeue_in_flight() == 1
    assert (await detail(client, headers, res["document_id"]))["status"] == "queued"
    await process_pending()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "processed"
    assert (await balance(client, headers))["current_balance"] == 4  # charged exactly once


async def test_crash_loop_gives_up_after_max_attempts(client, headers, fake_openai):
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    for _ in range(settings.MAX_ATTEMPTS):
        assert await claim_one() is not None
        await requeue_in_flight()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "failed"


async def test_stale_job_cannot_double_charge(client, headers, fake_openai):
    """A job that lost its claim (restart re-queued the row) must not mark processed or charge."""
    res = await upload(client, headers, "a.pdf", make_pdf(1))
    doc_id, attempt = await claim_one()
    await requeue_in_flight()
    newer = await claim_one()  # a second worker took it over
    assert newer[1] == attempt + 1
    await process_document(doc_id, attempt)  # the stale job runs: ignored
    assert (await detail(client, headers, res["document_id"]))["status"] == "validating"
    await process_document(*newer)
    assert (await balance(client, headers))["current_balance"] == 4


async def test_delete_during_processing_charges_nothing(client, headers, fake_openai, store):
    res = await upload(client, headers, "a.pdf", make_pdf(1))

    async def delete_midway():
        r = await client.delete(f"/v1/documents/{res['document_id']}", headers=headers("user_a"))
        assert r.status_code == 200

    fake_openai.parse_hook = delete_midway
    await process_pending()
    assert (await balance(client, headers))["current_balance"] == 5
    assert list(store.list_objects()) == []


async def test_charge_time_shortfall_fails_without_charge(client, headers, fake_openai):
    res = await upload(client, headers, "a.pdf", make_pdf(3))

    async def drain():  # balance disappears between hold and charge (e.g. manual adjustment)
        async with get_sessionmaker()() as s:
            from app.models import CreditAccount

            await s.execute(update(CreditAccount).values(balance=1))
            await s.commit()

    fake_openai.parse_hook = drain
    await process_pending()
    d = await detail(client, headers, res["document_id"])
    assert d["status"] == "failed"
    assert (await balance(client, headers))["current_balance"] == 1


async def test_signup_bonus_idempotent(client, headers):
    for _ in range(3):
        await client.get("/v1/credits", headers=headers("user_new"))
    tx = (await client.get("/v1/credits/transactions", headers=headers("user_new"))).json()
    assert tx["total"] == 1 and tx["items"][0]["transaction_type"] == "signup_bonus" and tx["items"][0]["credits_delta"] == 5
