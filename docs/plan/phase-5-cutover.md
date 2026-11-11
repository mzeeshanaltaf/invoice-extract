# Phase 5: Cutover and housekeeping

**Prerequisite reading:** [README.md](README.md), [00-overview.md](00-overview.md), [HANDOFF.md](HANDOFF.md) (all entries), CLAUDE.md, and the two memory files in `C:\Users\Zeeshan\.claude\projects\e--Projects-Claude-Code-1-Applications-Invoice-Extract\memory\`.
**Depends on:** Phase 4 done and production verified. **Unblocks:** nothing (final).
**Confirm first:** dropping tables is irreversible. Look at the tables and confirm with the user before running the drop.

## Tasks

1. Drop the three old n8n tables (`user_documents`, `user_credit_accounts`, `user_credit_transactions` in schema `invoice_extract`) after production is verified. Never touch Better Auth tables. The n8n workflows themselves are left for the user to deactivate in n8n, **except the contact-form webhook, which the site still calls (Phase 2 task 6)**; the JSON exports stay in `n8n_workflows/` as reference.
2. Rewrite CLAUDE.md: architecture section "n8n is the backend" becomes the FastAPI service (JWT flow, `user_id` invariant, MinIO, worker, email-in, retention); commands (backend run/test/migrate); env; deployment (two Coolify apps, workflow secret); gotchas; pointer to `DESIGN.md`/`PRODUCT.md`; remove the signup-credits hook note; rename to InvoicExtract.
3. Update README and local `.env.example` files (gitignored; document new vars in README) for both the front end and `backend/`.
4. Update the two project memory files (`invoice-extract-deployment.md`, `invoice-extract-better-auth.md`) and add any new durable facts (API domain, MinIO, JWT plugin). Keep `MEMORY.md` index lines accurate.
5. Final sweep: grep for stale references (`n8n`, `Mistral`, `InvoiceExtract`, `N8N_`; the contact form's `N8N_API_KEY`/`N8N_CONTACT_WEBHOOK_URL` and its `source: "invoiceextract"` payload value are intentional, and README/CLAUDE.md still carry the old n8n/Mistral prose), dead files (`hero_section_bg.png`, old API routes), and unused dependencies.

## Verification

- Production still works after the table drop (login, upload, documents list, credits).
- `npm run build` and backend `pytest` green.
- CLAUDE.md and README match reality (spot check each command in them).

## Exit criteria

- [x] Old tables dropped (user confirmed), production verified afterwards (health, readiness, auth endpoints, clean logs; signed-in flows not re-walked, see HANDOFF).
- [x] CLAUDE.md, README, `.env.example`s, and memory files updated.
- [x] Stale reference sweep clean (only the intentional contact-form `N8N_*` and `source` value remain).
- [ ] Changes committed and pushed (not done: the user has not asked; use the `ship` skill if they do).

## Handoff (do this last)

Append a final HANDOFF.md entry and set Phase 5 to "done". List remaining recommendations from [00-overview.md](00-overview.md) (credit packs, public API keys, accounting integrations, MinIO backups) as candidate next projects.
