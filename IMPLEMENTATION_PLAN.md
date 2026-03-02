# InvoiceExtract — Complete Implementation Plan

## Overview

**InvoiceExtract** is a SaaS application that lets users upload invoices (PDF/JPEG/PNG), validates them using AI, and extracts structured data returned as JSON. Users get 5 free credits on signup (1 credit = 1 page processed) and can view analytics on their usage.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, React 19, Turbopack) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 (OKLch color space, CSS variables) |
| Components | shadcn/ui (new-york style, 15 components) |
| Icons | Lucide React |
| Auth | Clerk (with Svix webhooks) |
| Backend | n8n workflows (7 webhook endpoints) |
| Theme | next-themes (dark/light/system) |

## Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=   # Clerk frontend key
CLERK_SECRET_KEY=                     # Clerk backend key
CLERK_WEBHOOK_SECRET=                 # Svix webhook verification
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL=/
N8N_API_KEY=                          # x-api-key header for n8n
N8N_WEBHOOK_BASE_URL=                 # Base URL for n8n webhooks
```

---

## Architecture

### Route Structure

```
/                                    (marketing) Public landing page
/dashboard                           (dashboard) Overview — stats, credits, recent activity
/dashboard/upload                    (dashboard) Upload invoice — drag-and-drop
/dashboard/documents                 (dashboard) List all processed documents
/dashboard/documents/[fileId]        (dashboard) Document detail — extracted invoice data
/dashboard/credits                   (dashboard) Credit balance + transaction history
/dashboard/settings                  (dashboard) Settings placeholder

/api/ocr                             POST   — Proxy: upload file → n8n OCR
/api/analytics                       GET    — Proxy: user analytics
/api/credits/balance                 GET    — Proxy: remaining credits
/api/credits/history                 GET    — Proxy: credit transactions
/api/documents                       GET    — Proxy: list user documents
/api/documents/[fileId]              GET    — Proxy: single document detail
/api/webhooks/clerk                  POST   — Clerk webhook (signup credits)
```

### Route Groups

- `(marketing)` — Public pages. No auth required. Contains landing page.
- `(dashboard)` — Protected pages. Clerk middleware enforces auth on `/dashboard(.*)`.

### Data Flow

```
Browser → Next.js API Route → n8n Webhook → Database/AI Processing → Response
                ↑
          Clerk auth() extracts userId
          N8N_API_KEY added server-side
```

All n8n calls happen server-side to protect the API key. Dashboard pages use Server Components calling n8n directly. The upload page uses a Client Component that POSTs to `/api/ocr`.

---

## n8n Backend API (7 Endpoints)

All endpoints require header `x-api-key: <N8N_API_KEY>`.

### Endpoint 1: Perform OCR
- **Webhook:** `6a9405d6-dcaf-4cbf-b83d-04a4535610f1`
- **Method:** POST (multipart/form-data)
- **Fields:** `event_type="perform_ocr"`, `user_id`, `file` (binary)
- **Response:** `{ success: true, status: "DOCUMENT_PROCESSED", message: "..." }`
- **Proxied by:** `POST /api/ocr`

### Endpoint 2: Get User Analytics
- **Webhook:** `48a48758-6c73-4d34-8453-8a1378c297a3`
- **Method:** POST (JSON)
- **Body:** `{ event_type: "get_analytics_per_user", user_id }`
- **Response:** `[{ total_documents_processed, total_pages_processed, total_pdfs_processed, total_images_processed }]`
- **Proxied by:** `GET /api/analytics`

### Endpoint 3: Signup Credits
- **Webhook:** `818c0107-078c-40c9-9761-c3f25eac49b0`
- **Method:** POST (JSON)
- **Body:** `{ event_type: "signup_credits", user_id }`
- **Response:** `{ success: true, status: "CREDITS_ASSIGNED", message: "..." }`
- **Called by:** Clerk webhook handler on `user.created` event

### Endpoint 4: Get Remaining Credit
- **Webhook:** `818c0107-078c-40c9-9761-c3f25eac49b0` (same as #3)
- **Method:** POST (JSON)
- **Body:** `{ event_type: "get_remaining_credit", user_id }`
- **Response:** `[{ current_balance: number }]`
- **Proxied by:** `GET /api/credits/balance`

### Endpoint 5: Get Credit History
- **Webhook:** `818c0107-078c-40c9-9761-c3f25eac49b0` (same as #3, #4)
- **Method:** POST (JSON)
- **Body:** `{ event_type: "credit_history", user_id }`
- **Response:** `[{ transaction_id, user_id, transaction_type, credits_delta, reference_file_id, file_name_snapshot, description, created_at }]`
- **Proxied by:** `GET /api/credits/history`

### Endpoint 6: Get Markdown Contents
- **Webhook:** `46ed3df3-414b-4e29-b1af-579c10db14cf`
- **Method:** POST (JSON)
- **Body:** `{ event_type: "get_markdown_invoice_object", user_id, file_id }`
- **Response:** `[{ markdown_text, file_name, file_size, num_pages, invoice_object: { confidence, description, invoice_data, detected_signals, is_invoice_related }, file_id }]`
- **Proxied by:** `GET /api/documents/[fileId]`

### Endpoint 7: Get User Documents
- **Webhook:** `46ed3df3-414b-4e29-b1af-579c10db14cf` (same as #6)
- **Method:** POST (JSON)
- **Body:** `{ event_type: "get_user_documents", user_id }`
- **Response:** `[{ file_id, file_name, mime_type, file_size, file_base64 }]`
- **Proxied by:** `GET /api/documents`

**Note:** Endpoints 3/4/5 share one webhook URL (differentiated by `event_type`). Endpoints 6/7 share another.

---

## Phase 1: Marketing Landing Page

### Files Modified
| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout — metadata, ClerkProvider, ThemeProvider, Geist font |
| `src/app/(marketing)/page.tsx` | Landing page — hero, features, how-it-works, pricing, CTA |
| `src/components/marketing/navbar.tsx` | Sticky navbar — Receipt icon, InvoiceExtract brand, nav links, theme toggle, auth buttons |
| `src/components/marketing/footer.tsx` | Footer — brand, product/company/legal links, copyright |
| `package.json` | App name set to "invoiceextract" |

### Landing Page Sections
1. **Hero** — "Extract invoice data instantly with AI", stat pills (99% accuracy, <5s processing, 3 formats)
2. **Format Strip** — Supported formats: PDF, PNG, JPEG, any invoice layout
3. **Features** (3 cards) — Intelligent OCR, Structured JSON Output, Smart Validation
4. **How It Works** (3 steps) — Upload Invoice → AI Extracts Data → Review & Export
5. **Pricing** (3 tiers) — Free ($0, 5 credits), Pro ($19/mo, coming soon), Enterprise (custom)
6. **CTA Banner** — "Start extracting invoice data in seconds"

---

## Phase 2: Backend & Dashboard

### Step 2.1 — n8n Client Library
**File:** `src/lib/n8n.ts`

- `N8N_ENDPOINTS` constant — maps 4 webhook UUIDs (OCR, ANALYTICS, CREDITS, DOCUMENTS)
- `callN8nWebhook<T>(endpoint, payload)` — JSON POST with `x-api-key` header
- `callN8nWebhookFormData<T>(endpoint, formData)` — Multipart POST for file uploads
- `N8nError` class with status code

### Step 2.2 — TypeScript Types
**File:** `src/lib/types.ts`

Interfaces: `UserAnalytics`, `CreditBalance`, `CreditTransaction`, `SignupCreditsResponse`, `OcrResponse`, `UserDocument`, `MarkdownInvoiceResponse`, `InvoiceObject`, `InvoiceData`, `InvoiceLineItem`, `InvoiceFinancials`, `InvoiceParty`, `InvoiceAddress`, `InvoiceContact`, `InvoiceBankDetails`

### Step 2.3 — Utility Functions
**File:** `src/lib/utils.ts`

- `cn()` — Tailwind class merging (clsx + tailwind-merge)
- `formatFileSize(bytes)` — Converts bytes to human-readable (KB, MB)
- `formatDate(dateString)` — Formats ISO date to "Mon DD, YYYY"

### Step 2.4 — Clerk Webhook (Signup Credits)
**File:** `src/app/api/webhooks/clerk/route.ts`

On `user.created` event: calls n8n `signup_credits` endpoint with `user_id = event.data.id`. Returns 500 on failure so Svix retries the webhook.

### Step 2.5 — API Route Proxies
All routes: validate Clerk `auth()`, extract `userId`, proxy to n8n, return JSON.

| File | Method | n8n Endpoint | Event Type |
|---|---|---|---|
| `src/app/api/ocr/route.ts` | POST | OCR | `perform_ocr` |
| `src/app/api/analytics/route.ts` | GET | ANALYTICS | `get_analytics_per_user` |
| `src/app/api/credits/balance/route.ts` | GET | CREDITS | `get_remaining_credit` |
| `src/app/api/credits/history/route.ts` | GET | CREDITS | `credit_history` |
| `src/app/api/documents/route.ts` | GET | DOCUMENTS | `get_user_documents` |
| `src/app/api/documents/[fileId]/route.ts` | GET | DOCUMENTS | `get_markdown_invoice_object` |

The OCR route validates file type (PDF/PNG/JPEG only) and forwards as FormData.

### Step 2.6 — Sidebar Navigation
**File:** `src/components/dashboard/sidebar.tsx`

Nav items: Overview, Upload, Documents, Credits, Settings. Receipt icon + "InvoiceExtract" brand.

### Step 2.7 — Dashboard Overview
**File:** `src/app/(dashboard)/dashboard/page.tsx`

Server Component. Fetches analytics, credit balance, and recent transactions in parallel via `Promise.allSettled`.

- 4 stat cards: Total Documents, Total Pages, PDFs Processed, Images Processed
- Credit balance card with link to credit history
- Recent activity list (last 5 transactions, color-coded +/-)
- Empty state CTA card when no documents exist

### Step 2.8 — Upload Page
**Files:**
- `src/app/(dashboard)/dashboard/upload/page.tsx` — Server Component, fetches credit balance
- `src/components/dashboard/upload-form.tsx` — Client Component

Features:
- Drag-and-drop zone (PDF/PNG/JPEG)
- File preview with name, size, type icon
- File type validation client-side
- Credit check before upload
- Upload → POST `/api/ocr` → show success/error
- Auto-redirect to Documents page on success

### Step 2.9 — Documents List
**File:** `src/app/(dashboard)/dashboard/documents/page.tsx`

Server Component. Fetches user documents from n8n.

- Table: File Name, Type (badge), Size, Actions (View button)
- Each row links to `/dashboard/documents/[fileId]`
- Empty state with Upload CTA

### Step 2.10 — Document Detail
**Files:**
- `src/app/(dashboard)/dashboard/documents/[fileId]/page.tsx` — Server Component
- `src/components/dashboard/markdown-viewer.tsx` — Client Component (copy button)

Three tabs:
- **Invoice Data** — confidence badge, invoice number/dates, issuer & client cards (2-col), line items table, financial summary, bank details, notes, detected signals as badges
- **Markdown** — raw extraction text with copy-to-clipboard
- **File Details** — file name, size, pages, file ID

Uses `notFound()` for missing documents.

### Step 2.11 — Credits Page
**File:** `src/app/(dashboard)/dashboard/credits/page.tsx`

Server Component. Parallel fetch of balance + history.

- Large balance card (number + "credits remaining")
- Transaction history table: Date, Description, File (link to document), Type badge, Credits (+/- color-coded)

### Step 2.12 — Settings Placeholder
**File:** `src/app/(dashboard)/dashboard/settings/page.tsx`

"Coming soon" placeholder.

### Step 2.13 — Loading & Error States

| File | Purpose |
|---|---|
| `src/app/(dashboard)/dashboard/loading.tsx` | Skeleton grid for overview |
| `src/app/(dashboard)/dashboard/upload/loading.tsx` | Skeleton for upload page |
| `src/app/(dashboard)/dashboard/documents/loading.tsx` | Skeleton for documents table |
| `src/app/(dashboard)/dashboard/credits/loading.tsx` | Skeleton for credits page |
| `src/app/(dashboard)/dashboard/error.tsx` | Error boundary (client component, retry button) |
| `src/app/(dashboard)/dashboard/documents/[fileId]/not-found.tsx` | 404 for missing documents |

---

## Dark/Light Mode

### Implementation
| File | Purpose |
|---|---|
| `src/components/theme-provider.tsx` | Wraps `next-themes` ThemeProvider with `attribute="class"`, `defaultTheme="system"` |
| `src/components/theme-toggle.tsx` | Sun/Moon icon button, toggles between light and dark |
| `src/app/layout.tsx` | Wraps app in `<ThemeProvider>`, `suppressHydrationWarning` on `<html>` |
| `src/components/marketing/navbar.tsx` | Theme toggle in marketing navbar |
| `src/components/dashboard/top-nav.tsx` | Theme toggle in dashboard top-nav |

### How It Works
- `globals.css` defines full OKLch color variables for both `:root` (light) and `.dark` (dark)
- `next-themes` adds/removes the `.dark` class on the `<html>` element
- Tailwind's `@custom-variant dark (&:is(.dark *))` activates dark styles
- All components use semantic tokens (`bg-background`, `text-foreground`, etc.) that auto-adapt
- Theme persists via localStorage, defaults to OS system preference

---

## Complete File Tree

```
src/
├── app/
│   ├── globals.css                              # Tailwind theme (light + dark CSS variables)
│   ├── layout.tsx                               # Root layout (Clerk, Theme, Geist font)
│   ├── favicon.ico
│   ├── (marketing)/
│   │   ├── layout.tsx                           # Pass-through wrapper
│   │   └── page.tsx                             # Landing page
│   ├── (dashboard)/
│   │   ├── layout.tsx                           # Sidebar + TopNav layout
│   │   └── dashboard/
│   │       ├── page.tsx                         # Overview (stats, credits, activity)
│   │       ├── loading.tsx                      # Skeleton loader
│   │       ├── error.tsx                        # Error boundary
│   │       ├── upload/
│   │       │   ├── page.tsx                     # Upload page
│   │       │   └── loading.tsx
│   │       ├── documents/
│   │       │   ├── page.tsx                     # Documents list
│   │       │   ├── loading.tsx
│   │       │   └── [fileId]/
│   │       │       ├── page.tsx                 # Document detail (3 tabs)
│   │       │       └── not-found.tsx
│   │       ├── credits/
│   │       │   ├── page.tsx                     # Credits balance + history
│   │       │   └── loading.tsx
│   │       └── settings/
│   │           └── page.tsx                     # Placeholder
│   └── api/
│       ├── ocr/route.ts                         # POST — file upload proxy
│       ├── analytics/route.ts                   # GET — user analytics proxy
│       ├── credits/
│       │   ├── balance/route.ts                 # GET — credit balance proxy
│       │   └── history/route.ts                 # GET — credit history proxy
│       ├── documents/
│       │   ├── route.ts                         # GET — list documents proxy
│       │   └── [fileId]/route.ts                # GET — document detail proxy
│       └── webhooks/
│           └── clerk/route.ts                   # POST — Clerk webhook (signup credits)
├── components/
│   ├── theme-provider.tsx                       # next-themes wrapper
│   ├── theme-toggle.tsx                         # Sun/Moon toggle button
│   ├── marketing/
│   │   ├── navbar.tsx                           # Marketing navbar
│   │   └── footer.tsx                           # Marketing footer
│   ├── dashboard/
│   │   ├── sidebar.tsx                          # Dashboard sidebar nav
│   │   ├── top-nav.tsx                          # Dashboard top bar
│   │   ├── upload-form.tsx                      # Drag-and-drop upload (client)
│   │   └── markdown-viewer.tsx                  # Markdown display + copy (client)
│   └── ui/                                      # shadcn/ui (15 components)
│       ├── alert.tsx
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── progress.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── skeleton.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       └── tooltip.tsx
├── lib/
│   ├── n8n.ts                                   # n8n webhook client
│   ├── types.ts                                 # TypeScript interfaces
│   └── utils.ts                                 # cn(), formatFileSize(), formatDate()
└── middleware.ts                                 # Clerk auth (protects /dashboard)
```

---

## Verification Checklist

### Phase 1 — Landing Page
- [ ] `npm run dev` → visit `/` → landing page renders with InvoiceExtract branding
- [ ] All sections visible: hero, format strip, features, how-it-works, pricing, CTA
- [ ] Auth buttons work (Sign in / Get started via Clerk modal)
- [ ] Theme toggle switches between light and dark mode
- [ ] Responsive layout on mobile viewport

### Phase 2 — Dashboard
- [ ] Sign up a new user → Clerk webhook fires → 5 signup credits assigned
- [ ] `/dashboard` shows analytics cards, credit balance, recent activity
- [ ] `/dashboard/upload` shows drag-and-drop zone with credit count
- [ ] Upload a sample invoice (PDF/PNG) → processing succeeds → redirects to documents
- [ ] `/dashboard/documents` shows table with the uploaded document
- [ ] Click document → `/dashboard/documents/[fileId]` shows 3 tabs (Invoice Data, Markdown, Details)
- [ ] Invoice Data tab shows issuer, client, line items, financials, bank details
- [ ] Markdown tab shows extracted text with working copy button
- [ ] `/dashboard/credits` shows balance decreased by 1, transaction history updated
- [ ] Upload invalid file type → shows error message
- [ ] Theme toggle works on dashboard pages
- [ ] `npm run build` completes with zero TypeScript errors
