# InvoiceExtract

AI-powered invoice data extraction SaaS. Upload PDFs or images, and get structured invoice data with high accuracy powered by Mistral AI.

## Features

- **Intelligent OCR** — AI extracts every detail from invoices with high accuracy
- **Structured Data Output** — Line items, totals, vendor info, and client details as JSON
- **Smart Validation** — AI determines if a document is a valid invoice with confidence scoring
- **File Preview** — View JPG, PNG, and PDF thumbnails before processing
- **Credit System** — Pay-as-you-go credits (free plan includes 5 credits on signup)
- **Analytics Dashboard** — Track documents processed, pages scanned, and credit usage
- **Markdown Export** — Raw document analysis in markdown format for easy review
- **Real-time Status** — Monitor processing status with confidence scoring
- **SEO-Optimised** — robots.txt, sitemap.xml, Open Graph, Twitter Cards, JSON-LD structured data, and next/image LCP optimisation

## Tech Stack

- **Frontend:** Next.js 16.1.6, TypeScript 5, Tailwind CSS v4 (OKLch), shadcn/ui (new-york)
- **Authentication:** Better Auth (email/password + Google OAuth), backed by Postgres (`invoice_extract` schema)
- **Backend Logic:** n8n workflows exposed via webhooks
- **Icons:** Lucide React
- **Contact form:** honeypot + Upstash Redis rate limiting
- **Analytics:** self-hosted Umami (cookieless)
- **Deployment:** Coolify on a Hostinger VPS; auto-deploy from `main` via GitHub Actions
- **SEO:** Next.js Metadata API, `next/og` (OG/Twitter image generation), JSON-LD structured data

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- A Postgres database (Better Auth tables live in the `invoice_extract` schema)
- Google OAuth credentials (Google Cloud Console) for social sign-in
- n8n instance with configured webhook endpoints
- Upstash Redis (contact-form rate limiting) and a Umami instance (analytics)
- Environment variables configured (see below)

### Installation

```bash
# Clone and install
git clone https://github.com/yourusername/invoice-extract.git
cd invoice-extract
npm install
```

### Environment Setup

Copy `.env.example` to `.env.local` and fill in the values:

```env
# Better Auth
BETTER_AUTH_SECRET=your_secret            # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000     # prod domain in production

# Google OAuth (redirect URI: <BETTER_AUTH_URL>/api/auth/callback/google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Database (Better Auth tables in the invoice_extract schema)
DATABASE_URL=postgres://user:password@host:5432/dbname

# n8n Webhooks
N8N_API_KEY=your_n8n_api_key
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook
N8N_CONTACT_WEBHOOK_URL=https://your-n8n-instance.com/webhook/CONTACT_WEBHOOK_ID

# Upstash Redis (contact-form rate limiting)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Umami analytics (must be set at BUILD time)
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://your-umami-host/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your_umami_website_id
```

Then create the Better Auth tables:

```bash
npx @better-auth/cli@latest migrate   # reads src/lib/auth.ts
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run start
```

## Project Structure

```
src/
├── app/
│   ├── (marketing)/          # Public landing page
│   │   ├── page.tsx          # Hero, features, pricing, JSON-LD
│   │   ├── about/page.tsx    # About page
│   │   ├── privacy/page.tsx  # Privacy policy
│   │   ├── terms/page.tsx    # Terms of service
│   │   ├── contact/page.tsx  # Contact form (honeypot + rate limiting)
│   │   └── layout.tsx        # Marketing layout
│   ├── sign-in/page.tsx      # Better Auth sign-in (email/password + Google)
│   ├── sign-up/page.tsx      # Better Auth sign-up
│   ├── (dashboard)/          # Authenticated dashboard (noindex)
│   │   ├── layout.tsx        # Dashboard layout with sidebar
│   │   └── dashboard/
│   │       ├── page.tsx      # Overview & analytics
│   │       ├── upload/       # Invoice upload
│   │       ├── documents/    # Document list & detail
│   │       ├── credits/      # Credit balance & history
│   │       └── settings/     # Settings (placeholder)
│   ├── api/
│   │   ├── auth/[...all]/    # Better Auth handler (sign-in/up, OAuth, session)
│   │   ├── ocr/              # Invoice extraction
│   │   ├── analytics/        # User analytics
│   │   ├── credits/          # Credit management
│   │   ├── documents/        # Document list & detail
│   │   ├── user-data/        # Aggregate user data
│   │   └── contact/          # Contact form submission (honeypot + rate limit)
│   ├── layout.tsx            # Root layout (metadata, JSON-LD)
│   ├── robots.ts             # robots.txt generation
│   ├── sitemap.ts            # sitemap.xml generation
│   ├── manifest.ts           # Web app manifest
│   ├── opengraph-image.tsx   # OG image (1200×630, generated)
│   ├── twitter-image.tsx     # Twitter card image (generated)
│   ├── icon.tsx              # Favicon (32×32, generated)
│   ├── apple-icon.tsx        # Apple touch icon (180×180, generated)
│   ├── globals.css           # Global styles
│   └── middleware.ts         # Auth middleware
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── marketing/            # Landing page components
│   └── dashboard/            # Dashboard components
├── lib/
│   ├── auth.ts               # Better Auth server instance (pg pool, Google, signup-credits hook)
│   ├── auth-client.ts        # Better Auth React client (useSession, signIn, signOut)
│   ├── session.ts            # getUserId() helper used by API routes
│   ├── rate-limit.ts         # Upstash sliding-window limiter (contact form)
│   ├── types.ts              # TypeScript interfaces
│   ├── n8n.ts                # n8n webhook client
│   ├── json-ld.ts            # JSON-LD schema helpers (Organization, WebSite, SoftwareApplication)
│   ├── dashboard-context.tsx # React Context for data caching
│   └── utils.ts              # Utilities
└── middleware.ts             # Better Auth session-cookie guard for /dashboard
```

## API Routes

The data routes below require a valid Better Auth session (the user id is read
server-side and forwarded to n8n as `user_id`).

### Authentication
- `ALL /api/auth/[...all]` — Better Auth: email/password, Google OAuth, session management

### OCR & Processing
- `POST /api/ocr` — Upload and process an invoice (PDF/PNG/JPEG)

### Analytics
- `GET /api/analytics` — Fetch user analytics (documents processed, pages scanned)

### Credits
- `GET /api/credits/balance` — Get remaining credit balance
- `GET /api/credits/history` — Get transaction history

### Documents
- `GET /api/documents` — List all user documents
- `GET /api/documents/[fileId]` — Fetch document with extracted invoice data

### Contact
- `POST /api/contact` — Contact form submission; drops honeypot hits silently and rate-limits per IP via Upstash

> Signup credits (5 on first sign-up) are granted by a Better Auth
> `databaseHooks.user.create.after` hook that calls the n8n credits endpoint —
> no dedicated webhook route is needed.

## Data Flow

1. **Upload** → User uploads invoice (PDF/PNG/JPEG) via `/dashboard/upload`
2. **OCR Processing** → Frontend sends file to `/api/ocr` → Backend proxies to n8n OCR endpoint
3. **AI Extraction** → n8n calls Mistral AI to extract structured data
4. **Storage** — n8n stores document and extracted data
5. **Credit Deduction** → n8n deducts credits from user account
6. **Display** → Dashboard fetches data via `/api/documents/[fileId]` and renders extracted invoice

## Caching Strategy

To prevent redundant webhook calls:

- **Dashboard Data** (analytics, credits, documents) — Cached on app load in React Context (`DashboardDataProvider`)
- **Document Detail** — Cached per-document in `useRef<Map>` on first access
- **Cache Invalidation** — Cleared after successful upload via `refreshAll()`

## Webhook Endpoints (n8n)

| Name          | UUID                                 | Purpose                           |
|---------------|--------------------------------------|-----------------------------------|
| OCR           | `6a9405d6-dcaf-4cbf-b83d-04a4535610f1` | Extract invoice data from files  |
| Analytics     | `48a48758-6c73-4d34-8453-8a1378c297a3` | Get user analytics              |
| Credits       | `818c0107-078c-40c9-9761-c3f25eac49b0` | Manage credits & transactions    |
| Documents     | `46ed3df3-414b-4e29-b1af-579c10db14cf` | List & fetch documents          |

## Invoice Data Format

The extracted invoice is structured as:

```typescript
{
  invoice_object: {
    is_invoice_related: boolean;
    confidence: "high" | "medium" | "low";
    detected_signals: string[];
    invoice_data: {
      invoice_number?: string;
      issue_date?: string;
      due_date?: string | null;
      amount_due?: number;
      currency?: string;
      subtotal?: number;
      total_amount?: number;
      tax?: { rate?: number; amount?: number };
      notes?: string;
      issuer?: {
        name?: string;
        address?: string;
        email?: string;
        phone?: string;
        website?: string;
      };
      client?: {
        name?: string;
        address?: string;
        email?: string;
        phone?: string;
      };
      line_items?: Array<{
        description: string;
        quantity: number;
        unit_price?: number;
        amount?: number;
      }>;
      banking_details?: {
        account_name?: string;
        account_number?: string;
      };
    };
  };
  markdown_text: string;
  file_name: string;
  file_size: number;
  num_pages: number;
  file_id: string;
}
```

## Testing

### Manual Testing Checklist

- [ ] Sign up and verify 5 credits are assigned
- [ ] Upload a PDF/PNG/JPEG invoice
- [ ] Verify file preview shows in upload section
- [ ] Check that extracted data displays in document detail page
- [ ] Verify credit balance decreases after upload
- [ ] Check that analytics update on Overview page
- [ ] Confirm document list shows the uploaded file
- [ ] Test error states (invalid file, zero credits)
- [ ] Verify responsive design on mobile

## Troubleshooting

### Analytics showing zeros
- Verify n8n `get_analytics_per_user` endpoint is returning valid data
- Check that you are signed in (a valid Better Auth session exists)
- Review browser DevTools Network tab to see API response

### Upload fails
- Ensure file is PDF, PNG, or JPEG
- Check that you have remaining credits
- Verify n8n OCR endpoint is accessible

### Document detail page blank
- Clear browser cache and refresh
- Check that `/api/documents/[fileId]` is returning data
- Review n8n logs for `get_markdown_invoice_object` errors

## Development Tips

### Adding New Dashboard Pages
1. Create folder under `src/app/(dashboard)/dashboard/[feature]/`
2. Add `page.tsx` as client component
3. Use `useDashboardData()` hook for cached data
4. Add navigation link to sidebar in `src/components/dashboard/sidebar.tsx`

### Styling
- Tailwind CSS v4 with OKLch color space
- CSS variables defined in `src/app/globals.css`
- shadcn/ui components use new-york preset

### Adding Invoice Extraction Fields
- Update `InvoiceData` interface in `src/lib/types.ts`
- Update rendering logic in `src/app/(dashboard)/dashboard/documents/[fileId]/page.tsx`
- Update n8n webhook to include new field

## SEO Infrastructure

The site ships with a full SEO baseline covering crawlability, social sharing, Core Web Vitals, and rich results.

### Crawl & Indexation
- **`/robots.txt`** — generated by `src/app/robots.ts`; allows all public routes, disallows `/dashboard` and `/api`
- **`/sitemap.xml`** — generated by `src/app/sitemap.ts`; lists `/`, `/about`, `/privacy`, `/terms`
- **Dashboard noindex** — `src/app/(dashboard)/layout.tsx` sets `robots: { index: false, follow: false }`

### Metadata
- **`metadataBase`** — set to `https://invoicextract.zeeshanai.cloud` so relative OG/canonical URLs resolve correctly
- **Title template** — `%s — InvoiceExtract` so child pages don't need to repeat the brand name
- **Canonical URLs** — every marketing page declares `alternates.canonical`
- **Open Graph + Twitter Cards** — default values in root layout; overridden per page

### Social Images
Generated at request-time via `next/og` (`ImageResponse`) — no static assets needed:
- `src/app/opengraph-image.tsx` → `/opengraph-image` (1200×630)
- `src/app/twitter-image.tsx` → `/twitter-image` (1200×630)
- `src/app/icon.tsx` → `/icon` (32×32 favicon)
- `src/app/apple-icon.tsx` → `/apple-icon` (180×180)

### Structured Data (JSON-LD)
Helpers live in `src/lib/json-ld.ts`. Schemas rendered server-side via `<script type="application/ld+json">`:
- **`Organization`** + **`WebSite`** — in root layout (every page)
- **`SoftwareApplication`** — on the homepage

Validate at [https://search.google.com/test/rich-results](https://search.google.com/test/rich-results).

### Core Web Vitals
The hero image is served via `next/image` with `priority` (preload) and `sizes="100vw"`. Next.js automatically serves WebP/AVIF variants and generates responsive `srcset`, targeting LCP < 2.5s.

## Deployment

The app is self-hosted on **Coolify** (Hostinger VPS) behind Traefik with
Let's Encrypt SSL. Continuous deployment is wired via GitHub Actions:

```bash
# Push to main -> .github/workflows/deploy.yml calls the Coolify deploy API
git push origin main
```

Notes:
- Env vars are set in the Coolify app. Every `NEXT_PUBLIC_*`, plus
  `BETTER_AUTH_URL` and `DATABASE_URL`, must be **build-time** variables (they're
  inlined/read during `next build`); secrets are runtime-only.
- Repo secrets `COOLIFY_API_TOKEN` (deploy-scoped) and `COOLIFY_APP_UUID` drive
  the deploy workflow.
- See [CLAUDE.md](CLAUDE.md) for the full architecture and deployment gotchas.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see the LICENSE file for details.

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/yourusername/invoice-extract/issues) page.

---

**Built with ❤️ using Next.js, TypeScript, and Tailwind CSS**
