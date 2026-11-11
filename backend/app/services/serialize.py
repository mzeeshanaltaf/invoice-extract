"""Document -> JSON response shapes (the contract the front end consumes)."""

from __future__ import annotations

from typing import Any

from app.models import Document


def effective_data(doc: Document) -> dict[str, Any] | None:
    """The user's corrections when present, otherwise the model output."""
    return doc.edited_data if doc.edited_data is not None else doc.invoice_data


def _party_name(p: dict[str, Any] | None) -> str | None:
    if not p:
        return None
    return p.get("name") or p.get("company_name")


def summary_fields(data: dict[str, Any] | None) -> dict[str, Any]:
    data = data or {}
    meta = data.get("invoice_metadata") or {}
    totals = data.get("totals") or {}
    return {
        "invoice_number": meta.get("invoice_number"),
        "invoice_date": meta.get("invoice_date"),
        "due_date": meta.get("due_date"),
        "currency": meta.get("currency"),
        "seller_name": _party_name(data.get("seller")),
        "buyer_name": _party_name(data.get("buyer")),
        "grand_total": totals.get("grand_total"),
    }


def _iso(v: Any) -> str | None:
    return v.isoformat() if v else None


def document_summary(doc: Document) -> dict[str, Any]:
    gate = doc.gate or {}
    return {
        "id": str(doc.id),
        "file_name": doc.file_name,
        "mime_type": doc.mime_type,
        "file_size": doc.file_size,
        "num_pages": doc.num_pages,
        "status": doc.status,
        "status_detail": doc.status_detail,
        "error_code": gate.get("reason_code") if doc.status == "rejected" else None,
        "source": doc.source,
        "source_detail": doc.source_detail,
        "file_available": doc.storage_key is not None,
        "file_deleted_at": _iso(doc.file_deleted_at),
        "edited": doc.edited_data is not None,
        "warning_count": len(doc.warnings or []),
        "created_at": _iso(doc.created_at),
        "updated_at": _iso(doc.updated_at),
        "processed_at": _iso(doc.processed_at),
        "summary": summary_fields(effective_data(doc)) if doc.status == "processed" else None,
    }


def document_detail(doc: Document) -> dict[str, Any]:
    out = document_summary(doc)
    meta = doc.extraction_meta or {}
    out.update(
        {
            "gate": doc.gate,
            "markdown_text": doc.markdown_text,
            "invoice_data": doc.invoice_data,  # model output, never overwritten by edits
            "edited_data": doc.edited_data,  # user corrections, null until edited
            "current_data": effective_data(doc),  # edited_data ?? invoice_data
            "confidence": meta.get("confidence"),
            "description": meta.get("description"),
            "detected_signals": meta.get("detected_signals") or [],
            "warnings": doc.warnings or [],
            "usage": doc.usage,
        }
    )
    return out
