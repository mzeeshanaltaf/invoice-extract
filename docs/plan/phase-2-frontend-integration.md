# Phase 2: Front end integration

**Prerequisite reading:** [README.md](README.md), [00-overview.md](00-overview.md), [HANDOFF.md](HANDOFF.md) (especially the Phase 1 entry: response shapes, JWT claims, how to run the backend). Then the files listed below.
**Depends on:** Phase 1 done. **Unblocks:** Phase 3.
**Scope guard:** wire the existing UI to the new API and rename. Do **not** redesign visuals (Phase 3). Do not deploy or push.

## Goal

Next.js keeps auth only; everything else calls the FastAPI service directly from the browser with a Better Auth JWT. n8n is gone from the front end.

## Tasks

1. [src/lib/auth.ts](../../src/lib/auth.ts): add Better Auth `jwt()` plugin configured to match the issuer/audience Phase 1's verifier expects (see HANDOFF). Run `npx @better-auth/cli@latest migrate` for the `jwks` table. Enable `user.deleteUser`. Remove the n8n signup-credits hook (`databaseHooks.user.create.after`); signup credits are now granted by the API on first authenticated request. [src/lib/auth-client.ts](../../src/lib/auth-client.ts): add `jwtClient()`.
2. New `src/lib/api.ts`: typed client for the FastAPI service; fetches and caches the JWT, refreshes before expiry, one retry on 401. Base URL from `NEXT_PUBLIC_API_URL` (build-time).
3. [src/lib/dashboard-context.tsx](../../src/lib/dashboard-context.tsx): load from `/v1/overview` and `/v1/documents`; poll every 2 s only while any document is in flight; keep `refreshAll()` and the detail cache.
4. [src/components/ui/pdf-viewer.tsx](../../src/components/ui/pdf-viewer.tsx): load from the `/file` endpoint (blob) instead of base64. Keep the `canvas` alias in `next.config.ts` and `ssr: false`.
5. Delete `src/lib/n8n.ts` and `src/app/api/{ocr,documents,user-data,analytics,credits}`; update [src/lib/types.ts](../../src/lib/types.ts) to the new shapes. Upload UI: replace the blocking processing dialog's assumptions with async status (minimal functional version; the polished upload screen is Phase 3). Surface the new error codes (`PDF_ENCRYPTED`, `NOT_AN_INVOICE`, etc.).
6. Contact form: [src/app/api/contact/route.ts](../../src/app/api/contact/route.ts) currently forwards to an n8n webhook. Switch it to send through Resend via [src/lib/email.ts](../../src/lib/email.ts) to a new `CONTACT_TO_EMAIL` env (default: the owner's address from the existing config/README; ask if unknown). Honeypot `hp_field`, Upstash limiter, and the dual native-post/fetch paths stay exactly as they are.
7. Account deletion in Settings: call `DELETE /v1/account`, then `authClient.deleteUser()`. Add minimal Settings controls for retention and email-in wired to `/v1/settings` (restyled in Phase 3).
8. Rename `InvoiceExtract` to `InvoicExtract` in UI copy, metadata, JSON-LD, manifest, OG/Twitter/icon images, OTP email templates, README, CLAUDE.md name references, `package.json` name. Remove all "Mistral" mentions; update the privacy policy to state documents are processed by OpenAI. Keep SEO work (metadata, JSON-LD, sitemap, robots), renamed.
9. Local env: update local `.env`/`.env.example` (gitignored) with `NEXT_PUBLIC_API_URL`, `CONTACT_TO_EMAIL`; drop `N8N_*`.

## Verification (this phase)

- `npm run build` passes.
- Run backend and front end locally. Walk through: sign-up with OTP, first-request signup credits (5), bulk upload with mixed valid and invalid files, live status updates, edit and save, reset, exports open correctly, delete documents, delete account (API data and Better Auth user both gone), contact form delivers via Resend, PDF preview from `/file`.
- Confirm the JWT is accepted by the backend (no 401 loops) and CORS works from `http://localhost:3000`.
- grep confirms no remaining references to `n8n`, `Mistral`, or `InvoiceExtract` in `src/` (apart from intentional references in docs/history).

## Exit criteria

- [ ] No n8n code or env left in `src/`; `npm run build` green.
- [ ] Full local walkthrough above passes against the Phase 1 backend.
- [ ] Rename complete across the files listed in task 8.
- [ ] CLAUDE.md untouched except the product name (full rewrite is Phase 5).

## Handoff (do this last)

Append a HANDOFF.md entry using its template. Must include: the final component/page map and which components Phase 3 will restyle, how `src/lib/api.ts` and the dashboard context are used (hooks, types), env vars added/removed, the local run commands for both services, and any UI behaviors that are placeholders awaiting Phase 3. Set Phase 2 to "done". Do not commit or push.
