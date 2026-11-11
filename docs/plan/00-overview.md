# 00 Overview (shared context for all phases)

## Goal

Today the app is a Next.js front end whose entire backend is five n8n workflows (OCR via Mistral, credits, documents, analytics, delete) called through `/api/*` proxy routes. Replace n8n with a separately deployed Python/FastAPI service, switch extraction to `gpt-6-luna` vision, gate uploads with the OpenAI Decisions API so non-invoices are rejected, enforce upload limits, rename the product to **InvoicExtract**, and redesign every screen (landing, auth, dashboard) with the impeccable skill, leaving a `DESIGN.md` that governs future UI work.

## Confirmed decisions

| Topic | Decision |
|---|---|
| Name | `InvoicExtract` everywhere (replaces `InvoiceExtract`) |
| API boundary | Browser calls `api.invoicextract.zeeshanai.cloud` directly with a Better Auth JWT; Next.js keeps auth only |
| Limits | 10 MB per file, 10 pages per PDF, 1 credit per page (all config) |
| Extras | Delete documents and account, CSV/XLSX export, edit extracted fields, bulk upload |
| Added on review | MinIO object storage for files (from day one, no `bytea`), email-in, retention setting for source files |
| Audience | Bookkeepers and small businesses first, developers second |
| Design | "Paper and ledger", light first with dark supported, one signature hero animation plus subtle motion |

## What the n8n workflows do today (all to be reproduced)

Validate type/size/pages, SHA-256 duplicate check per user, credit balance check, OCR to markdown, LLM structuring into `invoice_object`, store file bytes + markdown + JSON, deduct 1 credit/page with a transaction row, signup bonus of 5 credits, balance, history, per-user and global analytics, delete files, delete user data. JSON exports of the workflows are in `n8n_workflows/`; endpoint notes in `docs/n8n_webhooks.txt`.

## Verified OpenAI facts that shape the design

- `gpt-6-luna` accepts text and images only, no PDF/file input. PDFs must be rendered to page images server side.
- Decisions API (`POST /v1/decisions`, model `gpt-6-luna`) takes `input_image` parts and returns typed answers (`predicate` probability, `choice`, `score`). No file inputs.
- Flex tier is supported for `gpt-6-luna` on the Responses API at half price, but is slower and can return "resource unavailable". So processing must be a background job, not a blocking request. The Decisions doc lists no service tiers, so its tier is a separate setting, unset by default.

## Architecture

```
Browser ──(Better Auth cookie)──> Next.js  (auth, marketing, dashboard UI, contact form)
   │                                 └─ /api/auth/* incl. /token and /jwks (JWT plugin)
   └──(Authorization: Bearer JWT)──> FastAPI  api.invoicextract.zeeshanai.cloud
                                        ├─ Postgres, schema invoice_extract (same DB)
                                        ├─ MinIO (private bucket, internal Docker network only)
                                        └─ OpenAI: Decisions (gate) + Responses (extraction)
Resend inbound ──(signed webhook)──> FastAPI /v1/inbound/email   (email-in)
```

- The JWT `sub` is the Better Auth user id, so `user_id` remains the single key for all data (the invariant in CLAUDE.md is preserved).
- New code lives in `backend/` in this repo (monorepo), deployed as a second Coolify app.

## Invariants

1. `user_id` is the single key for all backend data. Never change how it is derived.
2. Better Auth tables (`user`, `session`, `account`, `verification`, and new `jwks`) live in schema `invoice_extract`. Never modify them by hand.
3. New backend tables use new names so the live n8n-backed site keeps working until cutover (Phase 5).
4. Existing front-end constraints from CLAUDE.md remain: `canvas` alias for react-pdf, contact-form honeypot `hp_field` and dual native/fetch paths, inline errors (no toaster), `NEXT_PUBLIC_*` are build-time in Coolify.
5. Existing data is dummy; dropping old tables in Phase 5 is approved.

## Out of scope (recommendations for later)

Paid credit packs (Stripe/Lemon Squeezy), public API keys, push to accounting tools / webhooks on "processed", MinIO off-box backups.

## Phase dependency chain

1 (backend, testable alone with curl/pytest and a fake JWT) -> 2 (front end wired to it) -> 3 (redesign on top of working data flow) -> 4 (deploy everything) -> 5 (cutover and docs).
