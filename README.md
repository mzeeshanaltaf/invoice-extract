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

## Tech Stack

- **Frontend:** Next.js 16.1.6, TypeScript 5, Tailwind CSS v4 (OKLch), shadcn/ui (new-york)
- **Authentication:** Clerk
- **Backend Logic:** n8n workflows exposed via webhooks
- **Icons:** Lucide React
- **Webhooks:** Svix (for Clerk events)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Clerk account ([clerk.com](https://clerk.com))
- n8n instance with configured webhook endpoints
- Environment variables configured (see below)

### Installation

```bash
# Clone and install
git clone https://github.com/yourusername/invoice-extract.git
cd invoice-extract
npm install
```

### Environment Setup

Create a `.env.local` file in the project root:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# n8n Webhooks
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook
N8N_API_KEY=your_n8n_api_key
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
│   │   ├── page.tsx          # Hero, features, pricing
│   │   └── layout.tsx        # Marketing layout
│   ├── (dashboard)/          # Authenticated dashboard
│   │   ├── layout.tsx        # Dashboard layout with sidebar
│   │   └── dashboard/
│   │       ├── page.tsx      # Overview & analytics
│   │       ├── upload/       # Invoice upload
│   │       ├── documents/    # Document list & detail
│   │       ├── credits/      # Credit balance & history
│   │       └── settings/     # Settings (placeholder)
│   ├── api/
│   │   ├── ocr/              # Invoice extraction
│   │   ├── analytics/        # User analytics
│   │   ├── credits/          # Credit management
│   │   ├── documents/        # Document list & detail
│   │   └── webhooks/         # Clerk webhook handler
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── middleware.ts         # Auth middleware
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── marketing/            # Landing page components
│   └── dashboard/            # Dashboard components
├── lib/
│   ├── types.ts              # TypeScript interfaces
│   ├── n8n.ts                # n8n webhook client
│   ├── dashboard-context.tsx # React Context for data caching
│   └── utils.ts              # Utilities
└── middleware.ts             # Next.js auth middleware
```

## API Routes

All routes require Clerk authentication.

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

### Webhooks
- `POST /api/webhooks/clerk` — Clerk user events (signup credits)

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
- Check Clerk authentication is working
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

## Deployment

### Vercel (Recommended)

```bash
# Push to GitHub
git push origin main

# Deploy from Vercel dashboard
# Set environment variables in Project Settings
# Redeploy from Git
```

### Self-Hosted

1. Build the app: `npm run build`
2. Deploy `out/` directory to your server
3. Set environment variables
4. Run `npm run start`

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
