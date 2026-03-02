/* ─── Analytics ─────────────────────────────────────────────────── */

export interface UserAnalytics {
  total_documents_processed: string;
  total_pages_processed: string;
  total_pdfs_processed: string;
  total_images_processed: string;
}

/* ─── Credits ──────────────────────────────────────────────────── */

export interface CreditBalance {
  current_balance: number;
}

export interface CreditTransaction {
  transaction_id: string;
  user_id: string;
  transaction_type: string;
  credits_delta: number;
  reference_file_id: string | null;
  file_name_snapshot: string | null;
  description: string;
  created_at: string;
}

export interface SignupCreditsResponse {
  success: boolean;
  status: string;
  message: string;
}

/* ─── OCR ──────────────────────────────────────────────────────── */

export interface OcrResponse {
  success: boolean;
  status: string;
  message: string;
}

/* ─── Documents ────────────────────────────────────────────────── */

export interface UserDocument {
  file_id: string;
  file_name: string;
  mime_type: string;
  file_size: string;
  file_base64: string;
}

/* ─── Invoice Object (structured extraction result) ────────────── */

/**
 * Party (issuer or client) — flat structure from AI extraction.
 * `address` is a single string, contact fields are top-level.
 */
export interface InvoiceParty {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface InvoiceTax {
  rate?: number;
  amount?: number;
}

export interface InvoiceLineItem {
  amount: number;
  quantity: number;
  unit_price: number;
  description: string;
}

export interface InvoiceBankDetails {
  account_name: string;
  account_number: string;
}

/**
 * invoice_data — the actual shape returned by the n8n Mistral AI extraction.
 * All financial fields are top-level (not nested under a `financials` object).
 */
export interface InvoiceData {
  notes?: string;
  client?: InvoiceParty;
  issuer?: InvoiceParty;
  tax?: InvoiceTax;
  currency?: string;
  subtotal?: number;
  amount_due?: number;
  total_amount?: number;
  issue_date?: string;
  due_date?: string | null;
  line_items?: InvoiceLineItem[];
  invoice_number?: string;
  banking_details?: InvoiceBankDetails;
  bank_details?: InvoiceBankDetails;
}

export interface InvoiceObject {
  confidence: string;
  description: string;
  invoice_data: InvoiceData;
  detected_signals?: string[];
  is_invoice_related: boolean;
}

export interface MarkdownInvoiceResponse {
  markdown_text: string;
  file_name: string;
  file_size: string;
  num_pages: number;
  invoice_object: InvoiceObject;
  file_id: string;
}
