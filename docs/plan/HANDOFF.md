# HANDOFF log

Each session appends one entry at the end of its phase. Newest at the bottom. Never store secret values here, only env var names.

## Status board

| Phase | Status | Session date | Notes |
|---|---|---|---|
| 1 Backend | done | 2026-11-11 | 119 tests pass (+1 S3 test, run separately); live OpenAI check ALL PASS on flex tier |
| 2 Front end integration | not started | | |
| 3 Redesign | not started | | |
| 4 Deploy | not started | | |
| 5 Cutover | not started | | |

## Entry template (copy for each phase)

```
### Phase N: <title>  (YYYY-MM-DD)
**Result:** done | partial (say what is missing)
**Built:** key files and directories (clickable paths)
**Deviations from plan:** what changed and why (and which phase file was edited)
**Env vars / secrets added:** names only, where they are set
**How to run / test:** exact commands, ports, test users
**Verification results:** what was actually run and the outcome
**Open issues / risks:**
**Next phase must know:** facts, gotchas, API shapes, decisions
```

## Entries

### Phase 1: Backend  (2026-11-11)
**Result:** done. All exit criteria ticked in [phase-1-backend.md](phase-1-backend.md). Nothing committed or pushed (per plan).

**Built:** everything is in [backend/](../../backend/) (Python 3.12 venv at `backend/.venv`, gitignored).
- [app/main.py](../../backend/app/main.py) factory/CORS/lifespan (starts the worker), [app/config.py](../../backend/app/config.py) all tunables, [app/auth.py](../../backend/app/auth.py) JWT, [app/models.py](../../backend/app/models.py), [app/middleware.py](../../backend/app/middleware.py) body cap.
- [app/services/](../../backend/app/services/): `intake`, `rendering`, `gate`, `extraction`, `checks`, `credits`, `worker`, `exports`, `storage` (local + S3), `inbound`, `retention`, `serialize`. Routers in [app/routers/](../../backend/app/routers/).
- [alembic/versions/0001_initial.py](../../backend/alembic/versions/0001_initial.py) (new tables only), [Dockerfile](../../backend/Dockerfile) + `docker-entrypoint.sh` (runs `alembic upgrade head`, then one uvicorn worker), [README.md](../../backend/README.md), `.env.example`.
- [scripts/probe_openai.py](../../backend/scripts/probe_openai.py), [scripts/mint_token.py](../../backend/scripts/mint_token.py), [scripts/live_check.py](../../backend/scripts/live_check.py); tests in [tests/](../../backend/tests/).

**OpenAI probe finding (live, `openai` SDK 3.49.0):**
- `client.decisions.create(model, input=[{role:"user", content:[{type:"input_image", image_url:<data URL>, detail}]}], questions=[...])` exists as a first-class method (no raw `client.post("/decisions")` needed). It has **no `service_tier` parameter**. Answers come back typed (`predicate.probability`, `choice.choice`, `score.score` on a 0-based level index, so levels unreadable/poor/fair/good = 0..3) and carry `name`.
- `client.responses.parse(model="gpt-6-luna", input=..., text_format=<Pydantic>, reasoning={"effort":"low"}, service_tier="flex")` works; `response.service_tier` reports `flex`; without a tier it reports `default`. Structured outputs reject non-null `default` in the schema, so the invoice models use `default_factory`.
- The client is built with `max_retries=0`; our own loop does retry/backoff/fallback so the tier used is known exactly.

**Deviations from plan** (phase-1 file edited to match):
- Extra columns: `documents.extraction_meta` (confidence/description/detected_signals) and `inbound_emails.reply_sent_at`. Ledger column is `credit_transactions.reference_document_id` (API still exposes `reference_file_id` like n8n).
- Extra env vars (list in the phase file): notably `LEGIBILITY_MIN_SCORE`, `RESEND_FROM_EMAIL`, flex retry/backoff tunables, `STORAGE_DRIVER`, `JWT_*`, `ENVIRONMENT`.
- Email summary reply needs the account email, read **read-only** from the Better Auth `"user"` table (`SELECT email FROM "user" WHERE id=...`). If that table/row is missing, no reply is sent. The Better Auth tables are never written.
- Added `GET /readyz` (DB check) beside `/healthz` (no DB). `POST /v1/documents` also accepts the multipart field name `file` as an alias of `files`.
- Orphaned objects (failed delete, crashed upload) are found by listing the bucket and checking rows; no extra table.

**Env vars / secrets added** (names only; set in Coolify in Phase 4): `DATABASE_URL`, `OPENAI_API_KEY`, `BETTER_AUTH_URL`, `ALLOWED_ORIGINS`, `ADMIN_API_KEY`, `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `INBOUND_EMAIL_DOMAIN`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_FROM_EMAIL`, `ENVIRONMENT=production`. Everything else has a default. Local: `backend/.env` holds only `OPENAI_API_KEY` (copied from the root `.env.local`; gitignored).

**How to run / test:** see [backend/README.md](../../backend/README.md). Short version, from `backend/`:
```
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --port 8000          # reads backend/.env; JWT_DEV_PUBLIC_KEY_FILE=.devkeys/public.pem for local tokens
TOKEN=$(.venv/Scripts/python scripts/mint_token.py --user test_user_1)
curl -s localhost:8000/v1/credits -H "Authorization: Bearer $TOKEN"
.venv/Scripts/python -m pytest                                    # needs Postgres (below)
.venv/Scripts/python scripts/live_check.py                        # real OpenAI, server must be running
```
Local Postgres for this project: Docker container `invoicextract-dev-postgres` (postgres:17, `127.0.0.1:5434`, db `invoicextract`; tests use db `invoicextract_test`). It is still running. Other containers on this machine (`resumatch-dev-postgres`, `documind-minio-1`) belong to other projects and were not touched.

**Verification results (real runs):**
- `pytest`: **119 passed, 1 skipped** (~10 s). Covers every intake error code (INVALID_DOCUMENT, EMPTY_FILE, FILE_TOO_LARGE, PAGE_LIMIT_EXCEEDED, PDF_ENCRYPTED, DUPLICATE_DOCUMENT, INSUFFICIENT_CREDITS, TOO_MANY_IN_FLIGHT, RATE_LIMITED), 413 request cap, concurrent soft hold (5 credits, 6 simultaneous uploads: exactly 5 accepted), charge only on success, rejection and failure charge nothing, flex retry then fallback and tier recorded, restart re-queue, stale-job no double charge, delete mid-processing, account purge (data and objects, other users untouched), JWT (bad signature, expired, wrong issuer/audience, missing claims, alg none, unsafe `sub`, real JWKS fetch with an Ed25519 key, dev key refused in production), storage lifecycle, retention sweep, orphan sweep, email-in (bad/tampered/stale signature, unknown or disabled token, repeated email id processed once, invoice + signature image + non-invoice gives one processed / one skipped / one rejected, single reply only to the account owner, caps), exports incl. formula-injection neutralising, edit/reset, search, isolation between users, and the migration (clean schema; stand-ins for old n8n and Better Auth tables left untouched).
- The skipped test is the S3 driver test; run separately against a throwaway MinIO container: **passed** (put/get/stream/list/delete/delete_prefix). The container was removed afterwards.
- Live pipeline check (`scripts/live_check.py`, real key, flex): **ALL PASS**, ~40-50 s end to end. 11-page PDF -> PAGE_LIMIT_EXCEEDED; 11 MB file -> FILE_TOO_LARGE; encrypted PDF -> PDF_ENCRYPTED; same file twice -> DUPLICATE_DOCUMENT naming the first; 2-page 8-line invoice PDF extracted exactly (number, dates, GBP, 8 lines, 477.10 / 95.42 / 572.52, shipping `null`, no warnings); phone-style JPEG (rotated, blurred, noisy) extracted exactly (3 lines, 24.50 / 0.49 / 24.99, USD); landscape picture rejected as NOT_AN_INVOICE (probability 0.0), file discarded, no charge; ledger charged exactly 2 + 1 pages; `usage.service_tier_used = "flex"`, `fallback_used = false`; xlsx export and file streaming OK. First run found the model putting business names in `company_name`; fixed in the extraction prompt (`name` = primary name) and re-run.
- `alembic upgrade head` on clean schemas: OK (test DB and inside the Docker image). `docker build` OK; container booted with `ENVIRONMENT=production`, migrated, `/healthz` and `/readyz` 200, Docker health "healthy".

**Open issues / risks:**
- **Stray empty file `e:\tmp_probe.py`** (drive root, 0 bytes) was created by a mistaken shell redirect of mine; the safety check blocked my delete. Please delete it manually.
- The root `.gitignore` gained `/backend/.venv/` during the session; not from my edits, harmless, left as is.
- Email-in is tested with mocked Resend. The inbound payload/attachment shapes follow the Resend docs (`GET /emails/receiving/{id}/attachments` returning `{data:[{filename, content_type, content_disposition, content_id, size, download_url}]}`; Svix-signed `email.received`). Verify against a real Resend inbound email in Phase 4 (needs the `in.` MX record and webhook set up).
- Gate thresholds (`INVOICE_MIN_PROBABILITY=0.5`, `LEGIBILITY_MIN_SCORE=1.0`) were validated only on synthetic samples (invoice 1.0 / phone photo legibility 2.54 / landscape 0.0). Tune with real bookkeeper documents.
- Single-process by design (job loop and sweep live in the app). A rolling deploy overlap is data-safe (row locks, guarded charge) but may cost a duplicate OpenAI call.
- Flex can be slow: worst case is 3 flex attempts x up to 900 s plus a fallback call before a document turns `failed`.
- `DELETE /v1/account` removes backend data only; a still-valid JWT would recreate an empty account (with signup bonus) on the next call, so the front end must delete the Better Auth user and sign out right after.

**Next phase must know:**

*Start/auth.* Browser calls the API directly with `Authorization: Bearer <JWT>`. The verifier requires: signature checked against the JWKS at `<BETTER_AUTH_URL>/api/auth/jwks` (cached 1 h; algs EdDSA, RS256 or ES256, so the Better Auth `jwt()` default Ed25519 works); claims **`exp`, `sub`, `iss`, `aud` all required**; `iss` must equal `BETTER_AUTH_URL` and `aud` must equal `BETTER_AUTH_URL` (no trailing slash; these are the `jwt()` plugin defaults, so keep `issuer`/`audience` unset or equal to the base URL, or set `JWT_ISSUER`/`JWT_AUDIENCE` on the backend to match); 10 s leeway; `sub` = Better Auth user id, must match `^[A-Za-z0-9_-]{1,128}$`. Errors: 401 with codes `UNAUTHORIZED | INVALID_TOKEN | TOKEN_EXPIRED` (refresh the token and retry once). The first authenticated call creates the credit account with the signup bonus (remove the Next.js signup hook). CORS allows only `ALLOWED_ORIGINS` (set it to the site origin) with methods GET/POST/PATCH/DELETE and headers Authorization, Content-Type; `Content-Disposition` is exposed for downloads.

*Error envelope (all endpoints):* `{"error": {"code": "...", "message": "...", ...extras}}`. 422 is `VALIDATION_ERROR` (with `details`), 404 `NOT_FOUND`, 413 `REQUEST_TOO_LARGE`, 410 `FILE_REMOVED`, 409 `NOT_EDITABLE | NOT_RETRYABLE | NOT_EXPORTABLE`, 402 `INSUFFICIENT_CREDITS` (retry endpoint).

*`documents.status` values (exact):* `queued`, `validating`, `extracting`, `processed`, `rejected`, `failed`. In flight = the first three. Terminal = the last three.

*Polling.* After upload, poll `GET /v1/documents/{id}` (or the list / `/v1/overview`) every 3-5 s while any document is in flight; typical end to end is 10-60 s on flex, worst case many minutes, so show "processing" with no hard timeout. When something turns `processed`, refresh `/v1/credits`. `held` credits are reserved by in-flight documents and released on completion.

*`POST /v1/documents`* (multipart, field `files`, 1..10 files, 202):
```
{"results":[{"file_name","success":bool,"document_id":uuid|null,"status":"queued"|null,
             "error_code":str|null,"message":str|null,"details":{}}],"accepted":n,"rejected":n}
```
Per-file `error_code` values: `INVALID_DOCUMENT`, `EMPTY_FILE`, `FILE_TOO_LARGE`, `PAGE_LIMIT_EXCEEDED` (details.pages, max_pages), `PDF_ENCRYPTED`, `DUPLICATE_DOCUMENT` (details.existing_document_id, existing_file_name, existing_status), `INSUFFICIENT_CREDITS` (details.current_balance, held, available, required), `TOO_MANY_IN_FLIGHT`, `RATE_LIMITED`. Request-level 400s: `NO_FILES`, `TOO_MANY_FILES`. `NOT_AN_INVOICE` and `UNREADABLE` appear later, as the `error_code` of a `rejected` document.

*Document summary* (list items, `/v1/overview`, retry): `id, file_name, mime_type, file_size, num_pages, status, status_detail (human message for rejected/failed), error_code (NOT_AN_INVOICE|UNREADABLE when rejected), source ("upload"|"email"), source_detail ({sender, subject, inbound_email_id} for email), file_available, file_deleted_at, edited, warning_count, created_at, updated_at, processed_at, summary` where `summary` (only when processed, uses edited data when present) is `{invoice_number, invoice_date, due_date, currency, seller_name, buyer_name, grand_total}`.
*Document detail* (`GET /v1/documents/{id}`, PATCH response) = summary plus `gate {probability, document_type, legibility, accepted, reason_code}`, `markdown_text`, `invoice_data` (model output, never overwritten), `edited_data` (null until edited), `current_data` (= edited_data ?? invoice_data; render this), `confidence`, `description`, `detected_signals`, `warnings [{code,message,fields}]` (codes `LINE_TOTALS_MISMATCH | GRAND_TOTAL_MISMATCH | DUE_BEFORE_ISSUE`), `usage`.
*Invoice data schema* mirrors `src/lib/types.ts` (`invoice_metadata, seller, buyer, line_items, totals, payment_details, notes`) but **every leaf is nullable** (null = not on the document; 0 = printed zero) and `description`/`quantity` on line items are now nullable too. Update `types.ts` accordingly. Party has `name` (primary name, business name for businesses) and `company_name` (only when a person and a company both appear).
*List:* `GET /v1/documents?limit&offset&q&status=a,b` returns `{items, total, limit, offset}`; `q` searches file name, seller, buyer, invoice number. No file bytes anywhere; the source file is `GET /v1/documents/{id}/file` (410 `FILE_REMOVED` after retention; fetch with the Authorization header and use a blob URL for react-pdf).
*Edit:* `PATCH /v1/documents/{id}` body `{"edited_data": <full InvoiceData>}` (full replacement, unknown keys rejected) or `{"edited_data": null}` to reset; only for `processed`. Warnings are recomputed from the current data. *Retry:* `POST /v1/documents/{id}/retry` (only `failed`; 202, returns summary). *Delete:* `DELETE /v1/documents/{id}` -> `{deleted, ids}`; `POST /v1/documents/delete {"ids":[...]}` (max 100) -> same.
*Export:* `GET /v1/documents/{id}/export?format=json|csv|xlsx`, `POST /v1/exports {"ids":[...],"format":"xlsx"}` (max 200; skips non-processed); responses are file downloads. CSV is one row per line item (invoice fields repeated); XLSX has sheets "Invoices" and "Line items".
*`GET /v1/credits`* -> `{current_balance, held, available}`. *`GET /v1/credits/transactions?limit&offset`* -> `{items:[{transaction_id, transaction_type (signup_bonus|document_processing|refund|manual_adjustment), credits_delta, reference_file_id, file_name_snapshot, description, created_at}], total, limit, offset}`.
*`GET /v1/analytics`* -> `{total_documents_processed, total_pages_processed, total_pdfs_processed, total_images_processed}`. *`GET /v1/overview?documents_limit&history_limit`* -> `{remaining_credit, credits{current_balance,held,available}, credit_history[], user_analytics{}, user_documents[summary], documents_total}`.
*`GET/PATCH /v1/settings`* -> `{retention_days (null|7|30|90), retention_choices_days, inbound_enabled, inbound_address (null if INBOUND_EMAIL_DOMAIN unset), inbound_available}`; PATCH accepts `retention_days` (null = keep forever) and `inbound_enabled`; `POST /v1/settings/inbound-address/regenerate` rotates the address (old one stops immediately).
*`GET /v1/meta/limits`* (public) -> `{max_file_mb, max_pdf_pages, max_files_per_upload, max_inflight_per_user, uploads_per_hour, accepted_types, credits_per_page, signup_credits, retention_choices_days, inbound_email_enabled, inbound_email_domain, inbound_max_attachments, export_formats}`.
*`DELETE /v1/account`* -> `{deleted:true, documents_deleted:n}`. *`GET /v1/admin/analytics`* (`x-api-key: ADMIN_API_KEY`) -> the four analytics fields plus `total_unique_users`.

*Phase 4 reminders:* MinIO must be on the internal Docker network only (S3 client uses path-style addressing, `S3_ENDPOINT` internal URL; the bucket is created on startup if missing). `/v1/inbound/email` is public and signature-verified; Resend needs the MX record for `INBOUND_EMAIL_DOMAIN`, an `email.received` webhook to `https://api.invoicextract.zeeshanai.cloud/v1/inbound/email`, and the signing secret in `RESEND_WEBHOOK_SECRET`. The container runs migrations on start. Do not set `JWT_DEV_PUBLIC_KEY_FILE` in production (the app refuses to start).
