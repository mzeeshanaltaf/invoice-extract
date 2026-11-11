import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight } from "lucide-react";
import { buildJsonLd, softwareApplicationSchema } from "@/lib/json-ld";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { HeroSpecimen, AnnotatedSpecimen } from "@/components/brand/invoice-specimen";
import { HolidayPhotoSheet, LunchMenuSheet } from "@/components/marketing/gate-specimens";
import { DeveloperExports } from "@/components/marketing/developer-exports";
import { Faq } from "@/components/marketing/faq";
import { Stamp } from "@/components/brand/stamp";

const TITLE = "InvoicExtract: Invoice Data Extraction for Bookkeepers";
const DESCRIPTION =
  "Upload invoice PDFs or photos and get an editable ledger of vendor, dates, line items and totals. Non-invoices are rejected for free. 5 free credits, no credit card.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    images: [
      {
        url: "https://invoicextract.zeeshanai.cloud/opengraph-image",
        width: 1200,
        height: 630,
        alt: "InvoicExtract: invoices in, figures out",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["https://invoicextract.zeeshanai.cloud/twitter-image"],
  },
};

const STEPS = [
  {
    n: "01",
    title: "Upload",
    body: "PDF, PNG or JPEG, up to 10 MB per file and 10 pages per PDF, ten files at a time. Or forward them by email to a private address.",
  },
  {
    n: "02",
    title: "Check and read",
    body: "Each file is checked to be a readable invoice first, then every page is read. Progress shows per file, so you can leave and come back.",
  },
  {
    n: "03",
    title: "Review and export",
    body: "Figures land in an editable ledger. Anything that does not add up is flagged. Export JSON, CSV or Excel.",
  },
];

const PRICES: [string, string][] = [
  ["Signup credits", "5, free, no card"],
  ["One page read", "1 credit"],
  ["Rejected, duplicate or failed file", "0 credits"],
  ["Editing, exporting, deleting", "0 credits"],
];

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const ctaHref = session ? "/dashboard" : "/sign-up";
  const ctaLabel = session ? "Go to dashboard" : "Start free";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(softwareApplicationSchema) }}
      />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="px-4 pt-12 pb-16 sm:px-6 md:pt-16 lg:pt-20 lg:pb-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          <div>
            <p className="eyebrow">For bookkeepers and small businesses</p>
            <h1 className="font-display mt-4 text-[clamp(2.6rem,6vw,4.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em]">
              Stop retyping <span className="stamp-underline">supplier invoices</span>.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-lg text-lg leading-relaxed">
              Drop in a PDF or a phone photo. InvoicExtract reads it into a ledger you can check
              line by line, correct in place, and export to Excel.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button asChild size="lg" className="gap-2">
                <Link href={ctaHref}>
                  {ctaLabel} <ArrowRight />
                </Link>
              </Button>
              <a
                href="#read"
                className="decoration-primary text-sm font-semibold underline decoration-2 underline-offset-4 hover:text-primary"
              >
                See what gets read
              </a>
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
              5 credits on signup. No card needed.
            </p>
          </div>

          <HeroSpecimen />
        </div>
      </section>

      {/* ── What gets read ───────────────────────────────────── */}
      <section id="read" className="border-border border-t px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <p className="eyebrow">What gets read</p>
            <h2 className="font-display mt-3 text-3xl leading-[1.08] font-bold tracking-tight md:text-5xl">
              Every field, and where it came from.
            </h2>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              The pins mark the groups of fields you get back for each invoice. All of them can be
              checked against the page and edited.
            </p>
          </div>
          <AnnotatedSpecimen />
          <p className="text-muted-foreground mt-8 text-sm">
            A sample invoice from a made-up supplier.
          </p>
        </div>
      </section>

      {/* ── The gate ─────────────────────────────────────────── */}
      <section
        id="gate"
        className="bg-primary text-primary-foreground px-4 py-20 sm:px-6 lg:py-28"
      >
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] uppercase">The gate</p>
            <h2 className="font-display mt-3 text-3xl leading-[1.08] font-bold tracking-tight md:text-5xl">
              Not an invoice? It costs nothing.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed">
              Every file is checked before it is read. A lunch menu or a holiday photo is stamped
              and sent back. So is a page too blurry to read. No credits are used for any of them.
            </p>
            <p className="mt-6 max-w-md leading-relaxed">
              Also stopped at the door, before any credit moves: password-protected PDFs, files
              over 10 MB, PDFs over 10 pages, and anything you have already uploaded.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Stamp
                tone="ink"
                size="sm"
                rotate={-4}
                className="bg-card text-foreground border-foreground px-2.5"
              >
                Duplicate
              </Stamp>
              <span className="text-sm">You are told, and not charged.</span>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 sm:gap-8">
            <LunchMenuSheet />
            <HolidayPhotoSheet />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section id="how-it-works" className="px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">How it works</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl leading-[1.08] font-bold tracking-tight md:text-5xl">
            Three steps, with the limits stated.
          </h2>
          <ol className="border-border mt-12 border-t-2">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="border-border grid gap-x-8 gap-y-2 border-b py-7 md:grid-cols-[5rem_13rem_minmax(0,1fr)] md:items-baseline"
              >
                <span className="font-display text-primary text-4xl leading-none font-extrabold md:text-5xl">
                  {s.n}
                </span>
                <h3 className="text-xl font-bold">{s.title}</h3>
                <p className="text-muted-foreground max-w-xl leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── For developers ───────────────────────────────────── */}
      <section id="developers" className="bg-band text-band-foreground px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:items-start">
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] uppercase opacity-80">
              For developers
            </p>
            <h2 className="font-display mt-3 text-3xl leading-[1.08] font-bold tracking-tight md:text-5xl">
              One invoice, three shapes.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed opacity-90">
              Every document exports as JSON, CSV or Excel. The export uses your edits, and the
              original extraction is kept so you can always reset to it.
            </p>
            <p className="mt-4 max-w-md leading-relaxed opacity-80">
              Every field is nullable on purpose: null means the invoice did not print it, and 0
              means it printed a zero.
            </p>
          </div>
          <DeveloperExports />
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section id="pricing" className="px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
          <div>
            <p className="eyebrow">Pricing</p>
            <h2 className="font-display mt-3 text-3xl leading-[1.08] font-bold tracking-tight md:text-5xl">
              A price list, not a plan matrix.
            </h2>
            <p className="text-muted-foreground mt-5 max-w-md text-lg leading-relaxed">
              Credits are charged per page, and only when a document is read successfully.
            </p>
          </div>

          <div>
            <dl className="border-border divide-border divide-y border-y-2">
              {PRICES.map(([item, price]) => (
                <div key={item} className="flex items-baseline justify-between gap-6 py-4">
                  <dt className="font-medium">{item}</dt>
                  <dd className="figures text-right">{price}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-6 py-4">
                <dt className="font-medium">
                  More credits{" "}
                  <span className="text-muted-foreground ml-1 text-sm font-normal">
                    Planned, not on sale yet
                  </span>
                </dt>
                <dd className="text-right text-sm">
                  <Link
                    href="/contact"
                    className="decoration-primary font-semibold underline decoration-2 underline-offset-4 hover:text-primary"
                  >
                    Tell us what you need
                  </Link>
                </dd>
              </div>
            </dl>
            <div className="mt-8">
              <Button asChild size="lg" className="gap-2">
                <Link href={ctaHref}>
                  {ctaLabel} <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="border-border border-t px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
          <div>
            <p className="eyebrow">Questions</p>
            <h2 className="font-display mt-3 text-3xl leading-[1.08] font-bold tracking-tight md:text-5xl">
              Before you upload.
            </h2>
          </div>
          <Faq />
        </div>
      </section>

      {/* ── Closing ──────────────────────────────────────────── */}
      <section className="bg-primary text-primary-foreground px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <h2 className="font-display max-w-xl text-3xl leading-[1.08] font-bold tracking-tight md:text-5xl">
              Clear the pile.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed">
              Five free credits are waiting on a new account. That is five pages read, with the
              totals checked.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="gap-2">
            <Link href={ctaHref}>
              {ctaLabel} <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
