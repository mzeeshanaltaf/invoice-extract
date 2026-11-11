"""Live probe: confirm the OpenAI SDK surface for Decisions + Responses (flex) on gpt-6-luna.

Run from backend/:  .venv/Scripts/python scripts/probe_openai.py
Needs OPENAI_API_KEY in backend/.env (gitignored). Prints no secrets.
"""

from __future__ import annotations

import base64
import io
import os
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw
from pydantic import BaseModel


def load_env() -> None:
    env = Path(__file__).resolve().parent.parent / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def make_invoice_png() -> bytes:
    img = Image.new("RGB", (800, 1000), "white")
    d = ImageDraw.Draw(img)
    rows = [
        "ACME SUPPLIES LTD",
        "12 Market Street, Leeds, LS1 4AB, UK",
        "",
        "INVOICE  INV-2026-0042",
        "Invoice date: 2026-03-14    Due date: 2026-04-13",
        "Bill to: Northwind Traders, 9 Dock Road, Bristol",
        "",
        "Description            Qty   Unit    Total",
        "Widget A                 4   10.00   40.00",
        "Widget B                 2   25.00   50.00",
        "",
        "Subtotal                          90.00",
        "VAT 20%                           18.00",
        "TOTAL GBP                        108.00",
    ]
    y = 60
    for r in rows:
        d.text((50, y), r, fill="black")
        y += 36
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


class Mini(BaseModel):
    invoice_number: str | None
    grand_total: float | None
    currency: str | None


def main() -> int:
    load_env()
    from openai import OpenAI

    client = OpenAI(timeout=900)
    png = make_invoice_png()
    data_url = "data:image/png;base64," + base64.b64encode(png).decode()

    print("== Decisions API via client.decisions.create ==")
    t = time.time()
    dec = client.decisions.create(
        model="gpt-6-luna",
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_image", "image_url": data_url, "detail": "auto"},
                ],
            }
        ],
        questions=[
            {
                "type": "predicate",
                "name": "is_invoice",
                "instructions": "Is this document an invoice, bill, receipt or credit note?",
            },
            {
                "type": "choice",
                "name": "document_type",
                "instructions": "What kind of document is this?",
                "choices": [
                    {"value": "invoice"},
                    {"value": "receipt"},
                    {"value": "credit_note"},
                    {"value": "other"},
                ],
            },
            {
                "type": "score",
                "name": "legibility",
                "instructions": "How legible is the text in this image?",
                "levels": [
                    {"label": "unreadable"},
                    {"label": "poor"},
                    {"label": "fair"},
                    {"label": "good"},
                ],
            },
        ],
    )
    print("elapsed", round(time.time() - t, 1), "s")
    for a in dec.answers:
        print(a.model_dump())
    print("usage", dec.usage.model_dump())

    print("== Responses API parse, service_tier=flex ==")
    for tier in ("flex", None):
        t = time.time()
        try:
            resp = client.responses.parse(
                model="gpt-6-luna",
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": "Extract the invoice fields."},
                            {"type": "input_image", "image_url": data_url},
                        ],
                    }
                ],
                text_format=Mini,
                reasoning={"effort": "low"},
                service_tier=tier,
            )
            print("tier requested", tier, "-> tier used", resp.service_tier)
            print("parsed", resp.output_parsed)
            print("usage", resp.usage.model_dump() if resp.usage else None)
        except Exception as e:  # noqa: BLE001
            print("tier", tier, "ERROR", type(e).__name__, str(e)[:400])
        print("elapsed", round(time.time() - t, 1), "s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
