"""Test helpers: file builders and a scriptable fake OpenAI client."""

from __future__ import annotations

import base64
import io
import uuid
from types import SimpleNamespace
from typing import Any, Callable

import httpx
import openai
from openai.types.decision import (
    AnswerAnswerResourceChoice,
    AnswerAnswerResourceChoiceProbability,
    AnswerAnswerResourcePredicate,
    AnswerAnswerResourceScore,
    Decision,
    Usage,
    UsageInputTokensDetails,
    UsageOutputTokensDetails,
)
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.pdfencrypt import StandardEncryption
from reportlab.pdfgen import canvas

from app.schemas_invoice import ExtractionResult, InvoiceData


# ------------------------------------------------------------------ files ----


def make_pdf(pages: int = 1, tag: str | None = None, encrypt: str | None = None) -> bytes:
    """A small text PDF. `tag` makes the bytes unique so the checksum differs."""
    tag = tag or uuid.uuid4().hex
    buf = io.BytesIO()
    kwargs = {"encrypt": StandardEncryption(encrypt, canPrint=0)} if encrypt else {}
    c = canvas.Canvas(buf, pagesize=A4, **kwargs)
    for i in range(pages):
        c.setFont("Helvetica", 14)
        c.drawString(60, 780, f"INVOICE INV-{tag[:8]}  page {i + 1}")
        c.drawString(60, 750, "Widget A  4 x 10.00 = 40.00")
        c.drawString(60, 730, "Widget B  2 x 25.00 = 50.00")
        c.drawString(60, 700, "Subtotal 90.00  VAT 18.00  TOTAL 108.00")
        c.showPage()
    c.save()
    return buf.getvalue()


def make_png(w: int = 700, h: int = 900, color: tuple[int, int, int] = (250, 250, 250), tag: str | None = None) -> bytes:
    img = Image.new("RGB", (w, h), color)
    if tag:
        img.putpixel((1, 1), (int(tag, 16) % 255, 7, 7))  # make bytes unique
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def make_jpeg(w: int = 700, h: int = 900, color: tuple[int, int, int] = (240, 240, 240)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "JPEG")
    return buf.getvalue()


def upload_files(*items: tuple[str, bytes, str]) -> list[tuple[str, tuple[str, bytes, str]]]:
    return [("files", it) for it in items]


# ------------------------------------------------------------- fake OpenAI ----

NON_INVOICE_COLOR = (255, 0, 0)  # an image whose pixel (0,0) is pure red is "not an invoice"


def sample_result(**overrides: Any) -> ExtractionResult:
    data = InvoiceData.model_validate(
        {
            "invoice_metadata": {"invoice_number": "INV-2026-0042", "invoice_date": "2026-03-14", "due_date": "2026-04-13", "currency": "GBP"},
            "seller": {"name": "ACME SUPPLIES LTD", "address": {"city": "Leeds", "country": "UK"}},
            "buyer": {"name": "Northwind Traders"},
            "line_items": [
                {"line_number": 1, "description": "Widget A", "quantity": 4, "unit_price": 10, "line_total": 40},
                {"line_number": 2, "description": "Widget B", "quantity": 2, "unit_price": 25, "line_total": 50},
            ],
            "totals": {"subtotal": 90, "tax_total": 18, "grand_total": 108},
        }
    )
    base = dict(markdown_text="# Invoice INV-2026-0042", invoice_data=data, confidence="high", detected_signals=["INVOICE"], description="An invoice.")
    base.update(overrides)
    return ExtractionResult(**base)


def rate_limit_error(msg: str = "resource unavailable") -> openai.RateLimitError:
    req = httpx.Request("POST", "https://api.openai.com/v1/responses")
    return openai.RateLimitError(msg, response=httpx.Response(429, request=req), body=None)


def timeout_error() -> openai.APITimeoutError:
    return openai.APITimeoutError(request=httpx.Request("POST", "https://api.openai.com/v1/responses"))


def bad_request_error() -> openai.BadRequestError:
    req = httpx.Request("POST", "https://api.openai.com/v1/responses")
    return openai.BadRequestError("bad", response=httpx.Response(400, request=req), body=None)


class FakeOpenAI:
    """Scriptable stand-in for AsyncOpenAI (decisions.create + responses.parse)."""

    def __init__(self) -> None:
        self.decisions = SimpleNamespace(create=self._decide)
        self.responses = SimpleNamespace(parse=self._parse)
        self.gate_calls = 0
        self.parse_tiers: list[str | None] = []
        self.gate_error: Exception | None = None
        self.legibility = 3.0
        self.is_invoice_probability = 0.98
        self.result: ExtractionResult = sample_result()
        # per-call script for responses.parse: Exception -> raised, str -> succeed reporting that tier
        self.parse_script: list[Exception | str] = []
        self.parse_hook: Callable[[], Any] | None = None

    @staticmethod
    def _first_pixel_is_red(content: list[dict[str, Any]]) -> bool:
        try:
            url = next(p["image_url"] for p in content if p.get("type") == "input_image")
            raw = base64.b64decode(url.split(",", 1)[1])
            with Image.open(io.BytesIO(raw)) as im:
                r, g, b = im.convert("RGB").getpixel((0, 0))
                return r > 200 and g < 60 and b < 60  # tolerant of JPEG re-encoding
        except Exception:  # noqa: BLE001
            return False

    async def _decide(self, *, model: str, input: list[dict[str, Any]], questions: list[dict[str, Any]], **_: Any) -> Decision:
        self.gate_calls += 1
        if self.gate_error:
            raise self.gate_error
        red = self._first_pixel_is_red(input[0]["content"])
        prob = 0.02 if red else self.is_invoice_probability
        dtype = "other" if red else "invoice"
        return Decision(
            model=model,
            answers=[
                AnswerAnswerResourcePredicate(name="is_invoice", probability=prob, type="predicate"),
                AnswerAnswerResourceChoice(
                    name="document_type",
                    choice=dtype,
                    confidence=0.9,
                    probabilities=[AnswerAnswerResourceChoiceProbability(probability=1.0, value=dtype)],
                    type="choice",
                ),
                AnswerAnswerResourceScore(name="legibility", score=self.legibility, confidence=0.9, probabilities=[], type="score"),
            ],
            usage=Usage(
                input_tokens=100,
                output_tokens=0,
                total_tokens=100,
                input_tokens_details=UsageInputTokensDetails(cache_write_tokens=0, cached_tokens=0),
                output_tokens_details=UsageOutputTokensDetails(reasoning_tokens=0),
            ),
        )

    async def _parse(self, *, service_tier: str | None = None, **_: Any) -> Any:
        self.parse_tiers.append(service_tier)
        if self.parse_hook:
            await self.parse_hook()
        step: Exception | str | None = self.parse_script.pop(0) if self.parse_script else None
        if isinstance(step, Exception):
            raise step
        tier = step if isinstance(step, str) else (service_tier or "default")
        return SimpleNamespace(
            output_parsed=self.result,
            service_tier=tier,
            usage=SimpleNamespace(input_tokens=1000, output_tokens=200),
        )
