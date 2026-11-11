---
name: InvoicExtract
description: Paper and ledger. A bookkeeper's tool set like a well-made printed ledger: warm paper, ink, one vermilion stamp.
colors:
  paper: "oklch(0.975 0.012 88)"
  sheet: "oklch(0.992 0.006 88)"
  ink: "oklch(0.22 0.035 262)"
  ink-soft: "oklch(0.46 0.03 262)"
  paper-shade: "oklch(0.943 0.015 86)"
  paper-warm: "oklch(0.952 0.02 82)"
  rule: "oklch(0.91 0.018 85)"
  border: "oklch(0.88 0.02 85)"
  control-edge: "oklch(0.6 0.025 85)"
  vermilion: "oklch(0.55 0.19 33)"
  vermilion-ink: "oklch(0.985 0.01 88)"
  ledger-green: "oklch(0.46 0.1 155)"
  ledger-green-wash: "oklch(0.93 0.045 150)"
  amber: "oklch(0.48 0.1 72)"
  amber-wash: "oklch(0.94 0.06 88)"
  crimson: "oklch(0.5 0.2 22)"
  focus-blue: "oklch(0.45 0.12 260)"
  ink-band: "oklch(0.24 0.04 262)"
  night-paper: "oklch(0.19 0.028 262)"
  night-sheet: "oklch(0.235 0.03 262)"
  night-ink: "oklch(0.935 0.012 88)"
  night-vermilion: "oklch(0.7 0.16 36)"
typography:
  display:
    fontFamily: "Besley, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.6rem, 6vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Besley, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.12em"
  figures:
    fontFamily: "Geist Mono, ui-monospace, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "'tnum', 'zero'"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.vermilion-ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "40px"
  badge-success:
    backgroundColor: "{colors.ledger-green-wash}"
    textColor: "{colors.ledger-green}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  badge-warning:
    backgroundColor: "{colors.amber-wash}"
    textColor: "{colors.amber}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  sidebar:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.ink}"
    width: "240px"
---

# Design System: InvoicExtract

Tokens live in [src/app/globals.css](src/app/globals.css) (`:root` and `.dark`) and are normative; this file explains how to use them. Strategy, users and tone live in [PRODUCT.md](PRODUCT.md). Colors are written in OKLCH here and in the CSS because the project treats OKLCH as canonical (Stitch's linter prefers hex and will warn; that is accepted).

## 1. Overview

**Creative North Star: "The Bookkeeper's Ledger"**

A bookkeeper at a desk in daylight, a stack of supplier invoices on one side and a spreadsheet on the other, wanting the typing gone and needing to trust every figure. The system is a good printed ledger made interactive: warm paper, blue-black ink, ruled lines, column rules, and a rubber stamp for the moments that matter. It is light first. Dark is "ink paper", the same roles tuned for a dim desk, never an inversion.

Two registers share one set of tokens. The **marketing site** is brand register and Committed on color: vermilion drenches two full-bleed bands (the gate, the closing call) and underlines the headline; one dark ink band carries the developer section. The **app and auth screens** are product register and Restrained: tinted neutrals, vermilion only on the one primary action per screen and on stamps, and a second, slightly warmer neutral for the sidebar. Density is high in the app (tables, ledgers) and generous on marketing (one idea per fold).

The system explicitly rejects what PRODUCT.md rules out: the generic AI/SaaS landing page (gradient text, glass cards, three identical icon cards, a hero metric row), invented proof (no accuracy or speed figures, no logos, no testimonials), stock imagery and icon tiles standing in for the product, cold dark "developer tool" chrome as the default, modals as a first reflex, toasts for errors, and decorative motion in the app.

**Key Characteristics:**
- Warm paper and ink neutrals, all tinted toward hue 88 (paper) or 262 (ink). No `#000`, no `#fff`.
- One accent, rubber-stamp vermilion (hue 33). A quiet ledger green (hue 155) is reserved for verified and extracted states.
- Slab display face for headlines only; a sturdy grotesque for everything else; tabular mono for figures and JSON only.
- Ruled lines and column rules as structure (full 1px borders, never colored side stripes).
- The invoice itself, built in HTML, is the illustration. No stock photos, no icon tiles.
- Motion proves state. One signature animation on the landing page, played once.

## 2. Colors

A warm paper field, blue-black ink, one vermilion stamp, and a green that only ever means "read and checked".

### Primary
- **Rubber-Stamp Vermilion** (`oklch(0.55 0.19 33)`; dark `oklch(0.7 0.16 36)`): the primary action, stamps, the headline underline, active-nav icon, marker pins, and the two drenched marketing bands. Text on it is **Vermilion Ink** (`oklch(0.985 0.01 88)`; dark: `oklch(0.2 0.03 262)`). Contrast 5.1:1 light, 6.4:1 dark.

### Secondary
- **Ledger Green** (`oklch(0.46 0.1 155)` on wash `oklch(0.93 0.045 150)`): extracted, done, verified, "lines add up", positive credit entries, the EXTRACTED stamp. Dark: text `oklch(0.78 0.12 155)` on `oklch(0.3 0.05 155)`.
- **Amber** (`oklch(0.48 0.1 72)` on wash `oklch(0.94 0.06 88)`): rejected, a figure to check, the "Check" mark in the ledger, low-credit notices. Dark: `oklch(0.82 0.11 85)` on `oklch(0.32 0.05 85)`.
- **Crimson** (`oklch(0.5 0.2 22)`; dark `oklch(0.72 0.16 22)`): destructive text, failed states, inline errors. Used as outlined or text, filled only for the final confirm of an irreversible action.

### Neutral
- **Paper** (`oklch(0.975 0.012 88)`): page background. Dark: **Night Paper** `oklch(0.19 0.028 262)`.
- **Sheet** (`oklch(0.992 0.006 88)`): cards, inputs, the invoice specimen, popovers. Dark: `oklch(0.235 0.03 262)`.
- **Ink** (`oklch(0.22 0.035 262)`): text. Dark: **Night Ink** `oklch(0.935 0.012 88)`.
- **Ink Soft** (`oklch(0.46 0.03 262)`): secondary text. 6.6:1 on paper. Dark `oklch(0.75 0.022 262)`.
- **Paper Shade** (`oklch(0.943 0.015 86)`): muted fills, skeletons, code wells.
- **Paper Warm** (`oklch(0.952 0.02 82)`): the sidebar, the footer; the "second neutral". Dark `oklch(0.165 0.026 262)`.
- **Rule** (`oklch(0.91 0.018 85)`) and **Border** (`oklch(0.88 0.02 85)`): hairlines and ledger rules. Decorative; never the only boundary of a control.
- **Control Edge** (`oklch(0.6 0.025 85)`; dark `oklch(0.58 0.03 262)`): input and checkbox boundaries. 3.7:1 against paper, meeting 1.4.11.
- **Focus Blue** (`oklch(0.45 0.12 260)`; dark `oklch(0.78 0.1 250)`): the focus ring, deliberately not vermilion so focus never reads as "primary".
- **Ink Band** (`oklch(0.24 0.04 262)`): the single dark section on the landing page.

### Named Rules
**The One Stamp Rule.** Vermilion marks the one primary action on a screen and the stamps. It is never decoration on an inactive state, never a second competing button, never a link color.

**The Green Means Checked Rule.** Ledger green appears only for extracted, done, verified and positive credit. Never as a brand color, never for a toggle or a decorative accent.

**The Word Beside The Color Rule.** Every status shows a word (and usually a mark) as well as a color: Extracted, Rejected, Failed, Check. Color alone never carries meaning.

**The Tint Rule.** Every neutral leans toward paper (hue 88) or ink (hue 262). Chroma stays at 0.005 to 0.03; it drops toward the extremes of lightness.

## 3. Typography

**Display Font:** Besley (Clarendon-style slab, Google Fonts; fallback Georgia, serif)
**Body Font:** Schibsted Grotesk (sturdy grotesque; fallback system sans)
**Label/Mono Font:** Geist Mono, for figures and JSON only

**Character:** A printed ledger's heading hand over a plain-spoken grotesque, with digits set in a tabular face so columns align. The slab brings authority and a hint of rubber-stamp lettering; the grotesque stays out of the way of the numbers. Besley and Schibsted Grotesk were chosen against the reflex-reject list (no Inter, Fraunces, Instrument Serif, IBM Plex, Space Grotesk).

### Hierarchy
- **Display** (Besley 800, `clamp(2.6rem, 6vw, 4.75rem)`, 1.02, -0.02em): the landing and About headline only.
- **Headline** (Besley 700, `clamp(1.875rem, 4vw, 3rem)`, 1.08): marketing section titles.
- **Page title** (Besley 700, 1.5rem to 1.875rem, 1.15): the one H1 of each app page, auth form titles, dialog titles. The only display-face use in the app.
- **Title** (Schibsted 700, 1.125rem to 1.25rem, 1.3): step titles, legend titles, section labels.
- **Body** (Schibsted 400, 0.875rem app / 1rem to 1.125rem marketing, 1.6): prose capped at 65 to 75ch (`max-w-prose`, `max-w-md`/`max-w-xl`). Data and tables may run wider.
- **Label** (Schibsted 600, 0.75rem, +0.12em, uppercase): `.eyebrow` only, for short block labels. Never body copy.
- **Figures** (Geist Mono 400 to 500, tabular, slashed zero, -0.01em): money, dates, invoice numbers, ids, JSON, CSV. Class `.figures`.

### Named Rules
**The Display Stays Out Of The Controls Rule.** The slab never appears in buttons, labels, table cells or data. It is for titles.

**The Digits Align Rule.** Any column of numbers uses `.figures`, right-aligned. Missing values show `-` or the word "none", never an em dash.

## 4. Elevation

Flat and ruled by default: depth comes from paper-on-paper tonal steps (paper, sheet, paper warm) and 1px rules, not from shadows. Cards, inputs and tables have no shadow at rest. Shadows exist for two things only: the **paper sheet** (the invoice specimen, the ledger panel, the sticky unsaved-changes bar), which should feel like a page lifted off the desk, and the 1px lift on a switch thumb.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 0 oklch(0.22 0.035 262 / 0.05), 0 18px 36px -22px oklch(0.22 0.035 262 / 0.35)`; `shadow-sheet`, class `.paper-sheet`): a page lifted off the desk. Long, soft, below only.
- **Lift** (`0 1px 2px oklch(0.22 0.035 262 / 0.08)`; `shadow-lift`): switch thumb.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow marks a thing that is a sheet of paper, never a thing that is merely a container.

**The No Glass Rule.** No backdrop blur, no translucent cards. The sticky navbar is solid paper with a bottom rule.

## 5. Components

Every interactive component has default, hover, focus-visible, active, disabled, and (where it applies) loading and error states. Focus is a 2px `focus-blue` outline, offset 2px, from the global `:focus-visible` rule: **never write `outline-none`** on a control (in Tailwind v4 it cancels `focus-visible:outline-*`).

### Buttons
- **Shape:** gently squared, 6px radius. Height 40px default (36px small, 48px large, 28px extra-small); touch targets stay 40px or more on mobile.
- **Primary:** Rubber-Stamp Vermilion fill, Vermilion Ink text, 600 weight. Hover mixes 14% ink into the fill. Active presses 1px down. One per screen.
- **Outline:** Sheet fill, 1px Control Edge border, ink text. Hover fills with `accent`.
- **Ghost / Secondary / Link:** Ghost for toolbar actions; Secondary (paper shade) for the button on a vermilion band; Link underlines in vermilion (2px).
- **Outline-destructive:** crimson text and 50% crimson border, for entering a dangerous flow. The filled **Destructive** variant is only the final confirm.
- **Loading:** swap the icon for a spinning `Loader2`, keep the label.

### Chips and Badges
- **Style:** 4px radius, 12px semibold, a word always present, optionally a 12px icon. Variants: secondary (paper shade), outline, success, warning, destructive (outlined crimson).
- **StatusBadge:** Queued (clock), Checking and Reading (spinning loader), Extracted (check, green), Rejected (ban, amber), Failed (triangle, crimson). Verbose labels on the upload rows and detail header.

### Cards / Containers
- **Corner Style:** 8px. **Background:** Sheet. **Border:** 1px border. **Shadow:** none.
- **Padding:** 24px; denser lists use ruled rows (`divide-y`) with no container at all.
- **Don't nest cards.** Most things do not need a container: ruled rows, section labels with a 2px underline, and `dl` ledgers carry the structure.

### Inputs / Fields
- **Style:** Sheet fill, 1px Control Edge, 6px radius, 40px high. Labels sit above in 12px to 14px medium.
- **Focus:** border turns Focus Blue and a 2px outline appears. **Error:** border crimson plus an inline `text-destructive` message under the field (this app has no toaster). **Disabled:** 50% opacity.
- **Ledger fields** (document editor): look like printed lines (transparent with a hairline underline), gain the full border on hover and focus. A field named by a warning gets an amber wash and the word "Check" beside its label. Empty means "Not on document" in italic; 0 stays 0.
- **Checkbox / Switch / Radio group:** 20px tick box with a 40px hit area; the switch uses ink when on (not green); retention uses segmented radios that invert to ink when selected.

### Navigation
- **Marketing navbar:** solid paper, 64px, wordmark left, text links with a vermilion underline on hover, theme toggle, Sign in (ghost) and Start free (primary). Below `lg` a right-hand sheet menu replaces the links.
- **App sidebar:** 240px, Paper Warm, 1px right border. Active item is a Sheet-filled bordered row with a vermilion icon and semibold label (a full border, not a side stripe). A bordered credit balance block ("Credits available", large mono figure, what is held) is always visible at the bottom; on narrow screens a compact chip sits in the top bar and the sidebar opens as a left sheet.
- **Top bar:** 56px, page name, credit chip (mobile), theme toggle, account menu. A skip link is the first tab stop.

### Signature Components
- **Invoice specimen** ([src/components/brand/invoice-specimen.tsx](src/components/brand/invoice-specimen.tsx)): one sample invoice built in HTML with consistent figures (42.00 + 49.50 + 82.00 + 19.50 = 193.00; VAT 20% 38.60; total 231.60). In the hero a vermilion scan rule travels down it, each field gets a vermilion underline and rises into a ledger beside it, a green EXTRACTED stamp lands, once. Hover or the "Replay the scan" button replays it; reduced motion shows the final frame. The annotated version pins numbered markers on the sheet edge with leader lines to a legend. The static version is the auth side panel.
- **Stamp** ([src/components/brand/stamp.tsx](src/components/brand/stamp.tsx)): bordered slab capitals, slightly rotated, edges roughened by one shared SVG filter. Vermilion for NOT AN INVOICE and DUPLICATE, green for EXTRACTED and "Message sent". Stamps repeat, never replace, the status text.
- **Ledger rows and column rules:** `.ledger-lines` paints ruled paper behind a block (`--rule-h` sets the pitch); `.col-rules` draws full 1px dividers between ledger columns.
- **Upload row:** one row per file with a live status, a plain reason when stopped, and the only action that makes sense (Remove, Try again, Retry, Open).

### Motion
- **Marketing:** one orchestrated sequence (the hero scan, about 3.4s, ease-out). Everything else is static or a 150ms to 200ms hover.
- **App:** state only, 150ms to 250ms, `ease-out`: a status badge fading in, save confirmation, skeletons, the switch thumb, the FAQ plus turning to a cross. No page-load choreography.
- **Always:** ease with `cubic-bezier(0.25, 1, 0.5, 1)` (ease-out-quart) or `cubic-bezier(0.16, 1, 0.3, 1)`; never bounce; animate transform, opacity and background-size, never layout. `prefers-reduced-motion` collapses all durations and the hero shows its final frame.

### Spacing and layout
- 4px base. Section rhythm on marketing is 80px to 112px with generous, uneven gaps; tight groupings inside. App pages are `max-w-7xl` with 32px gutters (16px on phones), page header with a bottom rule, then ruled sections.
- Marketing sections are asymmetric two-column grids (a narrow text column, a wide specimen or table) that collapse to one column below `lg`. The app collapses structurally: sidebar to sheet, table columns to a second line, the document detail's two panes to a Ledger/Original switch.

## 6. Do's and Don'ts

### Do:
- **Do** show the work: every extracted figure beside its source, editable, with warnings pointing at the exact fields.
- **Do** put numbers in `.figures`, right-aligned, and give every status a word as well as a color.
- **Do** state limits and costs where the decision is made: "10 MB per file, 10 pages per PDF", "1 credit per page", "rejected files cost nothing".
- **Do** use vermilion for the one primary action per screen and for stamps; ledger green only for extracted and verified.
- **Do** build the illustration from the product itself (the invoice specimen), and keep its figures arithmetically consistent.
- **Do** confirm destructive actions inline (a confirm row or a typed phrase), and report errors inline in `text-destructive`.
- **Do** keep visible focus on every control and test both themes with axe plus the contrast pairs in section 2.
- **Do** write copy that is plain and exact, with no em dashes (use commas, colons, periods, parentheses).

### Don't:
- **Don't** build the generic AI/SaaS landing page: no gradient text, no glass cards, no three identical icon cards, no hero metric row ("99% accuracy", "under 30s").
- **Don't** invent proof: no made-up accuracy or speed figures, customer logos or testimonials.
- **Don't** use stock imagery or icon tiles in place of the product.
- **Don't** use `border-left` or `border-right` wider than 1px as a colored accent stripe on cards, rows, callouts or nav items.
- **Don't** use `background-clip: text` with a gradient, or backdrop blur as decoration.
- **Don't** default the app to cold dark "developer tool" chrome; dark is ink paper, the same roles tuned.
- **Don't** reach for a modal first, show errors in a toast (the project has no toaster), or add decorative motion in the app.
- **Don't** use the display slab in buttons, labels or data, or mono for body copy.
- **Don't** use `#000`, `#fff`, or an untinted gray; **don't** write `outline-none` on a control.
- **Don't** rotate or tilt anything in a data table; stamps and specimens may tilt, data may not.
