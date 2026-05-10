import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buildJsonLd, softwareApplicationSchema } from "@/lib/json-ld";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "AI-Powered Invoice Data Extraction — InvoiceExtract",
  description:
    "Upload any invoice PDF or image and get structured line items, totals, and vendor details in seconds. Free to start — no credit card required.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "AI-Powered Invoice Data Extraction — InvoiceExtract",
    description:
      "Upload any invoice PDF or image and get structured line items, totals, and vendor details in seconds. Free to start — no credit card required.",
    url: "/",
    images: [
      {
        url: "https://invoicextract.zeeshanai.cloud/opengraph-image",
        width: 1200,
        height: 630,
        alt: "InvoiceExtract — AI-Powered Invoice Data Extraction",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI-Powered Invoice Data Extraction — InvoiceExtract",
    description:
      "Upload any invoice PDF or image and get structured line items, totals, and vendor details in seconds. Free to start — no credit card required.",
    images: ["https://invoicextract.zeeshanai.cloud/twitter-image"],
  },
};
import { Button } from "@/components/ui/button";
import { PricingCta } from "@/components/marketing/pricing-cta";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ScanLine,
  Braces,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Upload,
  Cpu,
  FileOutput,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Zap,
} from "lucide-react";

/* ─── Feature cards ─────────────────────────────────────────────── */
const features = [
  {
    icon: ScanLine,
    title: "Intelligent OCR",
    description:
      "Upload invoices in PDF, PNG, or JPEG. Our AI reads every line — amounts, dates, vendor details — with exceptional accuracy across formats and layouts.",
  },
  {
    icon: Braces,
    title: "Structured JSON Output",
    description:
      "Get line items, totals, tax breakdowns, vendor and client info, bank details — all returned as clean, structured JSON ready for your systems.",
  },
  {
    icon: ShieldCheck,
    title: "Smart Validation",
    description:
      "AI automatically detects whether a document is a real invoice, flags confidence levels, and identifies key signals like invoice numbers, dates, and totals.",
  },
];

/* ─── Steps ──────────────────────────────────────────────────────── */
const steps = [
  {
    icon: Upload,
    step: "01",
    title: "Upload Your Invoice",
    description:
      "Drop a PDF or image file. We support invoices of any layout, language, or format.",
    accent: "bg-chart-1/10 text-chart-1",
  },
  {
    icon: Cpu,
    step: "02",
    title: "AI Extracts the Data",
    description:
      "Mistral AI reads every detail — line items, totals, dates, vendor info — in seconds.",
    accent: "bg-chart-2/10 text-chart-2",
  },
  {
    icon: FileOutput,
    step: "03",
    title: "Review & Export",
    description:
      "View structured invoice data, download JSON, or copy the markdown extraction output.",
    accent: "bg-chart-3/10 text-chart-3",
  },
];

/* ─── Pricing tiers ──────────────────────────────────────────────── */
const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with invoice extraction.",
    features: [
      "5 free credits on signup",
      "PDF & image support",
      "Structured JSON output",
      "Markdown export",
      "Smart validation",
    ],
    cta: "Get started free",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "For businesses processing invoices regularly.",
    features: [
      "100 credits per month",
      "Everything in Free",
      "Bulk upload",
      "Priority processing",
      "API access",
    ],
    cta: "Coming soon",
    highlighted: false,
    comingSoon: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    description: "For teams with high-volume needs.",
    features: [
      "Unlimited credits",
      "Everything in Pro",
      "Custom integrations",
      "SLA & dedicated support",
      "On-premise deployment",
    ],
    cta: "Contact sales",
    highlighted: false,
    contactUs: true,
  },
];

/* ─── Stat items for social proof ────────────────────────────────── */
const stats = [
  { value: "99%", label: "Extraction accuracy" },
  { value: "<30s", label: "Processing time" },
  { value: "3", label: "Formats supported" },
];

/* ─── Page ───────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(softwareApplicationSchema) }}
      />
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-4">
          {/* Background image — in flow on md+ so text follows it naturally */}
          <Image
            src="/hero_section_bg.png"
            alt=""
            width={2534}
            height={1215}
            priority
            sizes="100vw"
            className="pointer-events-none hidden w-full select-none md:block"
          />
          {/* Overlay: solid on mobile, gradient on md+ */}
          <div className="pointer-events-none absolute inset-0 bg-background md:hidden" />
          <div className="pointer-events-none absolute inset-0 hidden md:block md:bg-linear-to-b md:from-background/40 md:via-background/70 md:to-background" />

          <div className="container relative mx-auto max-w-4xl py-24 text-center md:-mt-[13vw] md:pb-40 md:pt-0">
            <Badge
              variant="secondary"
              className="mb-6 gap-1.5 px-3 py-1 text-xs font-medium tracking-wide uppercase"
            >
              <Sparkles className="size-3" />
              AI-Powered Invoice Extraction
            </Badge>

            <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-balance md:text-6xl lg:text-7xl">
              Extract invoice data{" "}
              <span className="text-primary underline decoration-primary/20 decoration-4 underline-offset-[6px]">
                instantly
              </span>{" "}
              with AI
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-pretty text-muted-foreground md:text-xl">
              Upload a PDF or image, and get structured line items, totals,
              vendor details, and more — returned as clean JSON in seconds.
            </p>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button size="lg" className="gap-2 px-8">
                    Start for free <ArrowRight className="h-4 w-4" />
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Button asChild size="lg" className="gap-2 px-8">
                  <Link href="/dashboard">
                    Go to Dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </SignedIn>
              <Button variant="outline" size="lg" asChild>
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              No credit card required · 5 free credits on signup
            </p>

            {/* Stat pills */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-6 md:gap-10">
              {stats.map(({ value, label }) => (
                <div key={label} className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight md:text-3xl">
                    {value}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Format strip ────────────────────────────────────── */}
        <section className="border-y border-border/40 bg-muted/20 px-4 py-6">
          <div className="container mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Supported formats
            </span>
            <div className="flex items-center gap-2">
              <FileText className="size-4" />
              <span>PDF</span>
            </div>
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4" />
              <span>PNG</span>
            </div>
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4" />
              <span>JPEG</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="size-4" />
              <span>Any invoice layout</span>
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────── */}
        <section id="features" className="px-4 py-24">
          <div className="container mx-auto max-w-6xl">
            <div className="mb-14 max-w-2xl">
              <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-primary">
                Capabilities
              </p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Everything you need to process invoices
              </h2>
              <p className="text-muted-foreground md:text-lg">
                From raw document to structured data — our AI handles the
                complexity so you don&apos;t have to.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <Card
                  key={title}
                  className="group border-border/50 transition-colors hover:border-primary/20"
                >
                  <CardHeader>
                    <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/5 ring-1 ring-primary/10 transition-colors group-hover:bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ────────────────────────────────────── */}
        <section id="how-it-works" className="bg-muted/30 px-4 py-24">
          <div className="container mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-primary">
                How It Works
              </p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Three steps. Structured data.
              </h2>
              <p className="mx-auto max-w-xl text-muted-foreground md:text-lg">
                Upload your invoice and get extracted data in under 30 seconds.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {steps.map(({ icon: Icon, step, title, description, accent }) => (
                <div key={step} className="relative flex flex-col items-center text-center">
                  <div
                    className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${accent}`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="mb-1.5 text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground">
                    Step {step}
                  </span>
                  <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────── */}
        <section id="pricing" className="px-4 py-24">
          <div className="container mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-primary">
                Pricing
              </p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Simple, credit-based pricing
              </h2>
              <p className="mx-auto max-w-xl text-muted-foreground md:text-lg">
                1 credit = 1 page processed. Start free and scale as you grow.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((plan) => (
                <Card
                  key={plan.name}
                  className={
                    plan.highlighted
                      ? "relative border-primary/40 shadow-md shadow-primary/5"
                      : "border-border/50"
                  }
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="shadow-sm">Recommended</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      {plan.comingSoon && (
                        <Badge variant="secondary" className="text-[10px]">
                          Soon
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="text-4xl font-extrabold tracking-tight">
                        {plan.price}
                      </span>
                      <span className="ml-1.5 text-sm text-muted-foreground">
                        / {plan.period}
                      </span>
                    </div>
                    <CardDescription className="mt-1">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    <ul className="space-y-2.5">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2.5 text-sm"
                        >
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <PricingCta
                      cta={plan.cta}
                      highlighted={plan.highlighted}
                      comingSoon={plan.comingSoon}
                      contactUs={"contactUs" in plan ? plan.contactUs : false}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ──────────────────────────────────────── */}
        <section className="bg-primary px-4 py-20 text-primary-foreground">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Start extracting invoice data in seconds
            </h2>
            <p className="mb-8 text-primary-foreground/70">
              Sign up free, get 5 credits, and process your first invoice today.
            </p>
            <SignedOut>
              <SignInButton mode="modal">
                <Button size="lg" variant="secondary" className="gap-2 px-8">
                  Get started for free <ArrowRight className="h-4 w-4" />
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button asChild size="lg" variant="secondary" className="gap-2 px-8">
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </SignedIn>
          </div>
        </section>
    </>
  );
}
