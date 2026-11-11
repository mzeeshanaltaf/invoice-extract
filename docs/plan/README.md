# InvoicExtract rebuild: phased plan

Source plan: `C:\Users\Zeeshan\.claude\plans\this-project-backend-composed-twilight.md` (split into the files below; these are now the working copy).

| Phase | File | Outcome |
|---|---|---|
| 0 | [00-overview.md](00-overview.md) | Shared context: goal, decisions, architecture, invariants. Read first in every session. |
| 1 | [phase-1-backend.md](phase-1-backend.md) | FastAPI service in `backend/` (OpenAI pipeline, MinIO, email-in, retention) |
| 2 | [phase-2-frontend-integration.md](phase-2-frontend-integration.md) | Next.js talks to FastAPI with a Better Auth JWT; n8n removed; rename |
| 3 | [phase-3-redesign.md](phase-3-redesign.md) | Full UI redesign with impeccable; `PRODUCT.md` + `DESIGN.md` |
| 4 | [phase-4-deploy.md](phase-4-deploy.md) | Coolify API app, DNS, MinIO, Resend inbound, CI |
| 5 | [phase-5-cutover.md](phase-5-cutover.md) | Drop old tables, rewrite docs/memory |
| - | [HANDOFF.md](HANDOFF.md) | Running log. Each session reads it first and updates it last. |

## Session handoff protocol

Each phase runs in a fresh session with no memory of the previous one. Context travels through files, not chat.

**Start a session** by pasting:

> Read `docs/plan/README.md`, `docs/plan/00-overview.md`, `docs/plan/HANDOFF.md`, then `docs/plan/phase-N-<title>.md`. Confirm the previous phase's exit criteria in HANDOFF.md are met (verify in the repo, do not trust the log blindly), then implement phase N only. Update HANDOFF.md before finishing.

(CLAUDE.md and the memory index load automatically.)

**End a session** (the phase file's last section, "Handoff", spells this out): the session must
1. Run the phase's verification and record real results (pass/fail, not intent).
2. Append a dated entry to `HANDOFF.md`: what was built, files/paths created, deviations from the plan and why, env vars/secrets added, commands to run it, open issues, and anything the next phase must know.
3. Tick the exit criteria in the phase file.
4. Leave the working tree in a state the next session can build on (commit only when the phase file says so; Phase 4 owns the first push to `main`).

If a session deviates from the plan, it edits the affected phase file so the docs stay the source of truth.

## Rules that apply to every phase

- `user_id` (Better Auth user id, JWT `sub`) stays the single key for all data.
- Do not touch Better Auth tables, the old `user_documents`, `user_credit_accounts`, `user_credit_transactions` (until Phase 5), or the live n8n-backed site's behavior until Phase 4.
- Do not commit or push to `main` before Phase 4. `.env*` is gitignored.
- No heredocs for writing files; use Write/Edit.
- Never put secrets in docs or HANDOFF.md; record names of env vars only.
