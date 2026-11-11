"""Arithmetic sanity checks on extracted data. Mismatches become warnings, never failures."""

from __future__ import annotations

from datetime import date
from typing import Any


def _num(v: Any) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _close(a: float, b: float) -> bool:
    return abs(a - b) <= max(0.02, 0.005 * max(abs(a), abs(b)))


def _date(v: Any) -> date | None:
    if not isinstance(v, str):
        return None
    try:
        return date.fromisoformat(v.strip()[:10])
    except ValueError:
        return None


def run_checks(data: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not data:
        return []
    warnings: list[dict[str, Any]] = []
    totals = data.get("totals") or {}
    subtotal = _num(totals.get("subtotal"))
    tax = _num(totals.get("tax_total")) or 0.0
    discount = _num(totals.get("discount_total")) or 0.0
    shipping = _num(totals.get("shipping_cost")) or 0.0
    other = _num(totals.get("other_charges")) or 0.0
    grand = _num(totals.get("grand_total"))

    # 1. line totals vs subtotal
    items = data.get("line_items") or []
    line_totals = [_num(i.get("line_total")) for i in items]
    if subtotal is not None and items and all(t is not None for t in line_totals):
        s = sum(t for t in line_totals if t is not None)
        if not _close(s, subtotal) and not _close(s, subtotal + discount):
            warnings.append(
                {
                    "code": "LINE_TOTALS_MISMATCH",
                    "message": f"Line items add up to {s:.2f} but the subtotal reads {subtotal:.2f}.",
                    "fields": ["line_items", "totals.subtotal"],
                }
            )

    # 2. subtotal + tax vs grand total (accept the common discount/shipping arrangements)
    if subtotal is not None and grand is not None:
        candidates = {
            subtotal + tax,
            subtotal + tax + shipping + other,
            subtotal - discount + tax + shipping + other,
            subtotal - discount + tax,
            subtotal + tax + shipping + other - discount,
        }
        if not any(_close(c, grand) for c in candidates):
            warnings.append(
                {
                    "code": "GRAND_TOTAL_MISMATCH",
                    "message": f"Subtotal {subtotal:.2f} plus tax {tax:.2f} is {subtotal + tax:.2f} but the grand total reads {grand:.2f}.",
                    "fields": ["totals.subtotal", "totals.tax_total", "totals.grand_total"],
                }
            )

    # 3. due date before issue date
    meta = data.get("invoice_metadata") or {}
    issued, due = _date(meta.get("invoice_date")), _date(meta.get("due_date"))
    if issued and due and due < issued:
        warnings.append(
            {
                "code": "DUE_BEFORE_ISSUE",
                "message": f"Due date {due.isoformat()} is before the invoice date {issued.isoformat()}.",
                "fields": ["invoice_metadata.invoice_date", "invoice_metadata.due_date"],
            }
        )
    return warnings
