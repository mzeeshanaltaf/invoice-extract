import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

const DESCRIPTION =
  "InvoicExtract reads supplier invoices into an editable ledger so the figures reach your books without being retyped. How it works, what it costs, and what we keep.";

export const metadata: Metadata = {
  title: "About",
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About | InvoicExtract",
    description: DESCRIPTION,
    url: "/about",
  },
  twitter: {
    title: "About | InvoicExtract",
    description: DESCRIPTION,
  },
};

const PRINCIPLES = [
  {
    title: "Show the work",
    body: "Each extracted figure sits next to the page it came from and can be edited. When lines and totals disagree, the invoice is flagged and the exact fields are marked.",
  },
  {
    title: "Say what it costs",
    body: "One credit reads one page, and a credit is only spent when a document is read successfully. Files that are not invoices, duplicates and failures cost nothing.",
  },
  {
    title: "Keep less",
    body: "You decide how long original files stay: forever, or deleted after 7, 30 or 90 days. You can delete any document, or your whole account, at any time.",
  },
  {
    title: "State the limits",
    body: "PDF, PNG or JPEG. Up to 10 MB per file, 10 pages per PDF, ten files per upload. They are written down because surprises are expensive in accounts.",
  },
];

export default async function AboutPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <>
      <section className="px-4 pt-14 pb-16 sm:px-6 md:pt-20 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">About</p>
          <h1 className="font-display mt-3 max-w-3xl text-4xl leading-[1.04] font-extrabold tracking-[-0.02em] md:text-6xl">
            Built so the figures reach your books without being retyped.
          </h1>
          <div className="mt-8 grid gap-6 md:grid-cols-2 md:gap-12">
            <p className="text-lg leading-relaxed">
              InvoicExtract is for bookkeepers and small businesses who receive supplier invoices
              as PDFs and phone photos and need every number in a spreadsheet or accounting
              package.
            </p>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Pages are read by OpenAI models. We then check the result against itself, lines
              against totals and issue date against due date, and mark what does not add up, so
              that the last look is a quick one.
            </p>
          </div>
        </div>
      </section>

      <section className="border-border border-t px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">What we hold ourselves to</p>
          <ol className="border-border mt-6 border-t-2">
            {PRINCIPLES.map((p, i) => (
              <li
                key={p.title}
                className="border-border grid gap-x-8 gap-y-2 border-b py-7 md:grid-cols-[5rem_15rem_minmax(0,1fr)] md:items-baseline"
              >
                <span className="font-display text-primary text-4xl leading-none font-extrabold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="text-xl font-bold">{p.title}</h2>
                <p className="text-muted-foreground max-w-xl leading-relaxed">{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Try it on a real invoice.
            </h2>
            <p className="mt-3 max-w-md text-lg">Five free credits. No card needed.</p>
          </div>
          <Button asChild size="lg" variant="secondary" className="gap-2">
            <Link href={session ? "/dashboard" : "/sign-up"}>
              {session ? "Go to dashboard" : "Start free"} <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
