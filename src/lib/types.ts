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

export interface InvoiceMetadata {
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string | null;
  currency?: string;
}

export interface InvoiceAddress {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface InvoiceContact {
  phone?: string;
  email?: string;
  website?: string;
}

export interface InvoiceParty {
  name?: string;
  company_name?: string;
  address?: InvoiceAddress;
  contact?: InvoiceContact;
}

export interface InvoiceLineItem {
  line_number?: number;
  item_code?: string;
  description: string;
  quantity: number;
  unit_of_measure?: string;
  unit_price?: number;
  discount?: number;
  tax_rate?: number;
  tax_amount?: number;
  line_total?: number;
}

export interface InvoiceTotals {
  subtotal?: number;
  discount_total?: number;
  tax_total?: number;
  shipping_cost?: number;
  other_charges?: number;
  grand_total?: number;
  amount_paid?: number;
  balance_due?: number;
}

export interface InvoiceBankDetails {
  bank_name?: string;
  account_number?: string;
  iban?: string;
  swift_bic?: string;
}

export interface InvoicePaymentDetails {
  payment_terms?: string;
  payment_method?: string;
  bank_details?: InvoiceBankDetails;
}

export interface InvoiceData {
  invoice_metadata?: InvoiceMetadata;
  seller?: InvoiceParty;
  buyer?: InvoiceParty;
  line_items?: InvoiceLineItem[];
  totals?: InvoiceTotals;
  payment_details?: InvoicePaymentDetails;
  notes?: string;
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
