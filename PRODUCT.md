# Product

## Register

brand

The marketing site (landing, About, Contact, legal) is `brand`: design is the pitch. The signed-in app (`/dashboard/*`) and the auth screens are `product`: design serves the task. When a task touches the app, load the product register instead; this file carries one default.

## Users

**Primary: bookkeepers and small-business owners.** They sit at a desk, in daylight, with a stack of supplier invoices (PDFs from email, phone photos of paper) and a spreadsheet or accounting package open. The job is to get every figure from the invoice into the books without typing it. They are not technical, they are careful, and a wrong digit costs them more than a slow screen. They need to trust each number before it leaves the tool.

**Secondary: developers** who want the same extraction as structured data (JSON, CSV, Excel). They are served by clear export formats and honest documentation of limits, not by a separate product surface.

## Product Purpose

InvoicExtract reads invoice PDFs and images and returns the vendor, dates, line items, tax, totals and bank details as an editable ledger. Files that are not invoices are rejected up front and cost nothing. Each page that is read costs one credit; new accounts get five. Success is a bookkeeper who clears a pile of invoices in one sitting, corrects the one figure the model got wrong, exports to Excel, and never doubts the totals because anything that does not add up is flagged.

Behind the UI: a FastAPI service (OpenAI vision for reading, a Decisions-API gate for invoice or not), MinIO for source files, email-in for forwarded invoices, a per-user retention setting for source files.

## Brand Personality

Three words: **exact, plain-spoken, well-made.**

A good printed ledger, not a SaaS template. The voice states limits and consequences in ordinary words ("10 MB per file, 10 pages per PDF", "rejected files cost nothing") and never inflates. Numbers are set like numbers: tabular, ruled, aligned. Confidence comes from showing the work (the figure beside the place on the invoice it came from), not from adjectives. Moments of character are physical and few: a rubber stamp landing, a ruled line drawn under a field.

## Anti-references

- The generic AI/SaaS landing page: gradient text, glass cards, three identical icon cards, a hero metric row ("99% accuracy"), purple-to-blue everything, floating blobs.
- Invented proof: no made-up accuracy figures, speed claims, customer logos or testimonials.
- Stock imagery and icon tiles standing in for the product. The invoice itself is the illustration.
- Cold, dark, "developer tool" chrome as the default mood for a bookkeeper in daylight.
- Modals as a first reflex, toasts for errors (this app reports errors inline), decorative motion in the app.
- Em dashes in copy.

## Design Principles

1. **Show the work.** Every extracted figure is shown next to its source and can be checked and edited. Warnings point at the exact fields. Trust is earned by transparency, not reassurance.
2. **Numbers first.** Figures are the content: tabular, aligned, ruled, in a face built for digits. Chrome stays quiet so the numbers carry the weight.
3. **Say what it costs.** Limits, credits, retention and what is and is not deleted are stated plainly where the decision is made. Rejection is free and says why.
4. **Paper, not screen.** Warm paper, ink text, ruled lines, stamps. One accent (rubber-stamp vermilion) for the primary action and for stamps; a quiet ledger green only for verified or extracted states.
5. **Motion proves state.** One signature animation on the landing page (a scan reading an invoice into a ledger), played once. In the app, motion only reports a state change.

## Accessibility & Inclusion

- WCAG 2.2 AA for text and UI contrast in both themes (verified against the real tokens).
- Full keyboard operation with visible focus; logical focus order; no keyboard traps.
- `prefers-reduced-motion`: the hero shows its static final frame; app transitions drop to instant.
- Status is never color alone: every state carries a word (and a mark where useful), so green/red color-blindness does not hide meaning.
- Errors are inline, associated with their fields, and written to say what to do next.
- Touch targets of at least 40px on mobile; layouts work from 375px.
