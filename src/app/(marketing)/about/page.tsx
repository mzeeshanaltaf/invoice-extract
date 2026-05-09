import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import {
  ArrowRight,
  ScanLine,
  Cpu,
  Shield,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about InvoiceExtract, the AI-powered invoice data extraction platform built to save businesses time and reduce manual data entry.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About — InvoiceExtract",
    description:
      "Learn about InvoiceExtract, the AI-powered invoice data extraction platform built to save businesses time and reduce manual data entry.",
    url: "/about",
  },
  twitter: {
    title: "About — InvoiceExtract",
    description:
      "Learn about InvoiceExtract, the AI-powered invoice data extraction platform built to save businesses time and reduce manual data entry.",
  },
};

const values = [
  {
    icon: ScanLine,
    title: "Accuracy First",
    description:
      "We use state-of-the-art AI models to ensure every field is extracted correctly, from line items to tax breakdowns.",
  },
  {
    icon: Zap,
    title: "Speed Matters",
    description:
      "Invoices are processed in under 30 seconds. No queues, no waiting — just instant structured data.",
  },
  {
    icon: Shield,
    title: "Privacy by Design",
    description:
      "Your documents are processed securely and never stored longer than necessary. We never train on your data.",
  },
  {
    icon: Cpu,
    title: "Built for Developers",
    description:
      "Clean JSON output, simple API, and a dashboard that gets out of your way. Integration-ready from day one.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-4 py-24 md:py-32">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-primary">
            About Us
          </p>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-5xl">
            Making invoice processing effortless
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            InvoiceExtract was built to solve a simple problem: extracting data
            from invoices shouldn&apos;t require manual effort. We combine
            advanced AI with a clean, intuitive interface to turn any invoice
            into structured, usable data in seconds.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="border-y border-border/40 bg-muted/30 px-4 py-24">
        <div className="container mx-auto max-w-4xl">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-primary">
                Our Mission
              </p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight">
                Eliminate manual data entry
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Businesses spend countless hours manually entering invoice data
                into spreadsheets and accounting systems. We believe that time
                should be spent on what matters — growing your business, not
                copying numbers from PDFs.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                InvoiceExtract uses Mistral AI to intelligently read and
                understand invoices of any format, language, or layout. Whether
                it&apos;s a scanned image or a digital PDF, our system extracts
                every detail with high accuracy and returns it as clean,
                structured JSON.
              </p>
            </div>
            <div className="space-y-6">
              <div className="rounded-lg border border-border/50 bg-background p-6">
                <p className="text-3xl font-extrabold tracking-tight text-primary">
                  99%
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Extraction accuracy across invoice formats
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background p-6">
                <p className="text-3xl font-extrabold tracking-tight text-primary">
                  &lt;30s
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Average processing time per invoice page
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background p-6">
                <p className="text-3xl font-extrabold tracking-tight text-primary">
                  3+
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  File formats supported (PDF, PNG, JPEG)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="px-4 py-24">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-primary">
              What We Stand For
            </p>
            <h2 className="mb-4 text-3xl font-bold tracking-tight">
              Our core values
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {values.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary px-4 py-20 text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight">
            Ready to get started?
          </h2>
          <p className="mb-8 text-primary-foreground/70">
            Sign up free and process your first invoice in seconds.
          </p>
          <SignedOut>
            <SignInButton mode="modal">
              <Button size="lg" variant="secondary" className="gap-2 px-8">
                Start for free <ArrowRight className="h-4 w-4" />
              </Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="gap-2 px-8"
            >
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
