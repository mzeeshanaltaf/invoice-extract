/**
 * Shapes returned by the InvoicExtract API (FastAPI service in `backend/`).
 * Contract notes live in docs/plan/HANDOFF.md (Phase 1 entry).
 */

/* ─── Analytics ─────────────────────────────────────────────────── */

export interface UserAnalytics {
  total_documents_processed: number;
  total_pages_processed: number;
  total_pdfs_processed: number;
  total_images_processed: number;
}

/* ─── Credits ──────────────────────────────────────────────────── */

export interface Credits {
  current_balance: number;
  /** Reserved by documents that are still in flight; released on completion. */
  held: number;
  /** current_balance - held: what a new upload can spend. */
  available: number;
}

export type CreditTransactionType =
  | "signup_bonus"
  | "document_processing"
  | "refund"
  | "manual_adjustment";

export interface CreditTransaction {
  transaction_id: string;
  transaction_type: CreditTransactionType | string;
  credits_delta: number;
  reference_file_id: string | null;
  file_name_snapshot: string | null;
  description: string;
  created_at: string;
}

export interface TransactionsResponse {
  items: CreditTransaction[];
  total: number;
  limit: number;
  offset: number;
}

/* ─── Documents ────────────────────────────────────────────────── */

export type DocumentStatus =
  | "queued"
  | "validating"
  | "extracting"
  | "processed"
  | "rejected"
  | "failed";

export const IN_FLIGHT_STATUSES: readonly DocumentStatus[] = [
  "queued",
  "validating",
  "extracting",
];

export function isInFlight(status: string): boolean {
  return (IN_FLIGHT_STATUSES as readonly string[]).includes(status);
}

export interface DocumentSummaryFields {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string | null;
  seller_name: string | null;
  buyer_name: string | null;
  grand_total: number | null;
}

export interface DocumentSourceDetail {
  sender?: string | null;
  subject?: string | null;
  inbound_email_id?: string | null;
}

export interface UserDocument {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  num_pages: number;
  status: DocumentStatus;
  /** Human-readable reason for `rejected` / `failed`. */
  status_detail: string | null;
  /** NOT_AN_INVOICE | UNREADABLE when `rejected`. */
  error_code: string | null;
  source: "upload" | "email" | string;
  source_detail: DocumentSourceDetail | null;
  file_available: boolean;
  file_deleted_at: string | null;
  edited: boolean;
  warning_count: number;
  created_at: string;
  updated_at: string | null;
  processed_at: string | null;
  /** Only when processed; reflects edited data when present. */
  summary: DocumentSummaryFields | null;
}

export interface DocumentListResponse {
  items: UserDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface OverviewResponse {
  remaining_credit: number;
  credits: Credits;
  credit_history: CreditTransaction[];
  user_analytics: UserAnalytics;
  user_documents: UserDocument[];
  documents_total: number;
}

export interface DocumentGate {
  probability: number | null;
  document_type: string | null;
  legibility: number | null;
  accepted: boolean | null;
  reason_code: string | null;
}

export type WarningCode =
  | "LINE_TOTALS_MISMATCH"
  | "GRAND_TOTAL_MISMATCH"
  | "DUE_BEFORE_ISSUE";

export interface DocumentWarning {
  code: WarningCode | string;
  message: string;
  fields: string[];
}

export interface DocumentDetail extends UserDocument {
  gate: DocumentGate | null;
  markdown_text: string | null;
  /** Model output; never overwritten by edits. */
  invoice_data: InvoiceData | null;
  /** User corrections; null until the document is edited. */
  edited_data: InvoiceData | null;
  /** edited_data ?? invoice_data. Render this. */
  current_data: InvoiceData | null;
  confidence: "high" | "medium" | "low" | string | null;
  description: string | null;
  detected_signals: string[];
  warnings: DocumentWarning[];
  usage: Record<string, unknown> | null;
}

/* ─── Upload ───────────────────────────────────────────────────── */

export interface UploadFileResult {
  file_name: string;
  success: boolean;
  document_id: string | null;
  status: "queued" | null;
  error_code: string | null;
  message: string | null;
  details: Record<string, unknown>;
}

export interface UploadResponse {
  results: UploadFileResult[];
  accepted: number;
  rejected: number;
}

export interface DeleteDocumentsResponse {
  deleted: number;
  ids: string[];
}

export type ExportFormat = "json" | "csv" | "xlsx";

/* ─── Settings / limits / account ──────────────────────────────── */

export interface UserSettings {
  /** null = keep source files forever. */
  retention_days: number | null;
  retention_choices_days: number[];
  inbound_enabled: boolean;
  /** null when the server has no INBOUND_EMAIL_DOMAIN. */
  inbound_address: string | null;
  inbound_available: boolean;
}

export interface UserSettingsPatch {
  retention_days?: number | null;
  inbound_enabled?: boolean;
}

export interface ApiLimits {
  max_file_mb: number;
  max_pdf_pages: number;
  max_files_per_upload: number;
  max_inflight_per_user: number;
  uploads_per_hour: number;
  accepted_types: string[];
  credits_per_page: number;
  signup_credits: number;
  retention_choices_days: number[];
  inbound_email_enabled: boolean;
  inbound_email_domain: string | null;
  inbound_max_attachments: number;
  export_formats: string[];
}

export interface DeleteAccountResponse {
  deleted: boolean;
  documents_deleted: number;
}

/* ─── Invoice data (structured extraction result) ──────────────── */
// Every leaf is nullable: null = not on the document, 0 = a printed zero.

export interface InvoiceMetadata {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string | null;
}

export interface InvoiceAddress {
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

export interface InvoiceContact {
  phone: string | null;
  email: string | null;
  website: string | null;
}

export interface InvoiceParty {
  /** Primary name (the business name for businesses). */
  name: string | null;
  /** Only when a person and a company both appear. */
  company_name: string | null;
  address: InvoiceAddress;
  contact: InvoiceContact;
}

export interface InvoiceLineItem {
  line_number: number | null;
  item_code: string | null;
  description: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_price: number | null;
  discount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  line_total: number | null;
}

export interface InvoiceTotals {
  subtotal: number | null;
  discount_total: number | null;
  tax_total: number | null;
  shipping_cost: number | null;
  other_charges: number | null;
  grand_total: number | null;
  amount_paid: number | null;
  balance_due: number | null;
}

export interface InvoiceBankDetails {
  bank_name: string | null;
  account_number: string | null;
  iban: string | null;
  swift_bic: string | null;
}

export interface InvoicePaymentDetails {
  payment_terms: string | null;
  payment_method: string | null;
  bank_details: InvoiceBankDetails;
}

export interface InvoiceData {
  invoice_metadata: InvoiceMetadata;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  line_items: InvoiceLineItem[];
  totals: InvoiceTotals;
  payment_details: InvoicePaymentDetails;
  notes: string | null;
}
