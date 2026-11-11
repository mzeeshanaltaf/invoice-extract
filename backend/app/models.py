"""SQLAlchemy models. New tables only; Better Auth and the old n8n tables are never touched."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import settings

metadata = MetaData(schema=settings.DB_SCHEMA)

STATUSES = ("queued", "validating", "extracting", "processed", "rejected", "failed")
IN_FLIGHT = ("queued", "validating", "extracting")
TERMINAL = ("processed", "rejected", "failed")
TRANSACTION_TYPES = ("signup_bonus", "document_processing", "refund", "manual_adjustment")


class Base(DeclarativeBase):
    metadata = metadata


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("user_id", "checksum", name="uq_documents_user_checksum"),
        CheckConstraint(
            "status IN ('queued','validating','extracting','processed','rejected','failed')",
            name="ck_documents_status",
        ),
        CheckConstraint("source IN ('upload','email')", name="ck_documents_source"),
        Index("ix_documents_user_created", "user_id", "created_at"),
        Index("ix_documents_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    num_pages: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    checksum: Mapped[str] = mapped_column(Text, nullable=False)
    storage_key: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text, nullable=False, default="upload", server_default="upload")
    source_detail: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    file_deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Text, nullable=False, default="queued", server_default="queued")
    status_detail: Mapped[str | None] = mapped_column(Text)
    gate: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    markdown_text: Mapped[str | None] = mapped_column(Text)
    invoice_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    extraction_meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    edited_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    warnings: Mapped[list[Any] | None] = mapped_column(JSONB)
    usage: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    retention_days: Mapped[int | None] = mapped_column(Integer)
    inbound_token: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    inbound_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class InboundEmail(Base):
    __tablename__ = "inbound_emails"
    __table_args__ = (Index("ix_inbound_emails_user_received", "user_id", "received_at"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # Resend email id
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    from_address: Mapped[str | None] = mapped_column(Text)
    subject: Mapped[str | None] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    result: Mapped[list[Any] | None] = mapped_column(JSONB)
    reply_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CreditAccount(Base):
    __tablename__ = "credit_accounts"
    __table_args__ = (CheckConstraint("balance >= 0", name="ck_credit_accounts_balance"),)

    user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"
    __table_args__ = (
        CheckConstraint(
            "transaction_type IN ('signup_bonus','document_processing','refund','manual_adjustment')",
            name="ck_credit_transactions_type",
        ),
        CheckConstraint("credits_delta <> 0", name="ck_credit_transactions_delta"),
        Index("ix_credit_transactions_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(
        Text, ForeignKey(f"{settings.DB_SCHEMA}.credit_accounts.user_id", ondelete="CASCADE"), nullable=False
    )
    transaction_type: Mapped[str] = mapped_column(Text, nullable=False)
    credits_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{settings.DB_SCHEMA}.documents.id", ondelete="SET NULL")
    )
    file_name_snapshot: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
