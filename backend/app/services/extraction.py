"""Structured extraction with the Responses API, including flex retry/backoff and tier fallback."""

from __future__ import annotations

import asyncio
import base64
import logging
import random
from dataclasses import dataclass
from typing import Any

import openai

from app.config import settings
from app.schemas_invoice import ExtractionResult
from app.services.openai_client import get_client
from app.services.rendering import RenderedPage

log = logging.getLogger(__name__)

INSTRUCTIONS = """You are an accounting data-entry specialist. You receive images of the pages of one invoice, bill, receipt or credit note (and sometimes the text layer of the PDF as a hint).

Return:
- markdown_text: a faithful Markdown transcription of the whole document (headings, tables as Markdown tables, all numbers exactly as printed).
- invoice_data: the structured fields.
- confidence: high, medium or low for the overall extraction.
- detected_signals: short list of the labels or keywords that show this is an invoice (e.g. "INVOICE NO", "BILL TO", "TOTAL").
- description: one or two sentences describing the document.

Rules:
- The page images are authoritative. The text layer, when given, is only a hint and may be incomplete or out of order.
- Use null for anything not present on the document. Never invent values. Use 0 only when the document actually shows zero.
- Numbers: plain numbers, no currency symbols or thousands separators ("$1,200.50" -> 1200.5). Percentages as plain numbers (20% -> 20).
- Dates: ISO YYYY-MM-DD when you can infer it unambiguously, otherwise the text as printed.
- currency: ISO 4217 code when inferable from symbols or text (USD, EUR, GBP, ...).
- Parties (seller, buyer): name is the party's primary name as printed (the business name for a business). company_name is only for when a separate person's name and a company name both appear (name = the person, company_name = the company); otherwise null.
- Addresses: split into street, city, state, postal_code, country; if you cannot split, put the whole text in street.
- line_items: one object per table row, line_number counting from 1. line_total is the printed row total.
- totals: subtotal is before tax; grand_total is the final amount payable; balance_due is what remains unpaid.
- Do not add or rename fields."""


class ExtractionError(Exception):
    pass


@dataclass
class ExtractionOutcome:
    result: ExtractionResult
    usage: dict[str, Any]


def _is_insufficient_quota(e: Exception) -> bool:
    return getattr(e, "code", None) == "insufficient_quota" or "insufficient_quota" in str(e)


def _retryable(e: Exception) -> bool:
    if isinstance(e, (openai.APITimeoutError, openai.APIConnectionError, openai.InternalServerError)):
        return True
    if isinstance(e, openai.RateLimitError):
        return not _is_insufficient_quota(e)  # flex "resource unavailable" arrives as a 429
    return False


def _content(pages: list[RenderedPage], text_hint: str) -> list[dict[str, Any]]:
    intro = f"The document has {len(pages)} page image(s)."
    if text_hint:
        intro += f"\n\nPDF text layer (hint only):\n{text_hint}"
    content: list[dict[str, Any]] = [{"type": "input_text", "text": intro}]
    for p in pages:
        content.append(
            {
                "type": "input_image",
                "image_url": f"data:{p.mime};base64,{base64.b64encode(p.data).decode()}",
                "detail": "high",
            }
        )
    return content


async def _backoff(attempt: int) -> None:
    delay = min(settings.OPENAI_BACKOFF_MAX_SECONDS, settings.OPENAI_BACKOFF_BASE_SECONDS * (2**attempt))
    await asyncio.sleep(delay * random.uniform(0.5, 1.0) if delay else 0)


async def extract(pages: list[RenderedPage], text_hint: str) -> ExtractionOutcome:
    client = get_client()
    content = _content(pages, text_hint)
    primary = settings.OPENAI_SERVICE_TIER or None
    fallback = settings.OPENAI_FLEX_FALLBACK_TIER or None

    async def call(tier: str | None):
        kwargs: dict[str, Any] = {}
        if tier:
            kwargs["service_tier"] = tier
        if settings.OPENAI_REASONING_EFFORT:
            kwargs["reasoning"] = {"effort": settings.OPENAI_REASONING_EFFORT}
        return await client.responses.parse(
            model=settings.OPENAI_MODEL,
            instructions=INSTRUCTIONS,
            input=[{"role": "user", "content": content}],
            text_format=ExtractionResult,
            **kwargs,
        )

    primary_attempts = 0
    last_error: Exception | None = None
    response = None
    tier_requested = primary
    fallback_used = False

    for attempt in range(max(1, settings.OPENAI_FLEX_MAX_RETRIES)):
        primary_attempts += 1
        try:
            response = await call(primary)
            break
        except Exception as e:  # noqa: BLE001
            last_error = e
            if not _retryable(e):
                raise ExtractionError(f"{type(e).__name__}: {str(e)[:300]}") from e
            log.warning("extraction attempt %s on tier %s failed: %s", attempt + 1, primary, type(e).__name__)
            if attempt + 1 < settings.OPENAI_FLEX_MAX_RETRIES:
                await _backoff(attempt)

    if response is None and fallback and fallback != primary:
        fallback_used = True
        tier_requested = fallback
        try:
            response = await call(fallback)
        except Exception as e:  # noqa: BLE001
            last_error = e
    if response is None:
        raise ExtractionError(f"extraction failed after retries: {type(last_error).__name__}: {str(last_error)[:300]}")

    parsed = response.output_parsed
    if parsed is None:
        raise ExtractionError("the model returned no structured output")

    u = getattr(response, "usage", None)
    usage = {
        "model": settings.OPENAI_MODEL,
        "service_tier_requested": tier_requested,
        "service_tier_used": getattr(response, "service_tier", None) or tier_requested or "default",
        "primary_attempts": primary_attempts,
        "fallback_used": fallback_used,
        "input_tokens": getattr(u, "input_tokens", None),
        "output_tokens": getattr(u, "output_tokens", None),
    }
    return ExtractionOutcome(parsed, usage)
