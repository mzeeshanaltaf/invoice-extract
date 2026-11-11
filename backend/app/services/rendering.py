"""PDF pages / images -> normalised images for the vision model, plus the PDF text-layer hint."""

from __future__ import annotations

import io
import threading
from dataclasses import dataclass

import pypdfium2 as pdfium
from PIL import Image, ImageOps

from app.config import settings

# pdfium is not thread-safe; rendering runs in worker threads, so serialise access.
PDFIUM_LOCK = threading.RLock()


@dataclass
class RenderedPage:
    data: bytes
    mime: str
    width: int
    height: int


@dataclass
class Rendered:
    pages: list[RenderedPage]
    text_hint: str


def _fit(img: Image.Image, max_edge: int) -> Image.Image:
    longest = max(img.size)
    if longest > max_edge:
        scale = max_edge / longest
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    return img


def _encode(img: Image.Image, fmt: str) -> RenderedPage:
    buf = io.BytesIO()
    if fmt == "JPEG":
        img.convert("RGB").save(buf, "JPEG", quality=90, optimize=True)
        mime = "image/jpeg"
    else:
        img.convert("RGB").save(buf, "PNG", optimize=True)
        mime = "image/png"
    return RenderedPage(buf.getvalue(), mime, img.width, img.height)


def render_pdf(data: bytes) -> Rendered:
    pages: list[RenderedPage] = []
    hints: list[str] = []
    with PDFIUM_LOCK:
        pdf = pdfium.PdfDocument(data)
        try:
            for i in range(len(pdf)):
                page = pdf[i]
                try:
                    bitmap = page.render(scale=settings.RENDER_DPI / 72)
                    img = _fit(bitmap.to_pil(), settings.RENDER_MAX_EDGE)
                    pages.append(_encode(img, "PNG"))
                    textpage = page.get_textpage()
                    try:
                        t = textpage.get_text_bounded().strip()
                    finally:
                        textpage.close()
                    if t:
                        hints.append(f"--- page {i + 1} ---\n{t}")
                finally:
                    page.close()
        finally:
            pdf.close()
    return Rendered(pages, "\n\n".join(hints)[: settings.TEXT_HINT_MAX_CHARS])


def render_image(data: bytes) -> Rendered:
    with Image.open(io.BytesIO(data)) as im:
        im = ImageOps.exif_transpose(im)
        im.load()
        img = _fit(im, settings.RENDER_MAX_EDGE)
        return Rendered([_encode(img, "JPEG")], "")


def render(data: bytes, mime_type: str) -> Rendered:
    return render_pdf(data) if mime_type == "application/pdf" else render_image(data)
