# InvoicExtract backend

FastAPI service that replaces the n8n workflows: upload (bulk, async), invoice gate (OpenAI Decisions),
structured extraction (OpenAI Responses, `gpt-6-luna`, flex tier), credits, edit, export, MinIO/S3
storage, email-in (Resend) and source-file retention. Plan: [docs/plan/phase-1-backend.md](../docs/plan/phase-1-backend.md).

## Run locally (Windows paths shown; works the same on Linux/macOS)

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt

# Postgres (a dedicated dev container; any Postgres 14+ works)
docker run -d --name invoicextract-dev-postgres -e POSTGRES_PASSWORD=devpass \
  -e POSTGRES_DB=invoicextract -p 127.0.0.1:5434:5432 postgres:17

cp .env.example .env            # then put OPENAI_API_KEY in .env (gitignored)
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python scripts/mint_token.py --user test_user_1      # creates .devkeys/, prints a JWT
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Then:

```bash
TOKEN=$(.venv/Scripts/python scripts/mint_token.py --user test_user_1)
curl -s localhost:8000/healthz
curl -s localhost:8000/v1/credits -H "Authorization: Bearer $TOKEN"
curl -s -X POST localhost:8000/v1/documents -H "Authorization: Bearer $TOKEN" -F files=@invoice.pdf -F files=@photo.jpg
curl -s localhost:8000/v1/documents -H "Authorization: Bearer $TOKEN"
```

OpenAPI: <http://localhost:8000/docs> and `/openapi.json`. Files are stored under `./.storage` unless
`STORAGE_DRIVER=s3`.

`JWT_DEV_PUBLIC_KEY_FILE` makes the API trust tokens from `scripts/mint_token.py`. It is a local-testing
shortcut: the app refuses to start with it set when `ENVIRONMENT=production`.

## Tests

```bash
.venv/Scripts/python -m pytest          # needs the Postgres above (TEST_PG_ADMIN_URL overrides the admin URL)
```

The suite creates a separate `invoicextract_test` database, runs a real `alembic upgrade head` on a clean
schema, and mocks OpenAI and Resend. To also run the S3 test against a throwaway MinIO:

```bash
docker run -d --name invoicextract-dev-minio -p 127.0.0.1:9100:9000 \
  -e MINIO_ROOT_USER=devminio -e MINIO_ROOT_PASSWORD=devminio-secret minio/minio server /data
TEST_S3_ENDPOINT=http://127.0.0.1:9100 TEST_S3_ACCESS_KEY=devminio TEST_S3_SECRET_KEY=devminio-secret \
  .venv/Scripts/python -m pytest tests/test_storage_retention.py -k s3
```

### Live check with the real OpenAI key

With the server running (see above): `.venv/Scripts/python scripts/live_check.py`. It generates a 2-page
invoice PDF, a phone-style JPEG, a non-invoice picture, an 11-page PDF, an 11 MB file, an encrypted PDF
and a duplicate, waits for the worker, and compares the stored JSON with known values. It costs a few
cents and deletes its own test user at the end. `scripts/probe_openai.py` is the SDK-surface probe.

## Docker

```bash
docker build -t invoicextract-backend backend
docker run --rm -p 8000:8000 -e DATABASE_URL=postgresql://... -e OPENAI_API_KEY=... \
  -e BETTER_AUTH_URL=https://invoicextract.zeeshanai.cloud -e ALLOWED_ORIGINS=https://invoicextract.zeeshanai.cloud \
  -e ENVIRONMENT=production invoicextract-backend
```

The entrypoint runs `alembic upgrade head` (skip with `RUN_MIGRATIONS=0`) and then a **single** uvicorn
worker: the job loop and retention sweep run inside the process, so do not scale it horizontally without
reading the notes below.

## How it fits together

- **Intake** (`services/intake.py`): magic-byte type check, size, page count, encrypted PDFs, image pixel cap,
  per-user SHA-256 duplicate check, soft credit hold, in-flight and hourly caps. Shared by upload and email-in.
- **Worker** (`services/worker.py`): claims `queued` rows with `FOR UPDATE SKIP LOCKED`, renders pages,
  runs the gate, extracts, runs sanity checks, then marks `processed` + deducts credits in one transaction.
  A claim token (`attempts`) stops a stale job from double-charging after a restart.
- **Flex handling** (`services/extraction.py`): flex tier, backoff on 429/timeouts, then one attempt on
  `OPENAI_FLEX_FALLBACK_TIER`. The tier used is stored in `documents.usage`.
- **Credits are charged only when a document is processed.** Rejections and failures cost nothing.
- **Storage**: bytes never touch Postgres. Local driver for dev, S3/MinIO for production.
- **Retention** (`services/retention.py`): hourly sweep deletes expired source files and any orphaned objects.

## Operational notes

- Single process by design. Starting a second instance (e.g. a rolling deploy overlap) is safe for data
  (claims use row locks, charging is guarded), but both may run the retention sweep and re-queue rows the
  other is working on, which can cost a duplicate OpenAI call.
- A document stuck mid-flight is re-queued on restart, and fails after `MAX_ATTEMPTS` crashes.
- The API creates a user's credit account (with the signup bonus) on their first authenticated request.
  `DELETE /v1/account` removes the backend data only; deleting the Better Auth user is the front end's job.
