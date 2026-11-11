"""initial: documents, user_settings, inbound_emails, credit_accounts, credit_transactions

Creates only the new tables. Better Auth tables and the old n8n tables
(user_documents, user_credit_accounts, user_credit_transactions) are not touched.

Revision ID: 0001
Revises:
Create Date: 2026-11-11
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

S = "invoice_extract"
NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "credit_accounts",
        sa.Column("user_id", sa.Text(), primary_key=True),
        sa.Column("balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.CheckConstraint("balance >= 0", name="ck_credit_accounts_balance"),
        schema=S,
    )

    op.create_table(
        "documents",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("file_name", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("num_pages", sa.Integer(), nullable=False),
        sa.Column("checksum", sa.Text(), nullable=False),
        sa.Column("storage_key", sa.Text()),
        sa.Column("source", sa.Text(), nullable=False, server_default="upload"),
        sa.Column("source_detail", pg.JSONB()),
        sa.Column("file_deleted_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.Text(), nullable=False, server_default="queued"),
        sa.Column("status_detail", sa.Text()),
        sa.Column("gate", pg.JSONB()),
        sa.Column("markdown_text", sa.Text()),
        sa.Column("invoice_data", pg.JSONB()),
        sa.Column("extraction_meta", pg.JSONB()),
        sa.Column("edited_data", pg.JSONB()),
        sa.Column("warnings", pg.JSONB()),
        sa.Column("usage", pg.JSONB()),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("user_id", "checksum", name="uq_documents_user_checksum"),
        sa.CheckConstraint(
            "status IN ('queued','validating','extracting','processed','rejected','failed')", name="ck_documents_status"
        ),
        sa.CheckConstraint("source IN ('upload','email')", name="ck_documents_source"),
        schema=S,
    )
    op.create_index("ix_documents_user_created", "documents", ["user_id", "created_at"], schema=S)
    op.create_index("ix_documents_status", "documents", ["status"], schema=S)

    op.create_table(
        "credit_transactions",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("transaction_type", sa.Text(), nullable=False),
        sa.Column("credits_delta", sa.Integer(), nullable=False),
        sa.Column("reference_document_id", pg.UUID(as_uuid=True)),
        sa.Column("file_name_snapshot", sa.Text()),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.ForeignKeyConstraint([ "user_id"], [f"{S}.credit_accounts.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reference_document_id"], [f"{S}.documents.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "transaction_type IN ('signup_bonus','document_processing','refund','manual_adjustment')",
            name="ck_credit_transactions_type",
        ),
        sa.CheckConstraint("credits_delta <> 0", name="ck_credit_transactions_delta"),
        schema=S,
    )
    op.create_index("ix_credit_transactions_user_created", "credit_transactions", ["user_id", "created_at"], schema=S)

    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.Text(), primary_key=True),
        sa.Column("retention_days", sa.Integer()),
        sa.Column("inbound_token", sa.Text(), nullable=False, unique=True),
        sa.Column("inbound_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        schema=S,
    )

    op.create_table(
        "inbound_emails",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("from_address", sa.Text()),
        sa.Column("subject", sa.Text()),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("result", pg.JSONB()),
        sa.Column("reply_sent_at", sa.DateTime(timezone=True)),
        schema=S,
    )
    op.create_index("ix_inbound_emails_user_received", "inbound_emails", ["user_id", "received_at"], schema=S)


def downgrade() -> None:
    for t in ("inbound_emails", "user_settings", "credit_transactions", "documents", "credit_accounts"):
        op.drop_table(t, schema=S)
