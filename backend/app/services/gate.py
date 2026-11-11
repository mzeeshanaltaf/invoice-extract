"""Invoice gate: the Decisions API decides whether a document is an invoice and legible."""

from __future__ import annotations

import base64
from dataclasses import dataclass, field
from typing import Any

from app.config import settings
from app.services.openai_client import get_client
from app.services.rendering import RenderedPage

GATE_PAGES = 2
DOC_TYPES = ("invoice", "receipt", "credit_note", "other")
INVOICE_LIKE = {"invoice", "receipt", "credit_note"}
LEGIBILITY_LEVELS = ("unreadable", "poor", "fair", "good")

QUESTIONS: list[dict[str, Any]] = [
    {
        "type": "predicate",
        "name": "is_invoice",
        "instructions": "Is this an invoice, bill, receipt or credit note (a document requesting or confirming payment for goods or services)?",
    },
    {
        "type": "choice",
        "name": "document_type",
        "instructions": "Which kind of document is this?",
        "choices": [{"value": v} for v in DOC_TYPES],
    },
    {
        "type": "score",
        "name": "legibility",
        "instructions": "How legible is the printed text: could every line, number and total be read reliably?",
        "levels": [{"label": v} for v in LEGIBILITY_LEVELS],
    },
]


class GateError(Exception):
    """The gate could not produce an answer (treated as a retryable failure, not a rejection)."""


@dataclass
class GateResult:
    accepted: bool
    probability: float
    document_type: str | None
    legibility: float | None
    reason_code: str | None = None  # NOT_AN_INVOICE | UNREADABLE
    reason: str | None = None
    usage: dict[str, Any] = field(default_factory=dict)

    def as_json(self) -> dict[str, Any]:
        return {
            "probability": self.probability,
            "document_type": self.document_type,
            "legibility": self.legibility,
            "accepted": self.accepted,
            "reason_code": self.reason_code,
        }


NOT_INVOICE_MSG = "This doesn't look like an invoice, bill, receipt or credit note, so it wasn't processed and no credits were used."
UNREADABLE_MSG = "The text in this file is too blurry or dark to read reliably. Retake the photo (or upload a clearer scan) and try again. No credits were used."


def decide(probability: float, document_type: str | None, legibility: float | None) -> GateResult:
    not_invoice = probability < settings.INVOICE_MIN_PROBABILITY
    unreadable = legibility is not None and legibility < settings.LEGIBILITY_MIN_SCORE
    if not_invoice and unreadable and document_type in INVOICE_LIKE:
        # looks like an invoice but cannot be read: ask for a better photo
        return GateResult(False, probability, document_type, legibility, "UNREADABLE", UNREADABLE_MSG)
    if not_invoice:
        return GateResult(False, probability, document_type, legibility, "NOT_AN_INVOICE", NOT_INVOICE_MSG)
    if unreadable:
        return GateResult(False, probability, document_type, legibility, "UNREADABLE", UNREADABLE_MSG)
    return GateResult(True, probability, document_type, legibility)


def _image_part(page: RenderedPage) -> dict[str, Any]:
    url = f"data:{page.mime};base64,{base64.b64encode(page.data).decode()}"
    return {"type": "input_image", "image_url": url, "detail": "auto"}


async def run_gate(pages: list[RenderedPage]) -> GateResult:
    content = [_image_part(p) for p in pages[:GATE_PAGES]]
    try:
        decision = await get_client().decisions.create(
            model=settings.OPENAI_DECISIONS_MODEL,
            input=[{"role": "user", "content": content}],
            questions=QUESTIONS,
        )
    except Exception as e:  # noqa: BLE001
        raise GateError(f"{type(e).__name__}: {str(e)[:300]}") from e

    by_name = {getattr(a, "name", None): a for a in decision.answers}
    pred, choice, score = by_name.get("is_invoice"), by_name.get("document_type"), by_name.get("legibility")
    if pred is None or getattr(pred, "type", None) != "predicate":
        raise GateError("Decisions API returned no answer for the invoice question")
    document_type = choice.choice if choice is not None and getattr(choice, "type", None) == "choice" else None
    legibility = score.score if score is not None and getattr(score, "type", None) == "score" else None
    result = decide(float(pred.probability), document_type if isinstance(document_type, str) else None, legibility)
    usage = getattr(decision, "usage", None)
    result.usage = {"input_tokens": getattr(usage, "input_tokens", None), "model": getattr(decision, "model", None)}
    return result
