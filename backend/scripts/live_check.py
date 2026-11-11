"""Live pipeline check against a RUNNING backend that uses the real OpenAI key.

    # terminal 1 (from backend/): see README for the full env
    JWT_DEV_PUBLIC_KEY_FILE=.devkeys/public.pem uvicorn app.main:app --port 8000
    # terminal 2
    python scripts/live_check.py --base http://127.0.0.1:8000

Uploads generated documents (multi-page invoice PDF, phone-style JPEG, a non-invoice picture, an
11-page PDF, an 11 MB file, an encrypted PDF, a duplicate), waits for processing, and compares the
stored JSON with the known values. Uses a fresh random user id each run.
"""

from __future__ import annotations

import argparse
import io
import random
import sys
import time
import uuid
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.pdfencrypt import StandardEncryption
from reportlab.pdfgen import canvas

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mint_token import mint  # noqa: E402

LINES = [
    ("Recycled notebook A5", 24, 3.50, 84.00),
    ("Gel pens (box of 12)", 10, 6.25, 62.50),
    ("Desk organiser", 3, 18.90, 56.70),
    ("Sticky notes 6-pack", 15, 4.10, 61.50),
    ("Archive folders", 40, 1.15, 46.00),
    ("Whiteboard markers", 8, 7.40, 59.20),
    ("Packing tape", 12, 2.35, 28.20),
    ("Lever arch files", 20, 3.95, 79.00),
]
SUB, VAT, TOTAL = 477.10, 95.42, 572.52


def invoice_pdf(salt: str = "") -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    def header(page: int) -> float:
        c.setFont("Helvetica-Bold", 18)
        c.drawString(50, h - 60, "Harbor & Pine Stationery Ltd")
        c.setFont("Helvetica", 10)
        c.drawString(50, h - 76, "14 Quay Lane, Plymouth, PL1 2AB, United Kingdom")
        c.drawString(50, h - 90, "accounts@harborpine.example   +44 1752 555 0142")
        c.setFont("Helvetica-Bold", 22)
        c.drawRightString(w - 50, h - 60, "INVOICE")
        c.setFont("Helvetica", 10)
        c.drawRightString(w - 50, h - 80, "Invoice No: INV-2026-1187")
        c.drawRightString(w - 50, h - 94, "Invoice Date: 2026-02-18")
        c.drawRightString(w - 50, h - 108, "Due Date: 2026-03-20")
        c.drawRightString(w - 50, h - 122, f"Page {page} of 2")
        if page == 1:
            c.setFont("Helvetica-Bold", 10)
            c.drawString(50, h - 140, "Bill To:")
            c.setFont("Helvetica", 10)
            c.drawString(50, h - 154, "Kestrel Design Studio")
            c.drawString(50, h - 168, "7 Foundry Row, Bristol, BS1 4XY, United Kingdom")
        y = h - 205
        c.setFont("Helvetica-Bold", 10)
        for x, t in ((50, "#"), (80, "Description"), (330, "Qty"), (390, "Unit price (GBP)"), (500, "Line total")):
            c.drawString(x, y, t)
        c.line(50, y - 4, w - 50, y - 4)
        c.setFont("Helvetica", 10)
        return y - 22

    y = header(1)
    for i, (d, q, p, t) in enumerate(LINES[:5], 1):
        for x, s in ((50, str(i)), (80, d), (330, str(q)), (410, f"{p:.2f}"), (510, f"{t:.2f}")):
            c.drawString(x, y, s)
        y -= 20
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(50, 60, "Continued on next page" + (f" ({salt})" if salt else ""))
    c.showPage()
    y = header(2)
    for i, (d, q, p, t) in enumerate(LINES[5:], 6):
        for x, s in ((50, str(i)), (80, d), (330, str(q)), (410, f"{p:.2f}"), (510, f"{t:.2f}")):
            c.drawString(x, y, s)
        y -= 20
    y -= 20
    c.setFont("Helvetica", 11)
    for label, val in (("Subtotal", SUB), ("VAT 20%", VAT)):
        c.drawString(380, y, label)
        c.drawRightString(w - 50, y, f"{val:.2f}")
        y -= 18
    c.setFont("Helvetica-Bold", 12)
    c.drawString(380, y, "TOTAL DUE (GBP)")
    c.drawRightString(w - 50, y, f"{TOTAL:.2f}")
    c.setFont("Helvetica", 9)
    c.drawString(50, y - 40, "Payment terms: Net 30. Bank: Westshire Bank, IBAN GB29 NWBK 6016 1331 9268 19")
    c.showPage()
    c.save()
    return buf.getvalue()


def phone_jpeg() -> bytes:
    font = ImageFont.load_default(size=30)
    big = ImageFont.load_default(size=44)
    paper = Image.new("RGB", (1000, 1250), (252, 251, 247))
    d = ImageDraw.Draw(paper)
    rows = [
        (big, "BOLT ON"),
        (font, "1025 Mudlick Road, Yakima, WA 98902"),
        (font, "info@bolton.example   509-575-3999"),
        (font, ""),
        (big, "INVOICE"),
        (font, "Invoice No: 0330-00012"),
        (font, "Date: 2026-03-30"),
        (font, "Bill to: Lorraine O. Wright, 4141 Pearl Street, Sacramento, CA"),
        (font, ""),
        (font, "Item                          Qty   Price    Amount"),
        (font, "Heart Planner Charm             3    1.50     4.50"),
        (font, "Cute Cupcake Planner Charm      6    1.50     9.00"),
        (font, "Kawaii Pineapple Keychain       4    2.75    11.00"),
        (font, ""),
        (font, "Subtotal                                    24.50"),
        (font, "Tax 2%                                       0.49"),
        (big, "TOTAL (USD)                                24.99"),
        (font, ""),
        (font, "THANK YOU FOR YOUR BUSINESS!"),
    ]
    y = 60
    for f, t in rows:
        d.text((50, y), t, fill=(25, 25, 30), font=f)
        y += 58
    desk = Image.new("RGB", (1500, 1700), (96, 74, 58))
    shadow = Image.new("RGB", paper.size, (40, 30, 25))
    rot_p = paper.rotate(4.5, expand=True, fillcolor=(96, 74, 58), resample=Image.BICUBIC)
    rot_s = shadow.rotate(4.5, expand=True, fillcolor=(96, 74, 58), resample=Image.BICUBIC).filter(ImageFilter.GaussianBlur(18))
    desk.paste(rot_s, (190, 210))
    desk.paste(rot_p, (170, 190))
    desk = desk.filter(ImageFilter.GaussianBlur(1.1))
    px = desk.load()
    rnd = random.Random(7)
    for yy in range(0, desk.height):
        k = 0.82 + 0.18 * (yy / desk.height)  # uneven lighting
        for xx in range(0, desk.width, 1):
            r, g, b = px[xx, yy]
            n = rnd.randint(-9, 9)
            px[xx, yy] = (min(255, int(r * k) + n), min(255, int(g * k) + n), min(255, int(b * k) + n))
    out = io.BytesIO()
    desk.save(out, "JPEG", quality=72)
    return out.getvalue()


def landscape_png() -> bytes:
    img = Image.new("RGB", (1000, 700), (135, 190, 235))
    d = ImageDraw.Draw(img)
    d.polygon([(0, 700), (250, 280), (500, 700)], fill=(90, 100, 110))
    d.polygon([(350, 700), (650, 220), (1000, 700)], fill=(70, 85, 95))
    d.ellipse((780, 60, 900, 180), fill=(255, 220, 80))
    d.rectangle((0, 560, 1000, 700), fill=(60, 140, 70))
    d.text((40, 40), "Holiday 2025", fill="white", font=ImageFont.load_default(size=40))
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def many_pages_pdf(n: int) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for i in range(n):
        c.drawString(60, 780, f"Statement page {i + 1} of {n}")
        c.showPage()
    c.save()
    return buf.getvalue()


def encrypted_pdf() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4, encrypt=StandardEncryption("secret", canPrint=0))
    c.drawString(60, 780, "Locked")
    c.showPage()
    c.save()
    return buf.getvalue()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8000")
    ap.add_argument("--timeout", type=int, default=900)
    args = ap.parse_args()

    user = f"live_{uuid.uuid4().hex[:12]}"
    h = {"Authorization": f"Bearer {mint(user)}"}
    c = httpx.Client(base_url=args.base, headers=h, timeout=120)
    ok = True

    def check(label: str, cond: bool, detail: str = "") -> None:
        nonlocal ok
        ok &= bool(cond)
        print(f"  [{'PASS' if cond else 'FAIL'}] {label}{(' - ' + detail) if detail else ''}")

    def upload(name: str, data: bytes, mime: str) -> dict:
        r = c.post("/v1/documents", files=[("files", (name, data, mime))])
        assert r.status_code == 202, (r.status_code, r.text[:300])
        return r.json()["results"][0]

    print(f"user {user}; start balance:", c.get("/v1/credits").json())

    print("\n== intake-level rejections (no OpenAI call) ==")
    r = upload("eleven_pages.pdf", many_pages_pdf(11), "application/pdf")
    check("11-page PDF -> PAGE_LIMIT_EXCEEDED", r["error_code"] == "PAGE_LIMIT_EXCEEDED", str(r["details"]))
    r = upload("eleven_mb.pdf", b"%PDF-1.4\n" + b"0" * (11 * 1024 * 1024), "application/pdf")
    check("11 MB file -> FILE_TOO_LARGE", r["error_code"] == "FILE_TOO_LARGE")
    r = upload("locked.pdf", encrypted_pdf(), "application/pdf")
    check("encrypted PDF -> PDF_ENCRYPTED", r["error_code"] == "PDF_ENCRYPTED")

    print("\n== uploads that reach OpenAI ==")
    pdf = invoice_pdf()
    jobs = {
        "invoice.pdf": upload("invoice.pdf", pdf, "application/pdf"),
        "phone.jpg": upload("phone.jpg", phone_jpeg(), "image/jpeg"),
        "holiday.png": upload("holiday.png", landscape_png(), "image/png"),
    }
    for k, v in jobs.items():
        check(f"{k} queued", v["success"] and v["status"] == "queued", v.get("document_id") or str(v))
    dup = upload("invoice-copy.pdf", pdf, "application/pdf")
    check("same file twice -> DUPLICATE_DOCUMENT naming the first", dup["error_code"] == "DUPLICATE_DOCUMENT" and dup["details"]["existing_document_id"] == jobs["invoice.pdf"]["document_id"])
    bal = c.get("/v1/credits").json()
    check("soft hold shows 4 pages in flight (2 + 1 + 1), balance untouched", bal == {"current_balance": 5, "held": 4, "available": 1}, str(bal))

    print("\n== waiting for the worker ==")
    t0 = time.time()
    docs: dict[str, dict] = {}
    while time.time() - t0 < args.timeout:
        docs = {k: c.get(f"/v1/documents/{v['document_id']}").json() for k, v in jobs.items()}
        states = {k: d["status"] for k, d in docs.items()}
        if all(s in ("processed", "rejected", "failed") for s in states.values()):
            break
        print(f"  {int(time.time() - t0):>4}s {states}")
        time.sleep(5)
    print(f"  done in {int(time.time() - t0)}s: " + str({k: d['status'] for k, d in docs.items()}))

    def near(a, b, tol=0.011):
        return isinstance(a, (int, float)) and abs(a - b) <= tol

    print("\n== invoice.pdf (2 pages, 8 lines) ==")
    d = docs["invoice.pdf"]
    check("processed", d["status"] == "processed", d.get("status_detail") or "")
    if d["status"] == "processed":
        inv = d["invoice_data"]
        m, t = inv["invoice_metadata"], inv["totals"]
        check("invoice number", m["invoice_number"] == "INV-2026-1187", str(m["invoice_number"]))
        check("dates", m["invoice_date"] == "2026-02-18" and m["due_date"] == "2026-03-20", f"{m['invoice_date']} / {m['due_date']}")
        check("currency GBP", m["currency"] == "GBP", str(m["currency"]))
        who = lambda p: f"{p['name']} {p['company_name']}".lower()  # noqa: E731
        check("seller / buyer", "harbor" in who(inv["seller"]) and "kestrel" in who(inv["buyer"]), f"{inv['seller']['name']} | {inv['seller']['company_name']} / {inv['buyer']['name']} | {inv['buyer']['company_name']}")
        check("seller name goes in `name`", bool(inv["seller"]["name"]), str(inv["seller"]["name"]))
        check("8 line items", len(inv["line_items"]) == 8, str(len(inv["line_items"])))
        got = [(li["description"], li["quantity"], li["unit_price"], li["line_total"]) for li in inv["line_items"]]
        check("line items match", len(got) == 8 and all(near(g[3], e[3]) and near(g[1], e[1]) and near(g[2], e[2]) for g, e in zip(got, LINES)))
        check("totals 477.10 / 95.42 / 572.52", near(t["subtotal"], SUB) and near(t["tax_total"], VAT) and near(t["grand_total"], TOTAL), f"{t['subtotal']} / {t['tax_total']} / {t['grand_total']}")
        check("missing fields are null, not 0 (shipping)", t["shipping_cost"] is None, str(t["shipping_cost"]))
        check("no sanity warnings", d["warnings"] == [], str(d["warnings"]))
        check("usage records the tier", d["usage"]["service_tier_used"] in ("flex", "default"), str(d["usage"]))
        print("    tier used:", d["usage"]["service_tier_used"], "| fallback:", d["usage"]["fallback_used"], "| tokens:", d["usage"]["input_tokens"], "in /", d["usage"]["output_tokens"], "out")

    print("\n== phone.jpg ==")
    d = docs["phone.jpg"]
    check("processed", d["status"] == "processed", d.get("status_detail") or str(d.get("gate")))
    if d["status"] == "processed":
        inv = d["invoice_data"]
        t = inv["totals"]
        check("invoice number", (inv["invoice_metadata"]["invoice_number"] or "").replace(" ", "") == "0330-00012", str(inv["invoice_metadata"]["invoice_number"]))
        check("3 lines", len(inv["line_items"]) == 3, str(len(inv["line_items"])))
        check("totals 24.50 / 0.49 / 24.99", near(t["subtotal"], 24.50) and near(t["tax_total"], 0.49) and near(t["grand_total"], 24.99), f"{t['subtotal']} / {t['tax_total']} / {t['grand_total']}")
        check("currency USD", inv["invoice_metadata"]["currency"] == "USD", str(inv["invoice_metadata"]["currency"]))
        print("    gate:", d["gate"], "| tier:", d["usage"]["service_tier_used"])

    print("\n== holiday.png (not an invoice) ==")
    d = docs["holiday.png"]
    check("rejected as NOT_AN_INVOICE", d["status"] == "rejected" and d["error_code"] == "NOT_AN_INVOICE", f"{d['status']} {d.get('error_code')} gate={d.get('gate')}")
    check("human reason present", bool(d["status_detail"]), d["status_detail"] or "")
    check("stored file discarded", d["file_available"] is False)

    print("\n== credit ledger ==")
    bal = c.get("/v1/credits").json()
    tx = c.get("/v1/credits/transactions").json()["items"]
    charges = sorted(-t["credits_delta"] for t in tx if t["transaction_type"] == "document_processing")
    check("charged 2 + 1 pages only", charges == [1, 2] and bal["current_balance"] == 2 and bal["held"] == 0, f"{bal} charges={charges}")
    check("signup bonus recorded once", sum(1 for t in tx if t["transaction_type"] == "signup_bonus") == 1)

    print("\n== extras ==")
    r = c.get(f"/v1/documents/{jobs['invoice.pdf']['document_id']}/export", params={"format": "xlsx"})
    check("xlsx export", r.status_code == 200 and r.content[:2] == b"PK")
    r = c.get(f"/v1/documents/{jobs['invoice.pdf']['document_id']}/file")
    check("source file streams back identically", r.status_code == 200 and r.content == pdf)
    c.delete("/v1/account")  # leave nothing behind
    print("\nRESULT:", "ALL PASS" if ok else "SOME CHECKS FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
