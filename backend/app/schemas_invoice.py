"""Invoice schema (mirrors src/lib/types.ts). Fields are nullable so "missing" and "zero" differ.

Used both as the OpenAI structured-output format (every field required + nullable, as strict mode
demands) and to validate user edits.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Address(_Strict):
    street: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None


class Contact(_Strict):
    phone: str | None = None
    email: str | None = None
    website: str | None = None


class Party(_Strict):
    name: str | None = None
    company_name: str | None = None
    address: Address = Field(default_factory=Address)
    contact: Contact = Field(default_factory=Contact)


class InvoiceMetadata(_Strict):
    invoice_number: str | None = None
    invoice_date: str | None = None
    due_date: str | None = None
    currency: str | None = None


class LineItem(_Strict):
    line_number: int | None = None
    item_code: str | None = None
    description: str | None = None
    quantity: float | None = None
    unit_of_measure: str | None = None
    unit_price: float | None = None
    discount: float | None = None
    tax_rate: float | None = None
    tax_amount: float | None = None
    line_total: float | None = None


class Totals(_Strict):
    subtotal: float | None = None
    discount_total: float | None = None
    tax_total: float | None = None
    shipping_cost: float | None = None
    other_charges: float | None = None
    grand_total: float | None = None
    amount_paid: float | None = None
    balance_due: float | None = None


class BankDetails(_Strict):
    bank_name: str | None = None
    account_number: str | None = None
    iban: str | None = None
    swift_bic: str | None = None


class PaymentDetails(_Strict):
    payment_terms: str | None = None
    payment_method: str | None = None
    bank_details: BankDetails = Field(default_factory=BankDetails)


class InvoiceData(_Strict):
    invoice_metadata: InvoiceMetadata = Field(default_factory=InvoiceMetadata)
    seller: Party = Field(default_factory=Party)
    buyer: Party = Field(default_factory=Party)
    line_items: list[LineItem] = Field(default_factory=list)
    totals: Totals = Field(default_factory=Totals)
    payment_details: PaymentDetails = Field(default_factory=PaymentDetails)
    notes: str | None = None


class ExtractionResult(_Strict):
    """What the model returns for one document."""

    markdown_text: str
    invoice_data: InvoiceData
    confidence: Literal["high", "medium", "low"]
    detected_signals: list[str]
    description: str
