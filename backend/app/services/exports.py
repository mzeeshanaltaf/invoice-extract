"""JSON / CSV / XLSX export of one or many processed documents (uses edited data when present)."""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

from app.models import Document
from app.services.serialize import effective_data

FORMATS = {
    "json": "application/json",
    "csv": "text/csv; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

INVOICE_COLUMNS = [
    ("file_name", "File"),
    ("invoice_number", "Invoice number"),
    ("invoice_date", "Invoice date"),
    ("due_date", "Due date"),
    ("currency", "Currency"),
    ("seller_name", "Seller"),
    ("seller_address", "Seller address"),
    ("seller_email", "Seller email"),
    ("buyer_name", "Buyer"),
    ("buyer_address", "Buyer address"),
    ("subtotal", "Subtotal"),
    ("discount_total", "Discount"),
    ("tax_total", "Tax"),
    ("shipping_cost", "Shipping"),
    ("other_charges", "Other charges"),
    ("grand_total", "Grand total"),
    ("amount_paid", "Amount paid"),
    ("balance_due", "Balance due"),
    ("payment_terms", "Payment terms"),
    ("notes", "Notes"),
]
LINE_COLUMNS = [
    ("line_number", "Line"),
    ("item_code", "Item code"),
    ("description", "Description"),
    ("quantity", "Quantity"),
    ("unit_of_measure", "Unit"),
    ("unit_price", "Unit price"),
    ("discount", "Discount"),
    ("tax_rate", "Tax rate"),
    ("tax_amount", "Tax amount"),
    ("line_total", "Line total"),
]


@dataclass
class ExportFile:
    content: bytes
    media_type: str
    filename: str


def _safe(v: Any) -> Any:
    """Neutralise spreadsheet formula injection: a leading = + - @ makes a cell a formula."""
    if isinstance(v, str) and v[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + v
    return v


def _address(p: dict[str, Any] | None) -> str | None:
    a = (p or {}).get("address") or {}
    parts = [a.get("street"), a.get("city"), a.get("state"), a.get("postal_code"), a.get("country")]
    text = ", ".join(x for x in parts if x)
    return text or None


def _name(p: dict[str, Any] | None) -> str | None:
    return (p or {}).get("name") or (p or {}).get("company_name")


def invoice_row(doc: Document) -> dict[str, Any]:
    d = effective_data(doc) or {}
    meta, tot, seller, buyer = d.get("invoice_metadata") or {}, d.get("totals") or {}, d.get("seller") or {}, d.get("buyer") or {}
    pay = d.get("payment_details") or {}
    return {
        "file_name": doc.file_name,
        "invoice_number": meta.get("invoice_number"),
        "invoice_date": meta.get("invoice_date"),
        "due_date": meta.get("due_date"),
        "currency": meta.get("currency"),
        "seller_name": _name(seller),
        "seller_address": _address(seller),
        "seller_email": (seller.get("contact") or {}).get("email"),
        "buyer_name": _name(buyer),
        "buyer_address": _address(buyer),
        "subtotal": tot.get("subtotal"),
        "discount_total": tot.get("discount_total"),
        "tax_total": tot.get("tax_total"),
        "shipping_cost": tot.get("shipping_cost"),
        "other_charges": tot.get("other_charges"),
        "grand_total": tot.get("grand_total"),
        "amount_paid": tot.get("amount_paid"),
        "balance_due": tot.get("balance_due"),
        "payment_terms": pay.get("payment_terms"),
        "notes": d.get("notes"),
    }


def line_rows(doc: Document) -> list[dict[str, Any]]:
    d = effective_data(doc) or {}
    return list(d.get("line_items") or [])


def _stem(docs: list[Document]) -> str:
    if len(docs) == 1:
        base = docs[0].file_name.rsplit(".", 1)[0]
        return "".join(c if c.isalnum() or c in "-_ ." else "_" for c in base)[:80] or "invoice"
    return "invoices"


def to_json(docs: list[Document]) -> bytes:
    items = [
        {
            "id": str(d.id),
            "file_name": d.file_name,
            "edited": d.edited_data is not None,
            "warnings": d.warnings or [],
            "invoice_data": effective_data(d),
        }
        for d in docs
    ]
    payload: Any = items[0] if len(items) == 1 else {"count": len(items), "documents": items}
    return json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")


def to_csv(docs: list[Document]) -> bytes:
    """One row per line item, invoice fields repeated; invoices without line items get one row."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([h for _, h in INVOICE_COLUMNS] + [h for _, h in LINE_COLUMNS])
    for doc in docs:
        inv = invoice_row(doc)
        base = [_safe(inv[k]) for k, _ in INVOICE_COLUMNS]
        lines = line_rows(doc) or [{}]
        for li in lines:
            w.writerow(base + [_safe(li.get(k)) for k, _ in LINE_COLUMNS])
    return ("﻿" + buf.getvalue()).encode("utf-8")  # BOM so Excel reads UTF-8


def to_xlsx(docs: list[Document]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Invoices"
    ws.append([h for _, h in INVOICE_COLUMNS])
    li_ws = wb.create_sheet("Line items")
    li_ws.append(["File", "Invoice number"] + [h for _, h in LINE_COLUMNS])
    for doc in docs:
        inv = invoice_row(doc)
        ws.append([_safe(inv[k]) for k, _ in INVOICE_COLUMNS])
        for li in line_rows(doc):
            li_ws.append([_safe(doc.file_name), _safe(inv["invoice_number"])] + [_safe(li.get(k)) for k, _ in LINE_COLUMNS])
    for sheet in (ws, li_ws):
        for c in sheet[1]:
            c.font = Font(bold=True)
        sheet.freeze_panes = "A2"
        for i, col in enumerate(sheet.columns, start=1):
            width = max((len(str(c.value)) for c in col if c.value is not None), default=8)
            sheet.column_dimensions[get_column_letter(i)].width = min(48, max(10, width + 2))
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def build_export(docs: list[Document], fmt: str) -> ExportFile:
    builders = {"json": to_json, "csv": to_csv, "xlsx": to_xlsx}
    return ExportFile(builders[fmt](docs), FORMATS[fmt], f"{_stem(docs)}.{fmt}")
