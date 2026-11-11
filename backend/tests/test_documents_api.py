import uuid

from app.schemas_invoice import InvoiceData
from app.services.worker import process_pending
from tests.helpers import make_pdf, sample_result, upload_files


async def add(client, headers, name=None, user="user_a", pages=1):
    name = name or f"{uuid.uuid4().hex[:6]}.pdf"
    r = await client.post("/v1/documents", files=upload_files((name, make_pdf(pages), "application/pdf")), headers=headers(user))
    return r.json()["results"][0]["document_id"]


async def test_list_pagination_search_and_status_filter(client, headers, fake_openai):
    ids = [await add(client, headers, f"alpha-{i}.pdf") for i in range(3)]
    await process_pending()
    fake_openai.result = sample_result(
        invoice_data=InvoiceData.model_validate(
            {"invoice_metadata": {"invoice_number": "ZZ-9"}, "seller": {"name": "Globex Corp"}, "totals": {"grand_total": 5}}
        )
    )
    odd = await add(client, headers, "beta.pdf")
    await process_pending()
    queued = await add(client, headers, "gamma.pdf")  # stays queued

    r = (await client.get("/v1/documents", headers=headers("user_a"))).json()
    assert r["total"] == 5 and len(r["items"]) == 5
    assert "markdown_text" not in r["items"][0] and "file_base64" not in r["items"][0]  # list carries no heavy payloads
    page = (await client.get("/v1/documents?limit=2&offset=2", headers=headers("user_a"))).json()
    assert page["total"] == 5 and len(page["items"]) == 2

    def hits(q):
        return client.get("/v1/documents", params={"q": q}, headers=headers("user_a"))

    assert [d["id"] for d in (await hits("globex")).json()["items"]] == [odd]  # seller name
    assert [d["id"] for d in (await hits("ZZ-9")).json()["items"]] == [odd]  # invoice number
    assert (await hits("alpha")).json()["total"] == 3  # file name
    assert (await hits("100%")).json()["total"] == 0  # LIKE wildcards are escaped
    only_q = (await client.get("/v1/documents?status=queued", headers=headers("user_a"))).json()
    assert [d["id"] for d in only_q["items"]] == [queued]
    both = (await client.get("/v1/documents?status=queued,processed", headers=headers("user_a"))).json()
    assert both["total"] == 5
    assert (await client.get("/v1/documents?status=nope", headers=headers("user_a"))).status_code == 422
    summary = next(d for d in r["items"] if d["id"] == odd)["summary"]
    assert summary["seller_name"] == "Globex Corp" and summary["grand_total"] == 5
    assert set(ids) <= {d["id"] for d in r["items"]}


async def test_users_are_isolated(client, headers, fake_openai):
    doc = await add(client, headers, user="user_a")
    await process_pending()
    for call in (
        client.get(f"/v1/documents/{doc}", headers=headers("user_b")),
        client.get(f"/v1/documents/{doc}/file", headers=headers("user_b")),
        client.get(f"/v1/documents/{doc}/export?format=json", headers=headers("user_b")),
        client.patch(f"/v1/documents/{doc}", json={"edited_data": None}, headers=headers("user_b")),
        client.delete(f"/v1/documents/{doc}", headers=headers("user_b")),
    ):
        assert (await call).status_code == 404
    assert (await client.get("/v1/documents", headers=headers("user_b"))).json()["total"] == 0
    assert (await client.post("/v1/documents/delete", json={"ids": [doc]}, headers=headers("user_b"))).json()["deleted"] == 0
    assert (await client.get(f"/v1/documents/{doc}", headers=headers("user_a"))).status_code == 200


async def test_file_streams_through_api(client, headers, fake_openai):
    pdf = make_pdf(1)
    r = await client.post("/v1/documents", files=upload_files(("my invoice.pdf", pdf, "application/pdf")), headers=headers("user_a"))
    doc = r.json()["results"][0]["document_id"]
    f = await client.get(f"/v1/documents/{doc}/file", headers=headers("user_a"))
    assert f.status_code == 200 and f.content == pdf
    assert f.headers["content-type"] == "application/pdf" and "my%20invoice.pdf" in f.headers["content-disposition"]
    assert (await client.get(f"/v1/documents/{doc}/file")).status_code == 401


async def test_edit_keeps_original_and_can_reset(client, headers, fake_openai):
    doc = await add(client, headers)
    await process_pending()
    original = (await client.get(f"/v1/documents/{doc}", headers=headers("user_a"))).json()
    corrected = original["invoice_data"]
    corrected["invoice_metadata"]["invoice_number"] = "CORRECTED-1"
    corrected["totals"]["grand_total"] = 999  # now disagrees with subtotal + tax
    r = await client.patch(f"/v1/documents/{doc}", json={"edited_data": corrected}, headers=headers("user_a"))
    assert r.status_code == 200
    d = r.json()
    assert d["edited"] is True and d["edited_data"]["invoice_metadata"]["invoice_number"] == "CORRECTED-1"
    assert d["invoice_data"]["invoice_metadata"]["invoice_number"] == "INV-2026-0042"  # model output preserved
    assert d["current_data"]["invoice_metadata"]["invoice_number"] == "CORRECTED-1"
    assert [w["code"] for w in d["warnings"]] == ["GRAND_TOTAL_MISMATCH"]  # recomputed from the edit
    listed = (await client.get("/v1/documents", headers=headers("user_a"))).json()["items"][0]
    assert listed["edited"] and listed["summary"]["invoice_number"] == "CORRECTED-1"
    # reset
    r = await client.patch(f"/v1/documents/{doc}", json={"edited_data": None}, headers=headers("user_a"))
    d = r.json()
    assert d["edited"] is False and d["edited_data"] is None and d["warnings"] == []
    assert d["current_data"]["invoice_metadata"]["invoice_number"] == "INV-2026-0042"


async def test_edit_validation_and_state(client, headers, fake_openai):
    doc = await add(client, headers)
    r = await client.patch(f"/v1/documents/{doc}", json={"edited_data": {}}, headers=headers("user_a"))
    assert r.status_code == 409 and r.json()["error"]["code"] == "NOT_EDITABLE"  # still queued
    await process_pending()
    assert (await client.patch(f"/v1/documents/{doc}", json={}, headers=headers("user_a"))).status_code == 422
    bad = await client.patch(f"/v1/documents/{doc}", json={"edited_data": {"totals": {"grand_total": "abc"}}}, headers=headers("user_a"))
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "VALIDATION_ERROR"
    unknown = await client.patch(f"/v1/documents/{doc}", json={"edited_data": {"surprise": 1}}, headers=headers("user_a"))
    assert unknown.status_code == 422


async def test_delete_single_and_bulk_remove_rows_and_files(client, headers, store, fake_openai):
    ids = [await add(client, headers) for _ in range(3)]
    assert len(list(store.list_objects())) == 3
    r = await client.delete(f"/v1/documents/{ids[0]}", headers=headers("user_a"))
    assert r.json() == {"deleted": 1, "ids": [ids[0]]}
    r = await client.post("/v1/documents/delete", json={"ids": ids[1:] + [str(uuid.uuid4())]}, headers=headers("user_a"))
    assert r.json()["deleted"] == 2
    assert list(store.list_objects()) == []
    assert (await client.get("/v1/documents", headers=headers("user_a"))).json()["total"] == 0
    assert (await client.delete(f"/v1/documents/{ids[0]}", headers=headers("user_a"))).status_code == 404
    # deleting frees the duplicate check and the credit hold
    assert (await client.get("/v1/credits", headers=headers("user_a"))).json()["held"] == 0


async def test_deleting_keeps_ledger_row_with_snapshot(client, headers, fake_openai):
    doc = await add(client, headers, "keepme.pdf")
    await process_pending()
    await client.delete(f"/v1/documents/{doc}", headers=headers("user_a"))
    tx = (await client.get("/v1/credits/transactions", headers=headers("user_a"))).json()["items"]
    charge = next(t for t in tx if t["transaction_type"] == "document_processing")
    assert charge["reference_file_id"] is None and charge["file_name_snapshot"] == "keepme.pdf"


async def test_bad_ids_and_validation_envelope(client, headers):
    r = await client.get("/v1/documents/not-a-uuid", headers=headers("user_a"))
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    r = await client.post("/v1/documents/delete", json={"ids": []}, headers=headers("user_a"))
    assert r.status_code == 422
    r = await client.get("/v1/nope", headers=headers("user_a"))
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"
