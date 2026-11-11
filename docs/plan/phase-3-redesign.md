# Phase 3: Redesign (impeccable skill)

**Prerequisite reading:** [README.md](README.md), [00-overview.md](00-overview.md), [HANDOFF.md](HANDOFF.md) (Phase 2 entry: component map, what is placeholder UI). Invoke the `impeccable` skill before doing design work and follow its gates.
**Depends on:** Phase 2 done (data flow works end to end). **Unblocks:** Phase 4.
**Scope guard:** visuals, layout, copy and motion. Do not change API contracts, auth logic, the `canvas` alias, `hp_field`, or the dual contact-form paths. Do not deploy. Work on branch `phase-3-redesign` (cut from `phase-2-frontend`); commit/push there only when the user asks, never to `main`.

## Gate status

No `PRODUCT.md` or `DESIGN.md` existed at planning time. The user's answers in [00-overview.md](00-overview.md) are the interview, and approval of the plan confirmed the brief below. Image probes are skipped because the harness has no native image generation. Re-check whether either file exists now; if so, read and honor it.

## Steps

1. Write `PRODUCT.md` (register: brand for marketing, product for the app; users; personality; anti-references; principles; WCAG AA).
2. Build the system (tokens in [src/app/globals.css](../../src/app/globals.css), fonts, shadcn primitives restyled through tokens, not replaced) and the screens below.
3. Write `DESIGN.md` at the repo root from the real tokens (impeccable `document` format: theme, palette, type, spacing, components, motion, do/don't), and add a pointer to it in CLAUDE.md so future UI work loads it.

## Design brief

- **Scene**: a bookkeeper at a desk in daylight with a stack of supplier invoices and a spreadsheet open, wanting the typing gone and needing to trust every figure. That forces light, calm, legible, numbers-first.
- **Personality**: exact, plain-spoken, well-made. A good printed ledger, not a SaaS template.
- **Color (Committed on marketing, Restrained in the app)**: warm paper neutrals, blue-black ink text, one accent in rubber-stamp vermilion used for the primary action and stamps, with a quiet ledger green reserved for "verified/extracted" states. All OKLCH, neutrals tinted, no pure black or white. Dark theme is ink paper: same roles, tuned, not inverted.
- **Type**: a slab/Clarendon-style display face for headlines (starting candidate Besley), a sturdy grotesque for UI and body (candidate Schibsted Grotesk), tabular mono for figures and JSON only (Geist Mono, already loaded). Final picks follow the skill's font procedure; nothing from its reflex-reject list (no Inter, Fraunces, Instrument Serif, IBM Plex, Space Grotesk).
- **Recurring motifs**: ruled ledger lines, column rules, stamps (`EXTRACTED`, `NOT AN INVOICE`, `DUPLICATE`), a real invoice specimen built in HTML/SVG rather than stock imagery or icon tiles.
- **Bans honoured**: no gradient text, no glass cards, no three identical icon cards, no hero metric row, no side-stripe borders, no em dashes in copy, no invented stats (the current "99% accuracy / <30s" pills are removed).

## Marketing (`src/app/(marketing)`, `src/components/marketing`)

- **Hero**, left-aligned and asymmetric: headline and one CTA on the left; on the right the signature piece, a paper invoice read by a moving scan rule, each field underlined in vermilion and lifted into ledger rows beside it, finishing with an `EXTRACTED` stamp. Built with `motion` (already a dependency), plays once, loops only on hover, static final frame under `prefers-reduced-motion`. `hero_section_bg.png` is retired.
- **What gets read**: the same invoice as an annotated specimen with leader lines to vendor, dates, line items, tax, bank details. Replaces the feature cards.
- **The gate**: a lunch menu and a holiday photo getting stamped `NOT AN INVOICE`, with the plain statement that rejected files cost nothing.
- **How it works**: three numbered ledger rows with real limits (PDF, PNG, JPEG; 10 MB; 10 pages), not icon circles.
- **For developers**: one invoice shown as JSON, CSV, and spreadsheet in tabs.
- **Pricing as a price list**: Free (5 credits, 1 credit per page) presented honestly; Pro shown as planned, not as a fake tier card. Then FAQ and a closing CTA.
- Navbar, footer, About, Contact, Privacy, Terms restyled to the system. Existing SEO work kept.

## Auth (`/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password`)

Split layout: form on paper at left, a quiet ledger specimen panel at right (hidden on mobile). Logic, inline `text-destructive` errors, neutral anti-enumeration copy, and the `Suspense` wrapper are unchanged; no toasts.

## App (`src/app/(dashboard)`, `src/components/dashboard`)

- **Shell**: sidebar on a second, slightly warmer neutral; credit balance always visible; mobile sheet nav.
- **Overview**: recent documents and what needs attention (warnings, failures) first, counts as a compact ledger strip, with an empty state that teaches the first upload.
- **Upload**: multi-file drop zone showing the real limits; client-side pre-checks for type and size; each file becomes a row with live status (`queued`, `checking it is an invoice`, `reading`, `done`, `rejected` with reason, `failed` with retry). Replaces the blocking processing dialog.
- **Documents**: dense table with search, status filter, multi-select for delete and export. Deletion uses an inline confirm row, not a modal.
- **Document detail**: source document on the left, the extracted invoice as an editable ledger on the right; low-confidence and warning fields marked; save, reset to original, export JSON/CSV/XLSX; markdown transcript in a secondary tab.
- **Credits**: balance and a transaction ledger.
- **Settings**: profile; **Email-in** (the personal address with copy, regenerate, and on/off, plus one line on what to forward); **File retention** (keep forever, 7, 30, 90 days, with a plain statement of what is and is not deleted, and that changes apply to existing documents on the next sweep); delete-account section with typed confirmation.
- Documents that arrived by email carry a small "by email" marker and the sender in the list and detail views; documents whose source file has been removed show that state instead of a broken preview.
- Motion in the app is state only (150 to 250 ms, ease-out): row status changes, save feedback, skeletons.

## Verification (this phase)

- `npm run build` passes.
- Screenshots of every screen in light and dark at 375, 768 and 1440 widths (use the `run`/browser tooling).
- Reduced-motion check (hero shows static final frame), keyboard pass (focus order, visible focus), contrast check against WCAG AA.
- Re-run the Phase 2 functional walkthrough to confirm nothing regressed (upload, edit/save, delete, settings, contact form with JS disabled still posts natively).

## Deviations made while building (this file is the source of truth)

- **Pricing**: the old "Pro $19 / 100 credits" and "Enterprise" tiers were placeholders with no backing. The landing page now shows a price list (5 signup credits, 1 credit per page, 0 for rejected/duplicate/failed, "more credits: planned, not on sale yet" linking to Contact). No prices were invented.
- **About** was rewritten: its "99% / <30s / 3+" stat cards were invented and are gone.
- **Document detail**: the ledger is always editable (no separate Edit mode); a sticky "unsaved changes" bar appears when dirty. Source file is shown inline, not in a dialog (`DocumentPreviewDialog` replaced by `SourcePreview`; `invoice-editor.tsx` replaced by `invoice-ledger.tsx`). `pricing-cta.tsx` and `public/hero_section_bg.png` were deleted.
- **Documents list** search and status filter query the API (`q`, `status`) so they reach beyond the 100 loaded rows.
- **Settings** controls save optimistically and roll back on error. Email-in regeneration and account deletion use inline confirmation (typed phrase `delete my account`), no `window.confirm`, no dialogs.
- The OTP email template, OG/Twitter images, icons and manifest were moved onto the new palette too (satori cannot load Besley, so the social card uses its default sans).
- No `DESIGN.json` sidecar was written (the plan asks only for `DESIGN.md`).

## Exit criteria

- [x] `PRODUCT.md` and `DESIGN.md` exist at the repo root; CLAUDE.md points to DESIGN.md.
- [x] Every marketing, auth and dashboard screen restyled; bans honoured; no leftover old-brand imagery.
- [x] Screenshots, reduced-motion, keyboard and contrast checks done and results recorded (HANDOFF, Phase 3 entry).
- [x] `npm run build` green; Phase 2 functionality unchanged (re-walked; see HANDOFF for what was and was not exercised).

## Handoff (do this last)

Append a HANDOFF.md entry using its template. Must include: final font and token choices, where `DESIGN.md`/`PRODUCT.md` live, any copy that makes product claims the owner should review, screenshot location, and any UI debt left. Set Phase 3 to "done". Commit/push to `phase-3-redesign` only if the user asks (Phase 4 owns the first push to `main`).
