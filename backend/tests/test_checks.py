from app.services.checks import run_checks


def codes(d):
    return [w["code"] for w in run_checks(d)]


def test_consistent_invoice_has_no_warnings():
    d = {"line_items": [{"line_total": 40}, {"line_total": 50}], "totals": {"subtotal": 90, "tax_total": 18, "grand_total": 108}}
    assert codes(d) == []


def test_line_totals_vs_subtotal():
    d = {"line_items": [{"line_total": 40}, {"line_total": 40}], "totals": {"subtotal": 90}}
    assert codes(d) == ["LINE_TOTALS_MISMATCH"]


def test_skipped_when_a_line_total_is_missing():
    assert codes({"line_items": [{"line_total": 40}, {"line_total": None}], "totals": {"subtotal": 90}}) == []


def test_grand_total_accepts_shipping_and_discount_arrangements():
    assert codes({"totals": {"subtotal": 100, "tax_total": 10, "shipping_cost": 5, "grand_total": 115}}) == []
    assert codes({"totals": {"subtotal": 100, "discount_total": 10, "tax_total": 9, "grand_total": 99}}) == []
    assert codes({"totals": {"subtotal": 100, "tax_total": 10, "grand_total": 200}}) == ["GRAND_TOTAL_MISMATCH"]


def test_rounding_tolerance():
    assert codes({"totals": {"subtotal": 100.0, "tax_total": 20.0, "grand_total": 120.01}}) == []


def test_missing_total_is_not_zero():
    assert codes({"totals": {"subtotal": None, "grand_total": None}}) == []
    assert codes({"totals": {"subtotal": 50, "tax_total": None, "grand_total": 50}}) == []


def test_due_before_issue_and_unparseable_dates():
    assert codes({"invoice_metadata": {"invoice_date": "2026-05-10", "due_date": "2026-04-01"}}) == ["DUE_BEFORE_ISSUE"]
    assert codes({"invoice_metadata": {"invoice_date": "10 May 2026", "due_date": "1 April"}}) == []
    assert codes({"invoice_metadata": {"invoice_date": "2026-05-10", "due_date": None}}) == []


def test_empty_input():
    assert run_checks(None) == [] and run_checks({}) == []
