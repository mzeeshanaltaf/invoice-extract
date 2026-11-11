# Phase 1: Backend (`backend/`)

**Prerequisite reading:** [README.md](README.md), [00-overview.md](00-overview.md), [HANDOFF.md](HANDOFF.md). Reference: `n8n_workflows/*.json`, `docs/n8n_webhooks.txt`, [src/lib/types.ts](../../src/lib/types.ts) (invoice schema).
**Depends on:** nothing. **Unblocks:** Phase 2.
**Scope guard:** backend only. Do not edit the Next.js app, do not deploy. Commit/push only to branch `phase-1-backend` and only when the user asks; never `main`.

## Goal

A standalone FastAPI service that reproduces everything the n8n workflows do, plus async processing, bulk upload, edit, export, MinIO storage, email-in and retention. Testable without the front end (pytest + curl with a locally minted JWT).

## Stack

Python 3.12, FastAPI, Pydantic v2 + pydantic-settings, SQLAlchemy 2 async + asyncpg, Alembic, `openai` SDK, `pypdfium2` (PDF render and text layer, permissive licence), Pillow, PyJWT[crypto], openpyxl, pytest. Dockerfile (uvicorn, single worker, port 8000).

## Layout

```
backend/
  app/main.py            app factory, CORS (frontend origin only), lifespan starts worker
  app/config.py          every tunable below, from env
  app/auth.py            verify Better Auth JWT via JWKS (cached), dependency -> user_id
  app/db.py, models.py   engine pinned to search_path=invoice_extract
  app/routers/           documents, credits, analytics, account, exports, admin, meta
  app/services/
    intake.py            synchronous upload checks
    rendering.py         PDF pages / images -> normalized PNG/JPEG for vision
    gate.py              Decisions API invoice check
    extraction.py        Responses API structured extraction
    checks.py            arithmetic sanity checks on extracted totals
    credits.py           ensure account, soft hold, deduct, history
    worker.py            Postgres-backed job loop
    exports.py           JSON / CSV / XLSX
    storage.py           S3 client for MinIO (put, stream, delete, delete-by-prefix)
    inbound.py           email-in: verify webhook, resolve user, fetch attachments
    retention.py         periodic sweep that deletes expired source files
  alembic/               migrations
  tests/
```

## First step: live probe

Write a probe script confirming the SDK surface for `client.decisions.create` and `service_tier="flex"` on `gpt-6-luna`. If the SDK lacks a helper, use the raw `client.post("/decisions")` path. Record the finding in HANDOFF.md. (Needs a real `OPENAI_API_KEY` in a local, gitignored `.env`; ask the user if missing.)

## Configuration (`app/config.py`, all env-overridable)

`OPENAI_MODEL=gpt-6-luna`, `OPENAI_SERVICE_TIER=flex`, `OPENAI_FLEX_FALLBACK_TIER=default` (used after flex retries are exhausted; empty disables), `OPENAI_REASONING_EFFORT=low`, `OPENAI_DECISIONS_MODEL=gpt-6-luna`, `OPENAI_DECISIONS_SERVICE_TIER=` (unset), `OPENAI_TIMEOUT_SECONDS=900`, `INVOICE_MIN_PROBABILITY=0.5`, `MAX_FILE_MB=10`, `MAX_PDF_PAGES=10`, `MAX_IMAGE_PIXELS`, `MAX_FILES_PER_UPLOAD=10`, `MAX_INFLIGHT_PER_USER=10`, `UPLOADS_PER_HOUR=30`, `SIGNUP_CREDITS=5`, `RENDER_DPI=150`, `RENDER_MAX_EDGE=2000`, `ALLOWED_ORIGINS`, `BETTER_AUTH_URL`, `DATABASE_URL`, `ADMIN_API_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `INBOUND_EMAIL_DOMAIN`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INBOUND_MAX_ATTACHMENTS=5`, `INBOUND_EMAILS_PER_DAY=20`, `RETENTION_CHOICES_DAYS=7,30,90`, `RETENTION_SWEEP_MINUTES=60`.

Added during implementation (all in `backend/.env.example`): `LEGIBILITY_MIN_SCORE=1.0` (gate score runs 0 unreadable .. 3 good), `OPENAI_FLEX_MAX_RETRIES=3`, `OPENAI_BACKOFF_BASE_SECONDS=5`, `OPENAI_BACKOFF_MAX_SECONDS=120`, `RESEND_FROM_EMAIL` (sender for the email-in summary), `INBOUND_MIN_IMAGE_BYTES=15000`, `INBOUND_MIN_IMAGE_EDGE=300`, `ORPHAN_MIN_AGE_MINUTES=60`, `WORKER_ENABLED`, `WORKER_CONCURRENCY=2`, `MAX_ATTEMPTS=3`, `STORAGE_DRIVER=local|s3`, `STORAGE_LOCAL_DIR`, `ENVIRONMENT`, `JWT_ISSUER`/`JWT_AUDIENCE`/`JWT_JWKS_URL` (default from `BETTER_AUTH_URL`), `JWT_ALGORITHMS`, `JWT_DEV_PUBLIC_KEY_FILE` (test-only, refused in production), `EXPORT_MAX_DOCS`, `DELETE_MAX_IDS`.

For local development a filesystem storage driver backs `storage.py` so MinIO is not needed on the dev machine.

## Data model

New tables, new names (old n8n tables untouched until Phase 5). Better Auth tables never touched. All in schema `invoice_extract`, created by Alembic.

- `documents`: `id uuid pk`, `user_id text`, `file_name`, `mime_type`, `file_size`, `num_pages`, `checksum` (unique on `(user_id, checksum)`), `storage_key` (object key, null once the source file is removed), `source` (`upload | email`), `source_detail jsonb` (sender, subject for email-in), `file_deleted_at`, `status` (`queued | validating | extracting | processed | rejected | failed`), `status_detail`, `gate jsonb` (probability, document type, legibility), `markdown_text`, `invoice_data jsonb` (model output), `extraction_meta jsonb` (confidence, description, detected_signals; added during implementation), `edited_data jsonb` (user corrections, null until edited), `warnings jsonb`, `usage jsonb` (tokens, tier used), `attempts` (also the claim token that stops a stale job double-charging), timestamps incl. `processed_at`.
- `user_settings`: `user_id pk`, `retention_days int null` (null = keep files), `inbound_token text unique` (random; forms the personal email-in address), `inbound_enabled bool`.
- `inbound_emails`: `id` (Resend email id, unique, for idempotent webhook retries), `user_id`, `from_address`, `subject`, `received_at`, `result jsonb` (per-attachment outcome), `reply_sent_at` (makes the summary reply idempotent; added during implementation).
- `credit_accounts`: `user_id pk`, `balance >= 0`.
- `credit_transactions`: as n8n (`signup_bonus | document_processing | refund | manual_adjustment`), FK to account (cascade) and document (set null), `file_name_snapshot`.

## Processing pipeline

### At upload (`POST /v1/documents`, multipart, 1..N files, returns 202 with one result per file)

1. Type by magic bytes, not the client's MIME claim: PDF, PNG, JPEG only.
2. Size <= 10 MB (also enforced as a request body cap, so oversized uploads are cut off early).
3. PDFs: must open, not be password protected, page count <= 10. Images: pixel-count cap (decompression-bomb guard).
4. Duplicate check on SHA-256 per user (409-style per-file result naming the existing document).
5. Credits: `balance - pages held by the user's in-flight documents >= pages`, else `INSUFFICIENT_CREDITS` with current and required values. Per-user in-flight and hourly caps.
6. Insert as `queued`. Per-file error codes keep the n8n vocabulary (`INVALID_DOCUMENT`, `FILE_TOO_LARGE`, `PAGE_LIMIT_EXCEEDED`, `DUPLICATE_DOCUMENT`, `INSUFFICIENT_CREDITS`) plus `PDF_ENCRYPTED`, `NOT_AN_INVOICE`.

### In the worker (in-process asyncio loop, claims rows with `FOR UPDATE SKIP LOCKED`, re-queues rows left mid-flight by a restart)

1. Render: PDF pages to images with pypdfium2; images EXIF-rotated and downscaled to the max edge. PDF text layer, when present, is kept as an accuracy hint.
2. Gate (Decisions API, first two pages): `predicate` "is this an invoice, bill, receipt or credit note", `choice` document type, `score` legibility. Below threshold: status `rejected` with a human reason, stored file bytes are discarded, no credits charged. Unreadable scans are rejected with a "retake the photo" message.
3. Extract (Responses API, `gpt-6-luna`, `service_tier` from config, structured outputs from a Pydantic model): all page images plus the text hint in, `{markdown_text, invoice_data, confidence, detected_signals, description}` out. Schema is the existing one in `src/lib/types.ts` (`invoice_metadata`, `seller`, `buyer`, `line_items`, `totals`, `payment_details`, `notes`) with nullable fields instead of the n8n prompt's `""`/`0` placeholders, so "missing" and "zero" are distinguishable.
4. Flex handling: long timeout, exponential backoff on 429 "resource unavailable" and timeouts, then one attempt on the fallback tier. The tier actually used is recorded in `usage`.
5. Sanity checks: line totals vs subtotal, subtotal + tax vs grand total, due date before issue date. Mismatches become `warnings` shown in the UI, not failures.
6. In one transaction: mark `processed`, deduct `num_pages` credits, write the transaction row. Hard failure after retries: `failed`, no charge, user can retry.

## File storage (MinIO)

- Files never enter Postgres. Intake writes the original to `{user_id}/{document_id}/original.{ext}` in a private bucket; the row stores only `storage_key`.
- MinIO is reachable only on the internal Docker network. The browser never talks to it: `GET /v1/documents/{id}/file` checks ownership and streams the object through the API.
- Deleting a document, rejecting a non-invoice, and deleting an account all remove the objects (account purge deletes by `{user_id}/` prefix). A failed object delete is logged and retried by the retention sweep, so no orphaned files linger.

## Email-in

- Each user gets a personal address, `<inbound_token>@<INBOUND_EMAIL_DOMAIN>` (planned domain: `in.invoicextract.zeeshanai.cloud`, a dedicated subdomain so existing mail on the main domain is untouched). Token is random, shown in Settings, can be regenerated (old address stops working) or switched off.
- Resend inbound delivers an `email.received` webhook to `POST /v1/inbound/email`. The handler verifies the Svix signature, ignores already-seen email ids, resolves the user from the recipient token, fetches PDF/PNG/JPEG attachments through the Resend API, and feeds each into the same intake and pipeline as an upload (`source = email`). Same limits, same invoice gate, same credit rules.
- Guard rails: at most 5 attachments per email and 20 emails per user per day; inline signature images and tiny images are skipped; unknown tokens are dropped silently.
- Feedback: one summary reply to the sender through the existing Resend sender (processed, rejected as not an invoice, duplicate, out of credits), only when the sender matches the account email, so the address cannot be used to spray replies at strangers. Everything also shows in the dashboard with a "by email" marker.

## Retention

- Per-user setting: keep source files forever (default), or delete them 7, 30, or 90 days after processing. Only the source PDF/image is removed; extracted data, edits, and exports stay.
- A sweep in the worker runs hourly: for expired documents it deletes the object, clears `storage_key`, sets `file_deleted_at`. Changing the setting applies to existing documents on the next sweep.
- After removal the document shows the extracted data with a "source file removed on <date>" note, and the same file can be uploaded again (the duplicate check says it was already processed and links to it).

## Endpoints (`/v1`, JWT required unless noted)

| Endpoint | Replaces / adds |
|---|---|
| `GET /healthz`, `GET /v1/meta/limits` (public) | health check; limits the UI displays |
| `POST /v1/documents` | `perform_ocr`, now bulk and asynchronous |
| `GET /v1/documents` (paged, search, status filter, no file bytes) | `get_user_documents` |
| `GET /v1/documents/{id}` | `get_markdown_invoice_object` plus status, warnings |
| `GET /v1/documents/{id}/file` (streamed) | replaces base64 blobs in list responses |
| `PATCH /v1/documents/{id}` | new: save corrected fields to `edited_data`; original kept, "reset" possible |
| `POST /v1/documents/{id}/retry` | new: re-run a failed document |
| `DELETE /v1/documents/{id}`, `POST /v1/documents/delete` | `delete_files` |
| `GET /v1/documents/{id}/export?format=json\|csv\|xlsx`, `POST /v1/exports` | new: single and multi-document export |
| `GET /v1/credits`, `GET /v1/credits/transactions` | `get_remaining_credit`, `credit_history` |
| `GET /v1/analytics` | `get_analytics_per_user` |
| `GET /v1/overview` | `get_user_data`, without file payloads |
| `DELETE /v1/account` | `delete_user` (also fixes the n8n bug where the "transactions" delete node targets the accounts table) |
| `GET /v1/admin/analytics` (`x-api-key`) | `get_analytics_all` |
| `GET /v1/settings`, `PATCH /v1/settings` | new: retention days, email-in on/off |
| `POST /v1/settings/inbound-address/regenerate` | new: rotate the personal email-in address |
| `POST /v1/inbound/email` (Resend signature, no JWT) | new: email-in webhook |

**Signup credits:** the API creates the credit account with the signup bonus idempotently on a user's first authenticated request (`INSERT ... ON CONFLICT DO NOTHING`). (The Next.js hook is removed in Phase 2.)

**JWT auth:** verify against the Next.js JWKS (`<BETTER_AUTH_URL>/api/auth/jwks`), cached; check signature, expiry, issuer, audience; `sub` is `user_id`. For local testing provide a test helper that mints tokens with a local keypair and a settings flag/fixture to point the verifier at it (never enabled in production config).

## Verification (this phase)

- `pytest` with OpenAI mocked: each intake rejection code, duplicate detection, soft credit hold under concurrent uploads, deduction only on success, rejection and failure charge nothing, flex retry then fallback, account purge, JWT verification (bad signature, expired, wrong issuer).
- Storage tests: object written on intake and removed on delete, rejection, and account purge.
- Email-in tests: bad signature refused; repeated email id processed once; email with an invoice PDF, a signature image and a non-invoice attachment yields one processed document, one skip, one rejection.
- Retention test: backdated document sweep removes only the file and leaves the data.
- Live pipeline check with the real key (filesystem storage ok): a generated multi-line invoice PDF, a phone-style invoice JPEG, a non-invoice image, an 11-page PDF, an 11 MB file, an encrypted PDF, the same file twice. Confirm statuses, stored JSON against known values, credit ledger, and that `usage` shows the flex tier.
- `alembic upgrade head` works on a clean schema and Docker image builds and boots (`/healthz`).

## Exit criteria

- [x] All endpoints above implemented and covered by tests; `pytest` green.
- [x] Alembic migration creates only the new tables; Better Auth tables and old n8n tables untouched.
- [x] Live pipeline check passed with real OpenAI key; probe finding recorded.
- [x] `backend/Dockerfile` builds; `backend/.env.example` (local, gitignored) and `backend/README.md` document env and how to run.
- [x] OpenAPI schema (`/openapi.json`) reviewable; response shapes noted in HANDOFF.md for Phase 2.

## Handoff (do this last)

Append a HANDOFF.md entry using its template. Must include: how to start the backend locally (command, port, env), how to mint a test JWT, final response shapes for `documents`, `overview`, `credits`, `settings` and the per-file upload result and error codes, the exact `documents.status` values, the polling expectations, the JWT claims/issuer/audience the verifier requires (so Phase 2 configures the Better Auth `jwt()` plugin to match), and any deviation from this file. Set Phase 1 to "done" in the status board. Commit/push to `phase-1-backend` only if the user asks (never `main`).
