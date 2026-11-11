# Phase 4: Deploy (Coolify on the Hostinger VPS)

**Prerequisite reading:** [README.md](README.md), [00-overview.md](00-overview.md), [HANDOFF.md](HANDOFF.md) (env var names from Phases 1 and 2). Skills to load: `add-app-to-coolify`, `add-minio-storage-to-coolify`, `resend`. Existing deploy notes are in CLAUDE.md and the memory file `invoice-extract-deployment.md`.
**Depends on:** Phases 1 to 3 done and **seen working locally by the user**. **Unblocks:** Phase 5.
**Credentials:** `COOLIFY_API_TOKEN_ROOT` for the Coolify API; Hostinger DNS via the Hostinger MCP; VPS `76.13.7.106` (SSH key `~/.ssh/hostinger_vps_ed25519`). Never write secrets into the repo or HANDOFF.md.
**Confirm first:** this phase changes shared infrastructure and publishes the app. Confirm with the user before the first push to `main` and before DNS changes.

## Steps

1. On the VPS, check `df -h /`, `cat /var/log/docker-cleanup.log`, `crontab -l`, `systemctl is-active cron` first (global notes).
2. Create Coolify app `invoicextract-api` in the existing InvoiceExtract project: same repo, base directory `/backend`, Dockerfile build, port 8000, health check `/healthz`, domain `https://api.invoicextract.zeeshanai.cloud`.
3. DNS: add an A record `api.invoicextract` to `76.13.7.106` (Hostinger DNS).
   - 3a. MinIO: deploy as a Coolify service on the shared Docker network with a persistent volume, no public domain, private bucket `invoicextract-documents`, and a dedicated access key (per the `add-minio-storage-to-coolify` skill). Verify it is not reachable from the public internet.
   - 3b. Email-in: enable receiving in Resend for `in.invoicextract.zeeshanai.cloud`, add the MX record Resend specifies in Hostinger DNS (subdomain only), create the `email.received` webhook pointing at `https://api.invoicextract.zeeshanai.cloud/v1/inbound/email`, and store its signing secret. If the current Resend plan or key does not allow inbound, stop and tell the user before changing anything else; the rest of the build does not depend on it.
4. Backend env (runtime): `DATABASE_URL` with host `10.0.0.1:5432` (docker0 gateway), `OPENAI_API_KEY`, `BETTER_AUTH_URL`, `ALLOWED_ORIGINS`, `ADMIN_API_KEY`, `S3_*`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INBOUND_EMAIL_DOMAIN`, tunables. Alembic `upgrade head` runs on container start.
5. Front end env (Coolify): `NEXT_PUBLIC_API_URL` (**build-time**), `CONTACT_TO_EMAIL`; remove `N8N_*`. Also run the Better Auth migration (`jwks` table) against the production DB before the new front end goes live.
6. [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml): trigger both apps (new repo secret `COOLIFY_API_APP_UUID` for the API app), keeping the retry loop.
7. Commit and push to `main` (this is the first push of the whole rebuild). Include the previously untracked `docs/plan/`, new `backend/`, etc. as appropriate; do not commit `.env*`. Watch both deployments.

## Verification (this phase)

- `/healthz` returns OK on the API domain; Coolify logs clean for both apps.
- CORS works from `https://invoicextract.zeeshanai.cloud` (and not from other origins).
- One full upload on the live site end to end (sign in, upload invoice, see it processed, credits deducted, preview, export).
- Contact form delivers through Resend.
- Email-in: forward a real invoice to the personal address and watch it appear (if inbound enabled).
- MinIO not reachable from the public internet; DB host is `10.0.0.1`.
- Disk and cron on the VPS still healthy after the new builds.

## Exit criteria

- [ ] API app, DNS, MinIO, (optionally) Resend inbound live and verified.
- [ ] Both apps auto-deploy from a push to `main` via the updated workflow.
- [ ] Production smoke tests above pass; results recorded.

## Handoff (do this last)

Append a HANDOFF.md entry using its template. Must include: Coolify app UUIDs (not tokens), domains, DNS records added, which env vars exist on which app (names only), whether Resend inbound is enabled, and anything pending for cutover. Set Phase 4 to "done".
