# SEO Plan — Invoice Extract

## Context

**Site:** https://invoicextract.zeeshanai.cloud
**Type:** SaaS landing site for an AI-powered invoice data extraction product
**Stack:** Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui, Clerk auth

A code-level audit of the marketing surface (`src/app/(marketing)/*`, `src/app/layout.tsx`, `public/`) shows the site has only the bare minimum SEO metadata in place. Critical infrastructure is missing: no `robots.txt`, no `sitemap.xml`, no Open Graph / Twitter Cards, no structured data, no canonical URLs. The hero image — likely the LCP element on the landing page — is served as an unoptimized 2534×1215 PNG via raw `<img>`, which directly impacts Core Web Vitals (a confirmed ranking factor).

**Goal:** Bring the site to a baseline that:
1. Lets search engines crawl/index the right pages and ignore auth-walled ones.
2. Makes social shares render properly.
3. Hits Core Web Vitals thresholds (LCP < 2.5s, INP < 200ms, CLS < 0.1).
4. Becomes eligible for rich results (SoftwareApplication, FAQ, Organization).
5. Lays foundation for long-tail content growth.

---

## Current State (Findings)

### What exists ✓
- Root metadata (`title`, `description`) in [src/app/layout.tsx](../src/app/layout.tsx)
- Page-specific metadata on `/about`, `/privacy`, `/terms`
- `lang="en"` on `<html>`, semantic `<main>` in marketing layout
- One H1 per page across marketing pages
- `Geist` via `next/font` (self-hosted, no FOIT)
- HTTPS

### What is missing or broken ✗

| Area | Issue | Evidence |
|---|---|---|
| Crawlability | No `robots.txt` | Not in `public/` or `src/app/` |
| Crawlability | No `sitemap.xml` | Not in `public/` or `src/app/` |
| Indexation | Dashboard routes have no `noindex` | `src/app/(dashboard)/layout.tsx` has no metadata |
| Technical | No `metadataBase` — relative OG/canonical URLs will break | `src/app/layout.tsx:12` |
| Technical | No canonical tags | No `alternates.canonical` anywhere |
| Technical | Duplicate favicons (`favicon.ico`, `favicon_1.ico`) | `src/app/` |
| Technical | No `icon.png`, `apple-icon.png`, or `manifest.webmanifest` | — |
| On-page | Homepage has no own metadata (uses root fallback) | `src/app/(marketing)/page.tsx` |
| On-page | No Open Graph metadata anywhere | — |
| On-page | No Twitter Card metadata | — |
| On-page | No OG image asset | — |
| Structured data | No JSON-LD for Organization, SoftwareApplication, FAQ | — |
| Core Web Vitals | Hero image is raw `<img>`, 2534×1215 PNG, no optimization | `src/app/(marketing)/page.tsx:144` |
| Content | No dedicated `/features`, `/pricing`, `/how-it-works` pages — only homepage anchors | — |
| Content | No blog or comparison pages | — |

---

## Implementation Plan

Phases are ordered by impact-to-effort. Phase 1–2 are blocking; Phase 3+ can be done iteratively.

### Phase 1 — Crawl & index infrastructure (highest priority)

Goal: Let Google find every public page and ignore auth pages.

| File | Action |
|---|---|
| `src/app/robots.ts` (new) | Export Next.js Metadata `MetadataRoute.Robots` — allow `/`, disallow `/dashboard`, `/api`, reference sitemap |
| `src/app/sitemap.ts` (new) | Export `MetadataRoute.Sitemap` — list `/`, `/about`, `/privacy`, `/terms` with `lastModified`, `changeFrequency`, `priority` |
| `src/app/(dashboard)/layout.tsx` | Add `export const metadata = { robots: { index: false, follow: false } }` |
| `src/app/layout.tsx` | Add `metadataBase: new URL("https://invoicextract.zeeshanai.cloud")` to root metadata |

### Phase 2 — Per-page metadata, OG, canonicals

Goal: Make every page self-describing and shareable.

| File | Action |
|---|---|
| `src/app/(marketing)/page.tsx` | Add `export const metadata` with optimized title, description, `alternates.canonical: "/"`, `openGraph`, `twitter` |
| `src/app/(marketing)/about/page.tsx` | Extend existing metadata with `alternates.canonical: "/about"`, `openGraph`, `twitter` |
| `src/app/(marketing)/privacy/page.tsx` | Same — add canonical + OG/Twitter |
| `src/app/(marketing)/terms/page.tsx` | Same — add canonical + OG/Twitter |
| `src/app/layout.tsx` | Add default `openGraph` (siteName, type=`website`, locale, default image) and `twitter` (card=`summary_large_image`) — these inherit unless overridden |
| `src/app/opengraph-image.tsx` (new) | React-rendered 1200×630 OG image using Next.js built-in route — uses brand colors and tagline |
| `src/app/twitter-image.tsx` (new) | Same as OG image for Twitter card |
| Delete `src/app/favicon_1.ico` | Duplicate file |
| Add `src/app/icon.png` (32×32 + 192×192) and `src/app/apple-icon.png` (180×180) | Modern favicon setup |
| Add `src/app/manifest.webmanifest` | PWA + better mobile UX |
| `src/app/layout.tsx` | Add `viewport: { themeColor: "..." }` export |

**Title/description guidance** (do at write-time, no need to plan in detail here): keep titles ≤60 chars with primary keyword first; descriptions 150–160 chars with a clear CTA.

### Phase 3 — Core Web Vitals (Hero image)

Goal: LCP < 2.5s. The hero image is the single biggest lever.

| File | Action |
|---|---|
| `public/hero_section_bg.png` | Replace with a WebP/AVIF version (~80KB target). Rename to `hero-section-bg.webp` (hyphens for SEO hygiene). Generate at 2× and 1× sizes for responsive serving |
| `src/app/(marketing)/page.tsx` (hero `<img>` at line ~144) | Replace with `next/image` `<Image>` — set `priority`, explicit `width`/`height` (preserve aspect ratio), `alt=""` (decorative — keep), drop the inline `style={{ width: "158.375rem" }}` and use `next/image` `sizes` prop for responsive serving |
| `next.config.ts` | No change needed — `next/image` handles AVIF/WebP automatically |

After change: run PageSpeed Insights against the deployed URL and confirm LCP element is the hero image and times under 2.5s on mobile 4G.

### Phase 4 — Structured data (JSON-LD)

Goal: Rich-result eligibility (Organization knowledge panel, SoftwareApplication card, FAQ accordion in SERP).

Pattern: server-render JSON-LD via `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />` — Next.js Server Components handle this fine.

| File | Schema | Why |
|---|---|---|
| `src/app/layout.tsx` (root, all pages) | `Organization` (name, url, logo, sameAs) | Brand SERP, knowledge panel |
| `src/app/layout.tsx` | `WebSite` (with optional `potentialAction.SearchAction`) | Sitelinks search box |
| `src/app/(marketing)/page.tsx` | `SoftwareApplication` (name, applicationCategory=`BusinessApplication`, offers, aggregateRating if you have reviews later) | App rich result |
| `src/app/(marketing)/page.tsx` | `FAQPage` — but only after adding a real FAQ section to the homepage | FAQ rich result |
| Reusable helper: `src/lib/json-ld.ts` (new) | Small `<JsonLd>` component for cleaner usage | Reuse pattern |

**Validation:** After deploy, paste each URL into https://search.google.com/test/rich-results to verify.

### Phase 5 — Content & long-tail growth (ongoing)

Goal: Capture intent-rich queries with dedicated pages.

| Action | Why |
|---|---|
| Convert `/#features`, `/#pricing`, `/#how-it-works` to standalone pages (`/features`, `/pricing`, `/how-it-works`) — homepage can keep anchor sections that link out to deep pages | Dedicated URLs rank for specific intents and earn links |
| Add a real FAQ section to the homepage (5–8 Q&As about supported formats, accuracy, pricing, security, integrations) | Powers the `FAQPage` schema and adds content depth |
| Add `/blog` (Phase 6, separate effort) — topics: "How to extract data from PDF invoices", "OCR vs AI invoice extraction", "Invoice automation guide" | Captures top-of-funnel traffic |
| Add `/about` depth — team, story, credentials | E-E-A-T signal |
| Add comparison/alternative pages (`/vs/rossum`, `/alternatives/docparser`) | High-converting branded queries |

### Phase 6 — Search Console + measurement

Goal: Close the loop — measure what's indexed and what's ranking.

1. Add Google Search Console verification meta (Property → DNS or HTML tag in `src/app/layout.tsx`)
2. Submit sitemap (`/sitemap.xml`) in GSC
3. Set up Bing Webmaster Tools with same sitemap
4. (Optional) Add a privacy-friendly analytics tool (Plausible / Umami / Vercel Analytics) — basic engagement signals help diagnose content issues

---

## Critical Files Reference

| File | Role |
|---|---|
| [src/app/layout.tsx](../src/app/layout.tsx) | Root metadata, OG defaults, JSON-LD Organization, theme color |
| [src/app/(marketing)/page.tsx](../src/app/(marketing)/page.tsx) | Homepage metadata, JSON-LD SoftwareApplication, hero image swap |
| [src/app/(marketing)/about/page.tsx](../src/app/(marketing)/about/page.tsx) | Per-page canonical + OG |
| [src/app/(marketing)/privacy/page.tsx](../src/app/(marketing)/privacy/page.tsx) | Per-page canonical + OG |
| [src/app/(marketing)/terms/page.tsx](../src/app/(marketing)/terms/page.tsx) | Per-page canonical + OG |
| [src/app/(dashboard)/layout.tsx](../src/app/(dashboard)/layout.tsx) | Add `noindex` |
| `src/app/robots.ts` (new) | robots directives |
| `src/app/sitemap.ts` (new) | sitemap generation |
| `src/app/opengraph-image.tsx` / `twitter-image.tsx` (new) | OG image generation |
| [public/hero_section_bg.png](../public/hero_section_bg.png) | Replace with WebP |
| `src/lib/json-ld.ts` (new) | Reusable JSON-LD component |

---

## Verification

After Phase 1–4 ship, validate end-to-end:

1. **Robots & sitemap**
   - `curl https://invoicextract.zeeshanai.cloud/robots.txt` → should list disallows + sitemap URL
   - `curl https://invoicextract.zeeshanai.cloud/sitemap.xml` → should list 4 public URLs
2. **Metadata**
   - View source on `/`, `/about`, `/privacy`, `/terms` — confirm `<title>`, `<meta description>`, `<link rel="canonical">`, OG tags, Twitter tags all present and correct
3. **OG image**
   - Test the live URL in https://www.opengraph.xyz/ — confirm preview image renders
4. **Structured data**
   - Test each public URL in https://search.google.com/test/rich-results — confirm Organization, SoftwareApplication, (later) FAQPage parse without errors
5. **Core Web Vitals**
   - Run https://pagespeed.web.dev/ on `/` — mobile + desktop should both be green; LCP < 2.5s
   - LCP element should be the hero `<img>` (now `next/image`)
6. **Indexation**
   - Search `site:invoicextract.zeeshanai.cloud` in Google — confirm only public pages appear (no `/dashboard/*`)
   - In GSC Coverage report, confirm 4 pages indexed and 0 errors
7. **Dashboard noindex**
   - View source on `/dashboard` (signed in) — confirm `<meta name="robots" content="noindex,nofollow">`
