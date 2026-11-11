import asyncio

import pytest
from sqlalchemy import func, select

from app.config import settings
from app.db import get_sessionmaker
from app.models import Document
from tests.helpers import make_jpeg, make_pdf, make_png, upload_files


async def post(client, headers, *items, user="user_a"):
    return await client.post("/v1/documents", files=upload_files(*items), headers=headers(user))


def only(resp):
    assert resp.status_code == 202, resp.text
    return resp.json()["results"][0]


async def test_pdf_png_jpeg_accepted_and_queued(client, headers, store):
    r = await post(
        client,
        headers,
        ("a.pdf", make_pdf(2), "application/pdf"),
        ("b.png", make_png(tag="01"), "image/png"),
        ("c.jpg", make_jpeg(), "image/jpeg"),
    )
    assert r.status_code == 202
    body = r.json()
    assert body["accepted"] == 3 and body["rejected"] == 0
    assert [x["status"] for x in body["results"]] == ["queued"] * 3
    assert body["results"][0]["details"]["num_pages"] == 2
    keys = [o.key for o in store.list_objects()]
    assert len(keys) == 3 and all(k.startswith("user_a/") for k in keys)


async def test_type_detected_by_magic_bytes_not_client_claim(client, headers):
    # PNG bytes labelled as a PDF are accepted as a PNG
    res = only(await post(client, headers, ("scan.pdf", make_png(tag="02"), "application/pdf")))
    assert res["success"]
    detail = (await client.get(f"/v1/documents/{res['document_id']}", headers=headers("user_a"))).json()
    assert detail["mime_type"] == "image/png"
    # a text file labelled as a PDF is refused
    res = only(await post(client, headers, ("fake.pdf", b"hello world, not a pdf", "application/pdf")))
    assert res["error_code"] == "INVALID_DOCUMENT"


@pytest.mark.parametrize(
    "name,data",
    [("anim.gif", b"GIF89a" + b"\x00" * 50), ("doc.docx", b"PK\x03\x04" + b"\x00" * 50), ("broken.pdf", b"%PDF-1.7\nnot really")],
)
async def test_invalid_document(client, headers, name, data):
    res = only(await post(client, headers, (name, data, "application/octet-stream")))
    assert res["success"] is False and res["error_code"] == "INVALID_DOCUMENT"


async def test_empty_file(client, headers):
    res = only(await post(client, headers, ("e.pdf", b"", "application/pdf")))
    assert res["error_code"] == "EMPTY_FILE"


async def test_file_too_large(client, headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_FILE_MB", 1)
    big = make_pdf(1) + b"0" * (1024 * 1024 + 10)
    res = only(await post(client, headers, ("big.pdf", big, "application/pdf")))
    assert res["error_code"] == "FILE_TOO_LARGE"


async def test_request_body_cap_cuts_off_early(client, headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_FILE_MB", 1)
    monkeypatch.setattr(settings, "MAX_FILES_PER_UPLOAD", 2)  # cap = 2 MB + 1 MB slack
    huge = b"%PDF-" + b"0" * (4 * 1024 * 1024)
    r = await post(client, headers, ("huge.pdf", huge, "application/pdf"))
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "REQUEST_TOO_LARGE"


async def test_page_limit_exceeded(client, headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_PDF_PAGES", 2)
    res = only(await post(client, headers, ("long.pdf", make_pdf(3), "application/pdf")))
    assert res["error_code"] == "PAGE_LIMIT_EXCEEDED"
    assert res["details"]["pages"] == 3


async def test_11_page_pdf_over_default_limit(client, headers):
    res = only(await post(client, headers, ("eleven.pdf", make_pdf(11), "application/pdf")))
    assert res["error_code"] == "PAGE_LIMIT_EXCEEDED"


async def test_encrypted_pdf(client, headers):
    res = only(await post(client, headers, ("locked.pdf", make_pdf(1, encrypt="secret"), "application/pdf")))
    assert res["error_code"] == "PDF_ENCRYPTED"


async def test_image_pixel_cap(client, headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_IMAGE_PIXELS", 10_000)
    res = only(await post(client, headers, ("huge.png", make_png(500, 500), "image/png")))
    assert res["error_code"] == "INVALID_DOCUMENT"


async def test_duplicate_names_existing_document(client, headers):
    pdf = make_pdf(1)
    first = only(await post(client, headers, ("one.pdf", pdf, "application/pdf")))
    again = only(await post(client, headers, ("renamed.pdf", pdf, "application/pdf")))
    assert again["error_code"] == "DUPLICATE_DOCUMENT"
    assert again["details"]["existing_document_id"] == first["document_id"]
    # another user may upload the same bytes
    other = only(await post(client, headers, ("one.pdf", pdf, "application/pdf"), user="user_b"))
    assert other["success"]


async def test_insufficient_credits_reports_numbers(client, headers):
    # 5 signup credits; a 6-page PDF cannot be afforded
    res = only(await post(client, headers, ("six.pdf", make_pdf(6), "application/pdf")))
    assert res["error_code"] == "INSUFFICIENT_CREDITS"
    assert res["details"] == {"current_balance": 5, "held": 0, "available": 5, "required": 6}


async def test_soft_hold_counts_in_flight_pages(client, headers):
    first = only(await post(client, headers, ("a.pdf", make_pdf(4), "application/pdf")))
    assert first["success"]
    second = only(await post(client, headers, ("b.pdf", make_pdf(2), "application/pdf")))
    assert second["error_code"] == "INSUFFICIENT_CREDITS"
    assert second["details"]["held"] == 4 and second["details"]["available"] == 1
    # the account balance itself is untouched until processing succeeds
    assert (await client.get("/v1/credits", headers=headers("user_a"))).json()["current_balance"] == 5


async def test_soft_hold_under_concurrent_uploads(client, headers):
    """5 credits, six concurrent 1-page uploads: exactly five may be accepted."""
    items = [(f"f{i}.pdf", make_pdf(1, tag=f"{i:08x}"), "application/pdf") for i in range(6)]
    await client.get("/v1/credits", headers=headers("user_a"))  # create the account first
    rs = await asyncio.gather(*[post(client, headers, it) for it in items])
    results = [r.json()["results"][0] for r in rs]
    assert sum(1 for x in results if x["success"]) == 5
    assert [x["error_code"] for x in results if not x["success"]] == ["INSUFFICIENT_CREDITS"]


async def test_inflight_cap(client, headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_INFLIGHT_PER_USER", 2)
    out = [only(await post(client, headers, (f"{i}.pdf", make_pdf(1, tag=f"{i:08x}"), "application/pdf"))) for i in range(3)]
    assert [o["success"] for o in out] == [True, True, False]
    assert out[2]["error_code"] == "TOO_MANY_IN_FLIGHT"


async def test_hourly_cap(client, headers, monkeypatch):
    monkeypatch.setattr(settings, "UPLOADS_PER_HOUR", 2)
    out = [only(await post(client, headers, (f"{i}.pdf", make_pdf(1, tag=f"{i:08x}"), "application/pdf"))) for i in range(3)]
    assert out[2]["error_code"] == "RATE_LIMITED"


async def test_too_many_files_and_no_files(client, headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_FILES_PER_UPLOAD", 2)
    items = [(f"{i}.pdf", make_pdf(1, tag=f"{i:08x}"), "application/pdf") for i in range(3)]
    r = await post(client, headers, *items)
    assert r.status_code == 400 and r.json()["error"]["code"] == "TOO_MANY_FILES"
    r = await client.post("/v1/documents", headers=headers("user_a"))
    assert r.status_code == 400 and r.json()["error"]["code"] == "NO_FILES"


async def test_rejected_intake_leaves_no_rows_or_objects(client, headers, store):
    await post(client, headers, ("x.gif", b"GIF89a" + b"\x00" * 40, "image/gif"))
    await post(client, headers, ("six.pdf", make_pdf(6), "application/pdf"))
    async with get_sessionmaker()() as s:
        assert await s.scalar(select(func.count()).select_from(Document)) == 0
    assert list(store.list_objects()) == []
