import csv
import io
import json
import uuid

from openpyxl import load_workbook

from app.schemas_invoice import InvoiceData
from app.services.worker import process_pending
from tests.helpers import make_pdf, sample_result, upload_files


async def processed(client, headers, fake_openai, name="inv.pdf", result=None):
    if result is not None:
        fake_openai.result = result
    r = await client.post("/v1/documents", files=upload_files((name, make_pdf(1), "application/pdf")), headers=headers("user_a"))
    doc = r.json()["results"][0]["document_id"]
    await process_pending()
    return doc


async def test_json_single(client, headers, fake_openai):
    doc = await processed(client, headers, fake_openai)
    r = await client.get(f"/v1/documents/{doc}/export?format=json", headers=headers("user_a"))
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    body = json.loads(r.content)
    assert body["id"] == doc and body["invoice_data"]["invoice_metadata"]["invoice_number"] == "INV-2026-0042"


async def test_csv_has_one_row_per_line_item(client, headers, fake_openai):
    doc = await processed(client, headers, fake_openai)
    r = await client.get(f"/v1/documents/{doc}/export?format=csv", headers=headers("user_a"))
    assert r.headers["content-type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
    header, lines = rows[0], rows[1:]
    assert len(lines) == 2
    col = {h: i for i, h in enumerate(header)}
    assert lines[0][col["Invoice number"]] == "INV-2026-0042" and lines[0][col["Description"]] == "Widget A"
    assert lines[1][col["Line total"]] == "50.0" and lines[1][col["Grand total"]] == "108.0"


async def test_xlsx_multi_export_two_sheets(client, headers, fake_openai):
    d1 = await processed(client, headers, fake_openai, "one.pdf")
    d2 = await processed(client, headers, fake_openai, "two.pdf")
    queued = (await client.post("/v1/documents", files=upload_files(("three.pdf", make_pdf(1), "application/pdf")), headers=headers("user_a"))).json()["results"][0]["document_id"]
    r = await client.post("/v1/exports", json={"ids": [d1, d2, queued, str(uuid.uuid4())], "format": "xlsx"}, headers=headers("user_a"))
    assert r.status_code == 200
    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ["Invoices", "Line items"]
    assert wb["Invoices"].max_row == 3  # header + 2 processed (queued and unknown skipped)
    assert wb["Line items"].max_row == 5  # header + 2 invoices x 2 lines
    assert "invoices.xlsx" in r.headers["content-disposition"]


async def test_export_uses_edited_data(client, headers, fake_openai):
    doc = await processed(client, headers, fake_openai)
    data = (await client.get(f"/v1/documents/{doc}", headers=headers("user_a"))).json()["invoice_data"]
    data["invoice_metadata"]["invoice_number"] = "FIXED-7"
    await client.patch(f"/v1/documents/{doc}", json={"edited_data": data}, headers=headers("user_a"))
    body = json.loads((await client.get(f"/v1/documents/{doc}/export?format=json", headers=headers("user_a"))).content)
    assert body["edited"] is True and body["invoice_data"]["invoice_metadata"]["invoice_number"] == "FIXED-7"


async def test_formula_injection_is_neutralised(client, headers, fake_openai):
    evil = InvoiceData.model_validate(
        {"seller": {"name": "=HYPERLINK(\"http://evil\",\"x\")"}, "line_items": [{"description": "+cmd|' /C calc'!A0", "quantity": 1}]}
    )
    doc = await processed(client, headers, fake_openai, result=sample_result(invoice_data=evil))
    csv_rows = list(csv.reader(io.StringIO((await client.get(f"/v1/documents/{doc}/export?format=csv", headers=headers("user_a"))).content.decode("utf-8-sig"))))
    flat = [c for row in csv_rows[1:] for c in row]
    assert not any(c[:1] in "=+-@" for c in flat if c)
    wb = load_workbook(io.BytesIO((await client.get(f"/v1/documents/{doc}/export?format=xlsx", headers=headers("user_a"))).content))
    for ws in wb:
        for row in ws.iter_rows(min_row=2):
            assert all(not (isinstance(c.value, str) and c.value[:1] in "=+-@") for c in row)


async def test_export_errors(client, headers, fake_openai):
    queued = (await client.post("/v1/documents", files=upload_files(("q.pdf", make_pdf(1), "application/pdf")), headers=headers("user_a"))).json()["results"][0]["document_id"]
    r = await client.get(f"/v1/documents/{queued}/export?format=json", headers=headers("user_a"))
    assert r.status_code == 409 and r.json()["error"]["code"] == "NOT_EXPORTABLE"
    r = await client.get(f"/v1/documents/{queued}/export?format=pdf", headers=headers("user_a"))
    assert r.status_code == 422
    r = await client.post("/v1/exports", json={"ids": [queued], "format": "csv"}, headers=headers("user_a"))
    assert r.status_code == 409
