# InvoicExtract

AI invoice data extraction. Upload PDFs or phone photos (one at a time or in bulk), or email them to a private address, and get structured, checked invoice data back as JSON, CSV or XLSX. Non-invoices are rejected before any credit is spent.

Live at <https://invoicextract.zeeshanai.cloud>. The API runs at `https://api.invoicextract.zeeshanai.cloud` (OpenAPI docs at `/docs`).

## Features

- **Invoice gate**: every upload is checked first (OpenAI Decisions API). Not an invoice, or unreadable? It is rejected and costs nothing.
- **Structured extraction**: header, seller, buyer, line items, totals and payment details as JSON (`gpt-6-luna` vision). Every field is nullable: `null` means "not on the document".
- **Self-checks**: line totals, grand total and due-before-issue dates are verified, and mismatches show up as warnings on the exact fields.
- **Bulk upload and email-in**: up to 10 files at a time, or turn on a private inbox address in Settings and forward invoices to it.
- **Edit and export**: correct extracted fields in the ledger view (the original model output is kept), export JSON, CSV (one row per line item) or XLSX.
- **Credits**: 1 credit per page, charged only when a page is read successfully; 5 credits on signup. In-flight documents hold credits until they finish.
- **Limits**: 10 MB per file, 10 pages per PDF, duplicate detection per user (all API config).
- **Retention**: choose how long original files are kept (7, 30, 90 days or forever); extracted data stays.
- **Account control**: delete documents, or the whole account, from the app.

## Architecture

```
Browser ──(Better Auth cookie)──> Next.js   auth, marketing, dashboard UI, contact form
   │                                └─ /api/auth/* incl. /token and /jwks (JWT plugin)
   └──(Authorization: Bearer JWT)──> FastAPI   api.invoicextract.zeeshanai.cloud
                                       ├─ Postgres, schema invoice_extract
                                       ├─ MinIO (private bucket, internal Docker network)
                                       └─ OpenAI: Decisions (gate) + Responses (extraction)
Resend inbound ──(signed webhook)──> FastAPI /v1/inbound/email
```

The Better Auth user id (JWT `sub`) is the single key for all backend data. See [CLAUDE.md](CLAUDE.md) for the rules that keep it that way, and [backend/README.md](backend/README.md) for the API internals.

## Tech stack

- **Web:** Next.js 16.1.6 (App Router), React 19, TypeScript 5, Tailwind CSS v4 (OKLCH), shadcn/ui (new-york), Besley + Schibsted Grotesk + Geist Mono, `motion`
- **Auth:** Better Auth (email/password + Google OAuth, email OTP verification and password reset via Resend, JWT plugin for the API), Postgres `invoice_extract` schema
- **API:** FastAPI, SQLAlchemy 2 (async) + Alembic, a Postgres-backed job queue and in-process worker, OpenAI (`gpt-6-luna`, flex tier), pypdfium2 + Pillow for rendering, boto3 for MinIO/S3, Svix for webhook verification
- **Contact form:** honeypot + Upstash Redis rate limiting; submissions are forwarded to an n8n webhook (the only remaining n8n use)
- **Analytics:** self-hosted Umami (cookieless)
- **Deployment:** Coolify on a Hostinger VPS (web app + API app + MinIO), auto-deploy from `main` via GitHub Actions

## Quick start

### Prerequisites

- Node.js 20+ and npm
- Python 3.12 (API) and Docker (a local Postgres for development)
- Google OAuth credentials for social sign-in
- A Resend account with a verified sending domain (auth OTP emails); a full-access key and an inbound domain are needed only for email-in
- An OpenAI API key with access to `gpt-6-luna`
- Upstash Redis (contact-form rate limiting) and a Umami instance (analytics), both optional locally

### 1. Local database

```bash
docker run -d --name invoicextract-dev-postgres -e POSTGRES_PASSWORD=devpass \
  -e POSTGRES_DB=invoicextract -p 127.0.0.1:5434:5432 postgres:17
```

### 2. Web app

```bash
npm install
```

Copy `.env.example` to `.env.local` (and put the local `DATABASE_URL` in `.env.development.local` so `next dev` never touches a real database):

```env
# Better Auth
BETTER_AUTH_SECRET=your_secret            # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000     # prod domain in production (build-time on Coolify)

# Google OAuth (redirect URI: <BETTER_AUTH_URL>/api/auth/callback/google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Database (Better Auth tables in the invoice_extract schema)
DATABASE_URL=postgresql://postgres:devpass@127.0.0.1:5434/invoicextract

# Resend: sends the auth OTP emails (verification + password reset).
# RESEND_FROM_EMAIL is unquoted on purpose: dotenv strips quotes locally but
# Coolify does not, and Resend rejects a quoted `from` with a 422.
RESEND_API_KEY=re_your_key
RESEND_FROM_EMAIL=InvoicExtract <noreply@verification.yourdomain.com>

# InvoicExtract API (the FastAPI service). NEXT_PUBLIC_*: set at BUILD time.
NEXT_PUBLIC_API_URL=http://localhost:8000

# Contact form -> n8n webhook (the only remaining n8n use)
N8N_API_KEY=your_n8n_api_key
N8N_CONTACT_WEBHOOK_URL=https://your-n8n-instance.com/webhook/CONTACT_WEBHOOK_ID

# Upstash Redis (contact-form rate limiting; fails open when unset)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Umami analytics (BUILD time)
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://your-umami-host/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your_umami_website_id
```

Create the Better Auth tables (including `jwks`) in the local database. The CLI does not read `.env.development.local`, so pass the URL explicitly:

```bash
DATABASE_URL=postgresql://postgres:devpass@127.0.0.1:5434/invoicextract npx @better-auth/cli@latest migrate
```

The email-OTP flow needs no further migration: codes are rows in the `verification` table.

### 3. API

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt     # Linux/macOS: .venv/bin/python
cp .env.example .env                                            # set OPENAI_API_KEY
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Without `JWT_DEV_PUBLIC_KEY_FILE` the API verifies real Better Auth tokens from `http://localhost:3000/api/auth/jwks`, so the two services work together out of the box (defaults for `BETTER_AUTH_URL` and `ALLOWED_ORIGINS` already point at `http://localhost:3000`). Set `INBOUND_EMAIL_DOMAIN` to any value to see the email-in controls in Settings. All API variables are listed in [backend/.env.example](backend/.env.example) and documented in [backend/README.md](backend/README.md).

### 4. Run the web app

```bash
npm run dev      # http://localhost:3000
```

### Checks

```bash
npm run build                                    # web: production build + type check
cd backend && .venv/Scripts/python -m pytest     # API: needs the Postgres from step 1
```

## Project structure

```
src/
├── app/
│   ├── (marketing)/          # Landing, about, privacy, terms, contact
│   ├── sign-in, sign-up/     # Better Auth screens (auth-shell split layout)
│   ├── verify-email/, forgot-password/   # Email OTP flows (noindex)
│   ├── (dashboard)/dashboard/            # Authenticated app (noindex)
│   │   ├── page.tsx          # Overview (needs attention, recent, ledger strip)
│   │   ├── upload/           # Bulk upload with live per-file status
│   │   ├── documents/        # List (search, filter, select, export) and [fileId] detail/editor
│   │   ├── credits/          # Balance, held credits, ledger
│   │   └── settings/         # Retention, email-in address, delete account
│   ├── api/
│   │   ├── auth/[...all]/    # Better Auth handler (+ /token and /jwks from the JWT plugin)
│   │   └── contact/          # Contact form (honeypot + rate limit -> n8n webhook)
│   ├── layout.tsx, globals.css, robots.ts, sitemap.ts, manifest.ts
│   └── opengraph-image.tsx, twitter-image.tsx, icon.tsx, apple-icon.tsx
├── components/
│   ├── ui/                   # shadcn/ui primitives
│   ├── brand/                # Logo, stamp, invoice specimen (hero)
│   ├── auth/, marketing/, contact/, dashboard/
├── lib/
│   ├── auth.ts, auth-client.ts   # Better Auth server and client
│   ├── api.ts                    # Typed API client (JWT, 401 retry, downloads)
│   ├── types.ts, error-copy.ts   # API shapes and user-facing error text
│   ├── dashboard-context.tsx     # Overview + documents state, polling, detail cache
│   ├── use-document-blob.ts      # Fetch a source file as a blob URL
│   ├── email.ts, otp-sender.ts   # Resend OTP sender
│   ├── rate-limit.ts, json-ld.ts, utils.ts
└── middleware.ts             # Session-cookie guard for /dashboard

backend/                      # FastAPI service (see backend/README.md)
├── app/ (routers, services, models, config)   ├── alembic/   ├── tests/   ├── scripts/
└── Dockerfile, docker-entrypoint.sh

docs/plan/                    # Rebuild plan and the HANDOFF log
DESIGN.md, PRODUCT.md         # Design system and product strategy (read before UI work)
```

## API

Base URL `https://api.invoicextract.zeeshanai.cloud`, all `/v1/*` routes except `meta/limits` need `Authorization: Bearer <JWT>` (from `GET /api/auth/token` on the web app). Interactive docs at `/docs`. Main routes:

| Area | Routes |
|---|---|
| Documents | `POST /v1/documents` (multipart `files`, 1 to 10, returns 202), `GET /v1/documents` (`limit, offset, q, status`), `GET/PATCH/DELETE /v1/documents/{id}`, `GET /v1/documents/{id}/file`, `POST /v1/documents/{id}/retry`, `POST /v1/documents/delete` |
| Export | `GET /v1/documents/{id}/export?format=json\|csv\|xlsx`, `POST /v1/exports` |
| Credits and analytics | `GET /v1/credits`, `GET /v1/credits/transactions`, `GET /v1/analytics`, `GET /v1/overview` |
| Settings | `GET/PATCH /v1/settings`, `POST /v1/settings/inbound-address/regenerate` |
| Account | `DELETE /v1/account` |
| Public / ops | `GET /v1/meta/limits`, `GET /healthz`, `GET /readyz`, `POST /v1/inbound/email` (signed webhook), `GET /v1/admin/analytics` (admin key) |

Errors always look like `{"error": {"code": "...", "message": "..."}}`. A document's `status` is one of `queued`, `validating`, `extracting`, `processed`, `rejected`, `failed`. The invoice shape is in [src/lib/types.ts](src/lib/types.ts) (`InvoiceData`: `invoice_metadata, seller, buyer, line_items, totals, payment_details, notes`).

## Troubleshooting

### Every dashboard request fails with 401 or a CORS error
- The API must trust the site: `BETTER_AUTH_URL` on the API equals the web app's `BETTER_AUTH_URL` (no trailing slash) and `ALLOWED_ORIGINS` contains the site origin.
- The `jwks` table must exist in the web app's database (`npx @better-auth/cli@latest migrate`).
- The web build needs `NEXT_PUBLIC_API_URL`; it is baked in at build time.

### An upload stays "Queued" or "Extracting"
- Processing runs on OpenAI's flex tier, so 10 to 60 s is normal and a busy period can take minutes. Check the API logs; the worker restarts stuck jobs after a redeploy.

### Email-in does nothing
- Resend needs the MX record for `INBOUND_EMAIL_DOMAIN`, an `email.received` webhook to `/v1/inbound/email`, the signing secret in `RESEND_WEBHOOK_SECRET`, and a full-access `RESEND_API_KEY` on the API.

### No sign-up code arrives
- Better Auth hides send failures. Check the Resend dashboard and the web server logs, not the UI.

### Local sign-ups touch the wrong database
- `.env.local` may point at the production database. Use `.env.development.local` and pass the local `DATABASE_URL` to the Better Auth CLI explicitly.

## Development tips

- New dashboard pages: add a folder under `src/app/(dashboard)/dashboard/<feature>/`, read data through `useDashboardData()`, add a link in `src/components/dashboard/sidebar.tsx`.
- New extraction fields: change the Pydantic schema in `backend/app/schemas_invoice.py` and the extraction prompt, then `InvoiceData` in `src/lib/types.ts` and `src/components/dashboard/invoice-ledger.tsx`.
- New API error codes: add the user-facing text to `src/lib/error-copy.ts`.
- Styling: tokens live in `src/app/globals.css`; follow [DESIGN.md](DESIGN.md).

## SEO infrastructure

- **`/robots.txt`** (`src/app/robots.ts`) allows public routes, disallows `/dashboard` and `/api`. **`/sitemap.xml`** (`src/app/sitemap.ts`) lists `/`, `/about`, `/privacy`, `/terms`. The dashboard layout sets `noindex`.
- `metadataBase` is `https://invoicextract.zeeshanai.cloud`; title template `%s — InvoicExtract`; every marketing page declares a canonical URL; Open Graph and Twitter cards are defaults in the root layout.
- Social images are generated with `next/og`: `opengraph-image.tsx`, `twitter-image.tsx` (1200×630), `icon.tsx`, `apple-icon.tsx`.
- JSON-LD helpers are in `src/lib/json-ld.ts` (`Organization` + `WebSite` on every page, `SoftwareApplication` on the home page). Validate at <https://search.google.com/test/rich-results>.

## Deployment

Self-hosted on **Coolify** (Hostinger VPS) behind Traefik with Let's Encrypt. Two apps plus MinIO:

- **Web**: Railpack, port 3000, `invoicextract.zeeshanai.cloud`. Every `NEXT_PUBLIC_*`, plus `BETTER_AUTH_URL` and `DATABASE_URL`, must be build-time variables.
- **API**: Dockerfile in `backend/` (base directory `/backend`), port 8000, `api.invoicextract.zeeshanai.cloud`, healthcheck `/healthz`. Migrations run on container start. Runtime variables are listed in [backend/.env.example](backend/.env.example); production sets `ENVIRONMENT=production`, `STORAGE_DRIVER=s3` and the `S3_*` values for the MinIO service.
- **MinIO**: private bucket on the internal Docker network only (no public port).

```bash
git push origin main   # .github/workflows/deploy.yml triggers the web app, then the API app
```

Repo secrets for the workflow: `COOLIFY_API_TOKEN` (deploy-scoped), `COOLIFY_APP_UUID` (web), `COOLIFY_API_APP_UUID` (API). Branch pushes never deploy. See [CLAUDE.md](CLAUDE.md) for the full deployment notes and gotchas.

## Roadmap ideas

Paid credit packs (Stripe or Lemon Squeezy), public API keys, push to accounting tools or "processed" webhooks, off-box MinIO backups.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT, see [LICENSE](LICENSE).

## Support

Use the [GitHub Issues](https://github.com/mzeeshanaltaf/invoice-extract/issues) page.
