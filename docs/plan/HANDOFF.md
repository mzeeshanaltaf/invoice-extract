# HANDOFF log

Each session appends one entry at the end of its phase. Newest at the bottom. Never store secret values here, only env var names.

## Status board

| Phase | Status | Session date | Notes |
|---|---|---|---|
| 1 Backend | done | 2026-11-11 | 119 tests pass (+1 S3 test, run separately); live OpenAI check ALL PASS on flex tier |
| 2 Front end integration | done | 2026-11-11 | `npm run build` green; full local walkthrough passed against the Phase 1 backend; contact form stays on n8n (user decision) |
| 3 Redesign | done | 2026-11-11 | `npm run build` green; 96 screenshots; axe 0 violations (16 screens x 2 themes x 1440/375); Phase 2 flows re-walked |
| 4 Deploy | done | 2026-11-11 | API app, MinIO, DNS, jwks migration, Resend inbound all live; merged to `main` (PR #4); upload and email-in walkthroughs passed on production |
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

### Phase 2: Front end integration  (2026-11-11)
**Result:** done. All exit criteria ticked in [phase-2-frontend-integration.md](phase-2-frontend-integration.md). Work is on branch `phase-2-frontend` (cut from `phase-1-backend`); nothing committed or pushed. The working tree also still holds the earlier uncommitted doc/n8n-export files that were already there when the session started.

**Built / changed:**
- Auth: [src/lib/auth.ts](../../src/lib/auth.ts) adds `jwt()` (issuer/audience left at the defaults = `BETTER_AUTH_URL`, payload cut to `sub` only), enables `user.deleteUser`, and no longer has the n8n signup-credits hook. `jwks` table created with `npx @better-auth/cli@latest migrate` (against the **local** dev DB only; see risks).
- API client: [src/lib/api.ts](../../src/lib/api.ts). Types: [src/lib/types.ts](../../src/lib/types.ts) (new shapes, every invoice leaf nullable). Errors: [src/lib/error-copy.ts](../../src/lib/error-copy.ts). Blob hook: [src/lib/use-document-blob.ts](../../src/lib/use-document-blob.ts). `formatMoney` added to [src/lib/utils.ts](../../src/lib/utils.ts).
- Data layer: [src/lib/dashboard-context.tsx](../../src/lib/dashboard-context.tsx) (overview + document list, polling, detail cache).
- Deleted: `src/lib/n8n.ts`, `src/lib/session.ts` (only the deleted routes used it), `src/app/api/{ocr,documents,user-data,analytics,credits}`, `components/dashboard/processing-dialog.tsx`.
- Renamed to InvoicExtract: UI copy, metadata, JSON-LD, manifest, OG/Twitter images, OTP email template, README, CLAUDE.md line 7, `package.json` + lockfile name. Mistral removed from `src/` and the README tagline; privacy policy now says OpenAI (also retention + deletion wording, "Last updated" bumped to November 11, 2026; **owner should read it**).

**Component / page map (Phase 3 restyles all of these).** Dashboard shell: `(dashboard)/layout.tsx`, `components/dashboard/{sidebar,top-nav}.tsx`, new `api-error-banner.tsx`. Pages: `dashboard/page.tsx` (overview), `upload/page.tsx` + `components/dashboard/upload-form.tsx`, `documents/page.tsx` (list with select, bulk export/delete, retry, preview), `documents/[fileId]/page.tsx` (detail; read view, edit mode, warnings, exports), `credits/page.tsx`, `settings/page.tsx` (retention select, email-in toggle/address/regenerate, delete account). New shared pieces: `components/dashboard/{status-badge,document-preview,invoice-editor}.tsx`, `components/ui/pdf-viewer.tsx` (now `documentId`-driven), `ui/dialog.tsx` gained `DialogFooter`. Marketing and auth screens were only renamed/copy-edited. Raw `<input type="checkbox">`/`<select>` are used (no shadcn Checkbox/Select in the repo); the Phase 3 pass should replace them.

**How `api.ts` and the context are used.**
- `api.<method>()` (overview, credits, transactions, analytics, listDocuments, getDocument, upload, editDocument, retryDocument, deleteDocuments, documentFile, exportDocument, exportDocuments, settings, updateSettings, regenerateInboundAddress, deleteAccount, limits). Failures throw `ApiError {status, code, message, details}` (`code` is the API envelope code, or `NETWORK_ERROR` / `API_NOT_CONFIGURED` / `UNAUTHORIZED` client-side). `saveBlob(blob, name)` triggers a download. `resetApiAuth()` drops the cached token: called on sign-out, on account deletion and whenever the dashboard provider mounts.
- Token: `GET /api/auth/token` (session cookie), cached, refreshed when under 60 s remain, concurrent calls share one request; on a 401 it refetches once and retries once, then throws (no loops).
- `useDashboardData()` returns `analytics, credits {current_balance, held, available}, creditHistory, documents, documentsTotal, isLoading, hasInFlight, error, refreshAll, refreshDocuments, getDocumentDetail, putDocumentDetail, deleteDocuments`. It loads `/v1/overview?documents_limit=1&history_limit=100` plus `/v1/documents?limit=100` (no pagination yet), polls the list every 2 s only while a document is queued/validating/extracting (skips when the tab is hidden), and refreshes credits/analytics when something leaves the in-flight set. Detail cache holds terminal-state documents only and is invalidated when a list item's `updated_at` changes. The credit badge and upload copy show `available` (balance minus held).
- `components/ui/pdf-viewer.tsx` takes `documentId`, fetches `/file` as a blob and keeps the `canvas` alias / `ssr: false` (loaded through `components/dashboard/document-preview.tsx`).

**Deviations from plan** (phase files edited to match):
1. **Contact form stays on n8n** (user decision at the start of the session): route untouched, no Resend/`CONTACT_TO_EMAIL`. Phase 2 task 6, Phase 4 (env + contact check) and Phase 5 (sweep) edited. Consequence: n8n must keep running the contact webhook; `src/` still contains `N8N_API_KEY`/`N8N_CONTACT_WEBHOOK_URL` and the payload value `source: "invoiceextract"` (left unchanged because the n8n side may route on it; rename only if you check the workflow).
2. **`jwtClient()` not added**: it breaks type-checking on better-auth 1.6.24 (and the `emailOtp` typings with it); `api.ts` uses `authClient.$fetch("/token")` instead.
3. Client-side credit pre-check removed from the upload form (it raced the first balance load); the API answers each file with `INSUFFICIENT_CREDITS`.
4. `session.ts`/`getUserId()` deleted. CLAUDE.md still describes it (Phase 5 rewrite).

**Env vars / secrets:** added `NEXT_PUBLIC_API_URL` (**build-time**; production value `https://api.invoicextract.zeeshanai.cloud`, set in Phase 4). Removed `N8N_WEBHOOK_BASE_URL`. Kept `N8N_API_KEY`, `N8N_CONTACT_WEBHOOK_URL` (contact form). `.env.local` and `.env.example` updated (gitignored). New local-only [.env.development.local](../../.env.development.local) overrides `DATABASE_URL` for `next dev`, because **`.env.local` points `DATABASE_URL` at the production VPS database**.

**How to run (both services):**
```
# 0. local Postgres container already used by the backend: invoicextract-dev-postgres on 127.0.0.1:5434
# 1. once: Better Auth tables incl. jwks in the LOCAL db (pass the local URL explicitly; never run this against .env.local's URL by accident)
DATABASE_URL=postgresql://postgres:devpass@127.0.0.1:5434/invoicextract RESEND_API_KEY=x npx @better-auth/cli@latest migrate --yes   # BETTER_AUTH_SECRET/BETTER_AUTH_URL also in env
# 2. backend (from backend/), NO JWT_DEV_PUBLIC_KEY_FILE: it verifies real Better Auth tokens via http://localhost:3000/api/auth/jwks
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --port 8000
# 3. front end (from repo root); .env.development.local supplies the local DATABASE_URL
npm run dev        # http://localhost:3000
npm run build      # must pass; NEXT_PUBLIC_API_URL is read from .env.local at build time
```
Backend defaults (`BETTER_AUTH_URL`, `ALLOWED_ORIGINS` = `http://localhost:3000`) already match. For the email-in settings controls start the backend with `INBOUND_EMAIL_DOMAIN=<any domain>`; without it Settings shows "Email-in is not available yet".

**Verification results (real runs, Playwright/Chromium against both services; scripts were throwaway, kept outside the repo):**
- `npm run build`: passes (Next 16.1.6, TypeScript clean). `grep` for `n8n|Mistral|InvoiceExtract` in `src/`: only the contact route's `N8N_*` reads and its `source` value (see deviation 1).
- Sign-up through the UI landed on `/verify-email`; OTP entry (code recovered by brute-forcing the hash in the local DB, since email can't be read) signed in; dashboard showed **5 credits** after the first API request. JWT accepted by the backend, no 401, CORS fine from `http://localhost:3000`.
- Bulk upload of 6 files (2-page invoice PDF, phone JPEG, landscape picture, encrypted PDF, 11-page PDF, `.txt`): `.txt` refused client-side; `PDF_ENCRYPTED` and `PAGE_LIMIT_EXCEEDED` shown per file with friendly text; 3 queued. Statuses moved Queued → Checking → Extracting → Processed/Rejected live (list polled every ~2.0 s, 29 polls, **0 polls once everything settled**). Landscape picture rejected as `NOT_AN_INVOICE`, no charge; credits 5 → 2 (2 + 1 pages); results matched the documents (`INV-2026-1187` GBP 572.52 with 8 lines; `0330-00012` USD 24.99).
- Detail view; edit + save (persisted over reload); number input keeps `12.` while typing; reset to extracted data; exports xlsx/csv/json downloaded and opened (xlsx has "Invoices" + "Line items" sheets; bulk xlsx has 2 invoices); PDF preview rendered from `/file` (canvas) and image preview via blob URL; delete via selection + confirm stayed deleted after reload.
- Settings: retention persisted, email-in toggle persisted, address regeneration rotated it. 401 handling: a single injected 401 caused exactly one token refetch and one retry and the page loaded; a permanent 401 stopped after one retry and showed the error banner (no loop).
- Account deletion from Settings: `DELETE /v1/account` then `authClient.deleteUser()`; afterwards 0 rows in documents/credit_accounts/credit_transactions/user_settings, 0 stored files, Better Auth user and sessions gone, sign-in returns 401, the old cookie is bounced to `/sign-in`.
- Contact form: only validation (400 on a bad email) and the honeypot success/303 paths were exercised, plus unchanged code. **A real submission was not sent** (it would fire the live n8n webhook); do one after deploy.
- Not run: sign-up with Google; a second user; dark-mode pass; real Resend email-in; the Settings "stale session" message for account deletion (Better Auth needs a session younger than 24 h, the screen pre-checks it and asks the user to sign in again).

**Open issues / risks:**
- `.env.local` `DATABASE_URL` is the production database. The `jwks` migration has **not** been run there (Phase 4 must run it before the new front end goes live). Be careful running Better Auth CLI/dev tools from this folder.
- Deleting an account and signing up again with the same email re-grants the 5 signup credits (the bonus is tied to the new user id). Pre-existing product trait, but worth knowing now that deletion is self-serve.
- The documents list loads the latest 100 only (shows "Showing the latest N of M"); no pagination, search box or status filter UI yet although the API supports them.
- Dev React strict mode doubles the initial dashboard fetches (production does not).
- Privacy policy wording (OpenAI, retention, deletion) was written by me; the owner should review it. The README and CLAUDE.md still describe n8n/Mistral beyond the renamed title (Phase 5).
- Native `<select>`/checkbox inputs, plain confirm dialogs (`window.confirm` for reset and address regeneration) and the editor layout are functional placeholders.

**Next phase must know:**
- Placeholder UI awaiting Phase 3: document editor (`invoice-editor.tsx`), bulk-action bar and checkboxes on the documents list, settings controls, upload results list, the processing state (the old shimmering dialog is gone; in-flight is a spinner badge on the list and a spinner card on the detail page), `window.confirm` prompts, plain status badges. Keep the behaviours: select-all, retry on `failed`, `Original`/`Preview` hidden when `file_available` is false (retention/rejected), warnings alert, edited badge.
- Dashboard pages read `credits.available`, not a single balance. `UserDocument.id` replaced `file_id`; the route folder is still `documents/[fileId]` but the value is the document id.
- Error code copy lives in `src/lib/error-copy.ts` (upload codes, `NOT_AN_INVOICE`, `UNREADABLE`, request-level codes); extend there.
- The `/api/auth/token` and `/api/auth/jwks` routes come from the `jwt()` plugin and need no middleware changes (the middleware only guards `/dashboard`).
- Phase 3's regression walkthrough should include the contact form with JS disabled (native post, n8n-backed).

### Phase 3: Redesign  (2026-11-11)
**Result:** done. All exit criteria ticked in [phase-3-redesign.md](phase-3-redesign.md). Work is on branch `phase-3-redesign` (cut from `phase-2-frontend`); nothing committed or pushed. The working tree still also holds the Phase 1 and Phase 2 uncommitted work that was already there. Image probes were skipped as planned (no native image generation); the invoice specimen is built in HTML.

**Where things live:**
- [PRODUCT.md](../../PRODUCT.md) (strategy: register brand for marketing, product for the app; users, personality, anti-references, principles, WCAG AA) and [DESIGN.md](../../DESIGN.md) (tokens, components, motion, do's and don'ts; Stitch format, OKLCH in the frontmatter). [CLAUDE.md](../../CLAUDE.md) has a new "Design system" section pointing at both. Tokens are in [src/app/globals.css](../../src/app/globals.css).
- **Fonts** (via `next/font/google`, in [src/app/layout.tsx](../../src/app/layout.tsx)): **Besley** (display slab: headlines, wordmark, app page titles, dialog titles only), **Schibsted Grotesk** (UI and body), **Geist Mono** (figures and JSON only, class `.figures`). None is on the reflex-reject list. The Google fonts are fetched at build time, so the Coolify build needs outbound network (it already did for Geist).
- **Tokens (all OKLCH, neutrals tinted)**: paper `oklch(0.975 0.012 88)`, sheet `0.992 0.006 88`, ink `0.22 0.035 262`, **vermilion primary `0.55 0.19 33`** (dark `0.7 0.16 36`), ledger green `0.46 0.1 155` (washes for badges), amber `0.48 0.1 72`, crimson destructive `0.5 0.2 22`, focus blue `0.45 0.12 260`, sidebar "paper warm" `0.952 0.02 82`, marketing ink band `0.24 0.04 262`. Radius 6px base. New semantic tokens: `success`, `success-soft`, `warning`, `warning-soft`, `band`, `band-foreground`, `rule`; utilities `.figures`, `.eyebrow`, `.ledger-lines`, `.col-rules`, `.stamp-underline`, `.paper-sheet`, `.spec-f`, `.hero-row`. Dark is "ink paper" (same roles, tuned).
- **Brand components** ([src/components/brand/](../../src/components/brand/)): `invoice-specimen.tsx` (`HeroSpecimen` scan + ledger + stamp, `AnnotatedSpecimen` with pins and leader lines, `StaticSpecimen` for auth; uses `motion`), `stamp.tsx` (+ the shared SVG filter, rendered in the root layout), `logo.tsx`.
- **Marketing**: [src/app/(marketing)/page.tsx](../../src/app/(marketing)/page.tsx) (hero, what gets read, the gate on a vermilion band, how it works, developers on an ink band, price list, FAQ, closing band), About, Contact, Privacy, Terms; [src/components/marketing/](../../src/components/marketing/) (navbar with a mobile sheet menu, footer, `gate-specimens`, `developer-exports`, `faq`). **Auth**: [auth-shell.tsx](../../src/components/auth/auth-shell.tsx) split layout wraps all four auth pages; form logic untouched. **App**: restyled shell (`sidebar` with an always-visible credit balance, `top-nav`, `page-header`, skip link), Overview (needs attention first, recent, ledger strip, first-upload teaching state), Upload (rows with live status, pre-checks, chunking, Retry), Documents (search, status filter, multi-select, export, inline delete confirm), Document detail (inline source left, editable ledger right with "Check" marks from `warnings[].fields`, Ledger/Transcript/File tabs, phone switch), Credits (ledger), Settings (profile, email-in, retention, typed-phrase delete).
- New UI primitives: `checkbox` (Radix), `switch` (Radix), `native-select`, `textarea`; `button` gained `outline-destructive`, `badge` and `alert` gained `success`/`warning` variants.

**Deviations from plan** (all recorded in the phase file): pricing is a price list with no invented prices; About rewritten (its stats were invented); detail ledger is always editable; inline source preview replaced the dialog; search/filter use the API; settings save optimistically; OTP email, OG/Twitter images, icons and manifest moved to the new palette; no `DESIGN.json`. `hero_section_bg.png`, `pricing-cta.tsx`, `invoice-editor.tsx` are deleted.

**Env vars / secrets added:** none.

**How to run / test:** as in the Phase 2 entry. For this session I also started the stopped Docker container `invoicextract-dev-postgres` and stopped it again at the end; the dev server was run with `RESEND_API_KEY=x` so no real email could be sent, and the backend with `INBOUND_EMAIL_DOMAIN=in.example.test` so the email-in controls show. A throwaway local user was created through the UI and **deleted again** (account deletion was part of the test). Playwright/axe scripts were throwaway and live outside the repo.

**Verification results (real runs, local stack):**
- `npm run build`: passes (twice, before and after the last edits).
- **Screenshots**: [docs/plan/phase-3-screenshots/](phase-3-screenshots/) holds 96 JPEGs named `<screen>-<width>-<theme>.jpg` (screens: home, about, contact, privacy, terms, sign-in, sign-up, verify-email, forgot-password, overview, upload, documents, document-detail, document-rejected, credits, settings; widths 375/768/1440; light and dark) plus `hero-reduced-motion-1440-light.png`. App screens were captured on tall viewports because the shell scrolls internally. Empty-state and mid-upload shots are not in the set.
- **Contrast**: token pairs for both themes checked by script (all text pairs >= 4.5:1, control edges and focus ring >= 3:1; numbers are in DESIGN.md). axe-core (WCAG 2.0/2.1/2.2 A and AA tags) on 16 screens x light/dark x 1440/375: first run 32 findings, all fixed (inactive tab color 4.46:1, unlabeled OTP input, unlabeled PDF page buttons, invalid `dl`, unfocusable scroll regions, credit chip label); final run **0 violations**. 768 was not axe-scanned (it was reviewed visually).
- **Reduced motion**: with `prefers-reduced-motion: reduce` the hero shows all 9 ledger rows, all underlines and the stamp at once, and no replay control. Without it, the scan starts empty, ends complete, and Replay resets it.
- **Keyboard**: tab order on home and Documents checked (skip link first in the app; every focused control shows a 2px outline). This found a real bug: Tailwind v4's `outline-none` cancels `focus-visible:outline-*`; removed from all controls (recorded in CLAUDE.md and DESIGN.md). Retention radios operate with arrow keys.
- **Phase 2 regression**: upload of 6 mixed files (2-page invoice PDF, phone JPEG, landscape picture, locked PDF, 11-page PDF, .txt) gave INV-2026-1187 GBP 572.52 and 0330-00012 USD 24.99 extracted, the picture rejected as NOT_AN_INVOICE, locked and 11-page PDFs refused with plain reasons, .txt blocked client-side; credits 5 -> 2; documents list, search, status filter, selection, bulk XLSX export; detail edit, save, persistence over reload, reset to original, XLSX/CSV/JSON exports, inline PDF preview; credits; retention and email-in persistence and address regeneration; **account deletion** (documents, credit rows, settings, Better Auth user and sessions all 0 afterwards; old cookie bounced to `/sign-in`); contact form with JavaScript disabled renders with `action="/api/contact" method="post"` and the `hp_field` honeypot, and a native form-encoded post answers 303.
- **Not exercised**: an actual bulk document delete (only the confirm row was opened and cancelled; the Phase 2 delete path is unchanged), Google sign-up, a second user, real Resend delivery or email-in, a real contact-form submission (would fire the live n8n webhook), the "stale session" message on account deletion, `main` checkout (nothing pushed).

**Copy that makes product claims the owner should review:**
- Landing: "Not an invoice? It costs nothing" and the list of what is stopped before any credit moves (password-protected PDFs, over 10 MB, over 10 pages, duplicates); "one credit reads one page, only spent when read successfully"; the FAQ answers on retention ("only the original PDF or image is removed; extracted data stays"), "Pages are sent to OpenAI's API", and **email-in** ("Each account can turn on a private address"; this is only true once Phase 4 sets up Resend inbound); "More credits: planned, not on sale yet"; the sample invoice and the sample JSON/CSV/sheet (field names and CSV/XLSX headers are the real ones, values are made up).
- About: the four principles and "Pages are read by OpenAI models. We then check the result against itself".
- Contact: "a person reads it" and "reply to the address you gave"; Upload page: "Ask us for more" when credits hit zero (implies the owner will grant credits).
- Settings: the retention statement of what is and is not deleted, and "a change also applies to documents you already have, at the next sweep" (taken from the plan; confirm the backend sweep behaves that way).
- The privacy policy text written in Phase 2 is unchanged; terms are untouched apart from dashes and heading styles.

**Open issues / UI debt:**
- The Documents and Overview lists still load the latest 100 only (search reaches older ones; there is no pagination).
- The hero measures its fields' positions at play time; if the specimen markup changes, re-check that underlines still fire as the scan passes them.
- Stamps use an SVG filter (`#stamp-ink`); it is cheap but is the one piece worth a glance on very old devices.
- The IDE flags many Tailwind "canonical class" suggestions (e.g. `max-w-[26rem]`) in new files; they are style hints, not errors, and were left.
- Dark-mode OG/Twitter cards do not exist (one light card for both). The OG card uses a sans because satori could not load Besley.
- `README.md` and CLAUDE.md still describe n8n/Mistral beyond the renamed title and the new Design section (Phase 5).
- In dev only, a native contact post redirects to `http://0.0.0.0:3000/contact?sent=1` because `next dev` runs with `--hostname 0.0.0.0`; production uses the real host.

**Next phase must know:**
- Phase 4 still needs `NEXT_PUBLIC_API_URL` (build-time), the `jwks` migration on the production database, MinIO, Resend inbound and the Coolify wiring; the redesign adds no env vars. `next/font/google` needs network at build.
- The root `.gitignore` is unchanged; `docs/plan/phase-3-screenshots/` is about 10 MB of JPEGs (commit it or drop it as you prefer).
- Keep to DESIGN.md for any later UI: vermilion only for the single primary action and stamps, green only for extracted/verified, `.figures` for numbers, no em dashes, no `outline-none` on controls, errors inline (no toasts).

### Phase 4: Deploy  (2026-11-11)
**Result:** done. Merged to `main` as PR #4 (merge commit `42d5022`); both apps deployed that commit. Resend inbound was first skipped (the original `RESEND_API_KEY` is send-only: 401 `restricted_api_key` on `/domains`, `/webhooks` and `/emails/receiving`) and then completed later the same day with a full-access key supplied by the owner (see "Resend inbound" below).

**Built / done:**
- Coolify app `invoicextract-api`, uuid `mgqho7lywpzcemeetsquuzww`, in project InvoiceExtract (`l66wvnnarhp24do4gmsq5ew0`), repo `mzeeshanaltaf/invoice-extract`, branch `main`, Dockerfile build, base directory `/backend`, port 8000, Coolify healthcheck `/healthz`, domain `https://api.invoicextract.zeeshanai.cloud` (Let's Encrypt issued). Migrations run on container start (`0001` applied to production).
- Web app (unchanged uuid `olum0706y4co8k8pd601uksb`): added `NEXT_PUBLIC_API_URL` (build-time), removed `N8N_WEBHOOK_BASE_URL` (prod and preview rows). `N8N_API_KEY`, `N8N_CONTACT_WEBHOOK_URL` kept.
- DNS (Hostinger, zone `zeeshanai.cloud`): added `A api.invoicextract -> 76.13.7.106`, TTL 300. Added only; nothing overwritten.
- MinIO: Coolify service `minio`, uuid `xblbivkonwhqvnq15tqyxguf`, container `minio-xblbivkonwhqvnq15tqyxguf`, volume `minio-data`, on the shared `coolify` network, no published ports, no domain. Private bucket `invoicextract-documents`. The API uses a **dedicated user/key** with a policy limited to that bucket (policy `invx-app`), not the root credentials. Root credentials live only in the service's compose in Coolify.
- Better Auth `jwks` table created in the production `invoice_extract` schema (additive; the CLI listed only `jwks` fields).
- [deploy.yml](../../.github/workflows/deploy.yml) triggers web and API apps in turn, each with the retry loop (POST, 90 s per attempt, 20 s backoff), new repo secret `COOLIFY_API_APP_UUID`. Merge ran it green.
- [backend/Dockerfile](../../backend/Dockerfile) now installs `curl`.

**Deviations from plan:**
1. Coolify's healthcheck shells out to curl/wget; the slim Python image had neither, so the first deploy was rolled back as unhealthy. Fixed by installing curl in the image.
2. `main` had gained a commit (`1dcc94b`, POST for the Coolify deploy API: this Coolify version, 4.7.5, rejects GET). Merged into the branch; the conflict in deploy.yml was resolved keeping the two-app loop with main's timeouts.
3. Bucket created with the `mc` binary inside the MinIO container (the `minio/mc` image could not be pulled).
4. The API app was first deployed from branch `phase-4-deploy` to test before the merge, then switched to `main`.
5. Untracked reference files (`n8n_workflows/*.json`, `docs/n8n_webhooks.txt`, SEO plan, shimmer notes) were **deliberately not committed**: the n8n exports contain a hardcoded webhook `api-key` and the repo is public. The staged-as-deleted `n8n_workflows/Webhooks.txt` is also untouched. Decide in Phase 5 whether to keep any of them (scrub keys first, and consider rotating the n8n webhook key).

**Resend inbound (added later 2026-11-11):**
- Resend domain `in.invoicextract.zeeshanai.cloud` (id `107ff59f-e05f-4aa5-95c5-59d422955bcf`, us-east-1, receiving enabled, sending disabled), verified. Hostinger DNS records added, subdomain only: `MX in.invoicextract -> 10 receive.forge.rmta.net.` and `TXT resend._domainkey.in.invoicextract` (DKIM). Root-domain mail records untouched.
- Webhook `9caff786-7461-4171-a884-bf36a72ab593`, event `email.received`, endpoint `https://api.invoicextract.zeeshanai.cloud/v1/inbound/email`. Signing secret stored only as `RESEND_WEBHOOK_SECRET` on the API app.
- The API app's `RESEND_API_KEY` was **replaced with a full-access key**: the API must read received emails and attachments, which a send-only key cannot do. The web app keeps its send-only key. `.env.local` holds the full-access key as `RESEND_FULL_ACCESS`; suggested Resend name for it: `invoicextract-api-prod` (the account lists it as `InvoicExtract-Email-In`).
- Test, real production path: throwaway account on `delivered+...@resend.dev`, email-in enabled in Settings, one email with the sample invoice PDF sent to its private address; the webhook was accepted, the document appeared with `source: email`, sender and subject, processed (`INV-2026-1187`, GBP 572.52) in 68 s, 2 credits used (5 -> 3); account deleted afterwards. A text-only probe to the same domain was also received and answered 200.
- One earlier test email (with PDF) stayed at "sent" in Resend and was never delivered or received (cause unknown, Resend side; the retest and the probe both worked). The first test run also left orphan backend rows because its token expired (15 min) before cleanup; I removed them by user id. A different, unrelated signup (`sweep+...@example.test`, not mine) also appeared in Resend's send log at the time.

**Env vars (names only).** API app, all runtime: `ENVIRONMENT=production`, `DATABASE_URL` (host `10.0.0.1:5432`), `OPENAI_API_KEY`, `BETTER_AUTH_URL`, `ALLOWED_ORIGINS`, `ADMIN_API_KEY`, `STORAGE_DRIVER=s3`, `S3_ENDPOINT` (internal MinIO URL), `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. Inbound: `INBOUND_EMAIL_DOMAIN=in.invoicextract.zeeshanai.cloud`, `RESEND_WEBHOOK_SECRET` (and `RESEND_API_KEY` is the full-access key). Web app: as before plus `NEXT_PUBLIC_API_URL` (build-time). GitHub repo secrets: `COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID`, `COOLIFY_API_APP_UUID`.

**Verification results (production, real runs):**
- `/healthz` and `/readyz` 200 on the API domain; Let's Encrypt cert; Coolify shows `running:healthy` (API); web home 200, `/api/auth/jwks` 200. Deploy logs clean.
- CORS: preflight from `https://invoicextract.zeeshanai.cloud` returns that origin in `Access-Control-Allow-Origin`; from `https://evil.example` the preflight is refused (400). No-token request gives 401 `UNAUTHORIZED`.
- Full live walkthrough with a throwaway account on `delivered+...@resend.dev`: sign-up, OTP verify (code recovered from the hashed verification row), sign-in, `/api/auth/token`, API accepted the JWT, 5 signup credits, uploaded the 2-page sample invoice PDF, processed in 55 s on the flex tier (`INV-2026-1187`, GBP 572.52), credits 5 -> 3, source file streamed back from MinIO (`%PDF`), XLSX export, `DELETE /v1/account` then Better Auth user delete: 0 users, 0 documents left. An earlier attempt of the same script created a second throwaway user before failing on a missing Python module; I removed it with SQL matched by its test email only. No real user data was touched.
- Contact form: one POST to `/api/contact` returned `{"success":true}` (n8n webhook, name "Deploy check"); the owner should see it arrive. Not verified from my side.
- MinIO: `docker port` shows no published ports; `http://76.13.7.106:9000` from the public internet times out. DB host is `10.0.0.1`.
- VPS after builds: disk 60% of 96G (was 49%), cron active, weekly prune entry present.
- **Not exercised:** the browser UI on production (only the HTTP flow above), Google sign-in, the summary reply email (sent to a `resend.dev` test address, delivery not inspected), a real contact message read by a person.

**Open issues / risks:**
- **Resend inbound:** live. Remaining: real-world check by forwarding an actual invoice from a normal mailbox; confirm the summary reply reaches the owner; rename the Resend key as suggested; the full-access key now lives in Coolify (API app) and `.env.local`, so rotate it if either leaks.
- The weekly prune now has ~2 more images to keep; disk grew 11 points from this phase's builds.
- Single-process API: a redeploy briefly overlaps old and new containers (data-safe per Phase 1 notes).
- Docs-only commits for this handoff are on branch `phase-4-deploy` (pushed), **not on `main`**, to avoid triggering a redeploy. Cut `phase-5-cutover` from `phase-4-deploy` (or merge it first).
- The old `user_documents`, `user_credit_accounts`, `user_credit_transactions` tables still exist (Phase 5).
- Gate thresholds still validated on synthetic samples only.

**Next phase must know:** the live site now runs the rebuilt stack, so Phase 5's table drop is only safe with a fresh look at what still reads them (nothing in `src/` or `backend/` should). The n8n instance is still needed for the contact form only. CLAUDE.md and the memory file `invoice-extract-deployment.md` are stale (they describe nixpacks, n8n and a single app); rewrite them with the uuids above.
