# CLAUDE.md

Guidance for working in this repo. Read this before making changes.

## What this is

InvoicExtract — a Next.js 16 (App Router, React 19, TypeScript, `src/` layout)
app for AI invoice data extraction. Tailwind v4 + shadcn/ui (new-york). Live at
https://invoicextract.zeeshanai.cloud.

## Commands

```bash
npm run dev     # dev server (http://localhost:3000)
npm run build   # production build (Turbopack)
npm run start   # serve the production build
npx @better-auth/cli@latest migrate   # create/alter Better Auth tables
```

There is no test suite. Verify changes with `npm run build` plus manual checks.

## Architecture — the two things to internalize

1. **n8n is the backend.** This app has almost no business logic of its own. All
   OCR (Mistral AI), credits, documents, and analytics live in n8n workflows,
   called over authenticated webhooks. The client → an internal `/api/*` route →
   `src/lib/n8n.ts` (`callN8nWebhook` / `callN8nWebhookFormData`, `x-api-key`
   header) → n8n. Endpoint UUIDs are in `N8N_ENDPOINTS` in `src/lib/n8n.ts`.

2. **The user id is the single key for all backend data.** Every `/api/*` data
   route resolves the signed-in user's id via `getUserId()`
   (`src/lib/session.ts`) and forwards it to n8n as `user_id`. n8n keys credits,
   documents, and analytics on this value. **Never** change how the id is derived
   or forwarded without understanding this — it would orphan every user's data.

## Auth (Better Auth) — replaced Clerk

- Server instance: `src/lib/auth.ts`. Postgres via `pg.Pool` with
  `options: "-c search_path=invoice_extract"` so all tables (user/session/
  account/verification) resolve to the `invoice_extract` schema. Client:
  `src/lib/auth-client.ts`. Route handler: `src/app/api/auth/[...all]/route.ts`.
- Providers: email/password + Google OAuth. Pages: `/sign-in`, `/sign-up`
  (`src/components/auth/auth-form.tsx`). Account menu / sign-out:
  `src/components/auth/user-menu.tsx`.
- Protected routes: `src/middleware.ts` checks the Better Auth session cookie
  (`getSessionCookie`) and redirects `/dashboard(.*)` to `/sign-in`.
- Server components read the session with
  `auth.api.getSession({ headers: await headers() })`; client components use
  `useSession()` from `auth-client`.
- **Signup credits**: granted by a `databaseHooks.user.create.after` hook in
  `auth.ts` that calls the n8n CREDITS endpoint (`event_type: "signup_credits"`).
  This replaced the old Clerk `user.created` webhook — do not re-add a webhook.
- Env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`,
  `DATABASE_URL`. Google redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`.

## Email OTP (verification + password reset)

- `emailOTP` plugin in `auth.ts` with `requireEmailVerification: true`. Sign-up
  therefore issues **no session** — `auth-form.tsx` routes to `/verify-email`
  after a successful `signUp.email()`, and on an `EMAIL_NOT_VERIFIED` sign-in
  error (the server already sent a fresh code via `sendOnSignIn`). Google
  accounts arrive pre-verified and skip all of this.
- Screens: `/verify-email` (needs `<Suspense>` — it reads `useSearchParams`) and
  `/forgot-password` (one route, request → reset steps). Both `noindex`.
- **No migration needed**: codes live in the existing `verification` table as
  `email-verification-otp-<email>` / `forget-password-otp-<email>` rows.
- Sending: `src/lib/email.ts` (Resend, server-only). `RESEND_FROM_EMAIL` is
  **unquoted** — dotenv strips quotes but Coolify doesn't, and Resend 422s on a
  quoted `from`; the sender unquotes defensively anyway. The user-visible sender
  address is the one client-safe constant in `src/lib/otp-sender.ts`.
- **Better Auth swallows send failures** (`runInBackgroundOrAwait`), so a dead
  Resend key still returns `{ success: true }` and the UI still says "code
  sent". Debug against the Resend dashboard and server logs, never the UI.
- `requestPasswordReset` returns success for unknown emails by design
  (anti-enumeration) — keep the copy neutral. `resetPassword` creates **no**
  session; it redirects to `/sign-in?reset=1`.
- These screens report errors **inline** (`text-destructive`), matching
  `auth-form.tsx`. The project has no toaster — don't introduce toasts here.

## Contact form

- Page `src/app/(marketing)/contact/page.tsx`, form
  `src/components/contact/contact-form.tsx`, route `src/app/api/contact/route.ts`,
  limiter `src/lib/rate-limit.ts`.
- Spam protection: a non-semantic **honeypot** field named `hp_field` (never
  rename it — a semantic name would trigger browser/Google autofill and flag real
  users) + Upstash per-IP rate limiting (fails open if Upstash env is missing).
- **Progressive enhancement**: the form has both `action="/api/contact"
  method="post"` (native fallback) and `onSubmit` fetch. The route parses JSON
  **and** form-encoded bodies and returns a 303 redirect for native posts. Keep
  both paths — a fetch-only form silently dies if hydration fails.

## Analytics

Umami (self-hosted, cookieless). Mounted in `src/app/layout.tsx` via
`next/script`, gated on `NEXT_PUBLIC_UMAMI_SCRIPT_URL` +
`NEXT_PUBLIC_UMAMI_WEBSITE_ID`. These are `NEXT_PUBLIC_*`, so they must be set at
**build** time or the tracker ships `undefined`.

## Known gotchas (project-specific)

- **PDF preview (`react-pdf`/pdfjs)** needs the `canvas` alias in
  `next.config.ts` (both `turbopack.resolveAlias` and `webpack`) pointing at
  `canvas-stub.js`. Don't remove it. The viewer is `src/components/ui/pdf-viewer.tsx`,
  loaded via `next/dynamic` with `ssr: false`.
- **Dashboard data caching**: `src/lib/dashboard-context.tsx` caches analytics/
  credits/documents in React Context (and per-document detail in a `useRef` map)
  to avoid redundant n8n calls. Call `refreshAll()` after a successful upload.
- **`.env*` is gitignored** (including `.env.example`) — don't try to commit env
  files; document new vars in `.env.example` locally and in the README.

## Deployment (Coolify on Hostinger VPS)

- App runs on Coolify (nixpacks build pack, port 3000) behind Traefik + Let's
  Encrypt. Push to `main` → `.github/workflows/deploy.yml` calls the Coolify
  deploy API (repo secrets `COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID`).
- **Build-time vs runtime env in Coolify**: every `NEXT_PUBLIC_*`, plus
  `BETTER_AUTH_URL` and `DATABASE_URL`, must be **build-time**; secrets are
  runtime. `NIXPACKS_NODE_VERSION=22` and `NIXPACKS_INSTALL_CMD=npm install` are
  set (the latter avoids cross-OS lockfile drift on `npm ci`).
- **DB host in production** is the docker0 gateway `10.0.0.1:5432` (private,
  firewall-independent), not the public IP. The DB is a shared Postgres container
  on the same VPS; Better Auth tables are in the `invoice_extract` schema.

## Design system (read before any UI work)

The UI follows the "paper and ledger" system. **Load [DESIGN.md](DESIGN.md)** (tokens,
components, motion, do's and don'ts) and [PRODUCT.md](PRODUCT.md) (users, tone,
anti-references) before touching marketing, auth or dashboard UI; the tokens
themselves are in `src/app/globals.css`. Marketing is brand register, the app
and auth screens are product register. Rules that bite: vermilion only for the
one primary action and stamps, ledger green only for extracted/verified, figures
in `.figures` (Geist Mono), no em dashes in copy, no gradient text/glass/icon
tiles, never `outline-none` on a control (it cancels the focus outline in
Tailwind v4), errors inline (no toasts).

## Conventions

- Match existing file style: server components stay server-side and read the
  session directly; only add `"use client"` when hooks/interactivity require it.
- Use the shadcn primitives in `src/components/ui/*` (Button, Input, Label,
  Dialog, DropdownMenu, Avatar, …) rather than raw elements, and Tailwind tokens
  (`text-muted-foreground`, `bg-card`, `border-border`, `text-primary`) over
  hardcoded colors.
- Reference files as clickable paths and keep changes minimal and consistent
  with surrounding code.
