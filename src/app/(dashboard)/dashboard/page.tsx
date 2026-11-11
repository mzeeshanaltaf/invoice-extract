"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, RotateCw, Upload } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useDashboardData } from "@/lib/dashboard-context";
import { api } from "@/lib/api";
import { documentIssueMessage } from "@/lib/error-copy";
import { isInFlight, type UserDocument } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionLabel } from "@/components/dashboard/page-header";
import { EmailMark, StatusBadge } from "@/components/dashboard/status-badge";

function needsAttention(d: UserDocument) {
  return (
    d.status === "failed" ||
    d.status === "rejected" ||
    (d.status === "processed" && d.warning_count > 0)
  );
}

function attentionText(d: UserDocument) {
  if (d.status === "processed") {
    return `${d.warning_count} ${d.warning_count === 1 ? "figure" : "figures"} to check. Totals or dates do not add up.`;
  }
  return documentIssueMessage(d.status, d.error_code, d.status_detail);
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="space-y-2">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** First visit: teaches the one thing to do. */
function FirstUpload({ credits }: { credits: number }) {
  return (
    <div className="border-border bg-card rounded-md border p-6 md:p-10">
      <p className="eyebrow">Start here</p>
      <h2 className="font-display mt-2 max-w-xl text-2xl leading-tight font-bold md:text-3xl">
        Upload your first invoice.
      </h2>
      <ol className="mt-6 max-w-xl space-y-3 text-sm md:text-base">
        {[
          "Drop in a PDF, PNG or JPEG. Up to 10 MB per file and 10 pages per PDF.",
          "Watch each file move from checked to read. Anything that is not an invoice is sent back for free.",
          "Check the ledger, fix what is wrong, and export to Excel, CSV or JSON.",
        ].map((t, i) => (
          <li key={t} className="flex gap-3">
            <span className="figures text-primary w-6 shrink-0 font-bold">{i + 1}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button asChild size="lg" className="gap-2">
          <Link href="/dashboard/upload">
            <Upload /> Upload invoices
          </Link>
        </Button>
        <span className="text-muted-foreground text-sm">
          {credits} {credits === 1 ? "credit" : "credits"} available, 1 credit per page.
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const firstName = session?.user.name?.trim().split(/\s+/)[0];
  const { analytics, credits, documents, documentsTotal, isLoading, refreshAll } =
    useDashboardData();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const retry = async (id: string) => {
    setRetrying(id);
    setRetryError(null);
    try {
      await api.retryDocument(id);
      await refreshAll();
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Could not retry that document.");
    } finally {
      setRetrying(null);
    }
  };

  if (isLoading) return <OverviewSkeleton />;

  const attention = documents.filter(needsAttention).slice(0, 5);
  const inFlight = documents.filter((d) => isInFlight(d.status));
  const recent = documents.slice(0, 6);

  const strip = [
    ["Documents", analytics?.total_documents_processed ?? 0],
    ["Pages read", analytics?.total_pages_processed ?? 0],
    ["PDFs", analytics?.total_pdfs_processed ?? 0],
    ["Images", analytics?.total_images_processed ?? 0],
  ] as const;

  return (
    <div>
      <PageHeader
        title="Overview"
        description={firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
        actions={
          documents.length > 0 && (
            <Button asChild className="gap-2">
              <Link href="/dashboard/upload">
                <Upload /> Upload
              </Link>
            </Button>
          )
        }
      />

      {documents.length === 0 ? (
        <FirstUpload credits={credits.available} />
      ) : (
        <div className="space-y-10">
          {/* Needs attention */}
          <section aria-labelledby="attention-h">
            <SectionLabel aside={attention.length > 0 ? `${attention.length} shown` : undefined}>
              <span id="attention-h">Needs attention</span>
            </SectionLabel>
            {retryError && (
              <p role="alert" className="text-destructive py-2 text-sm">
                {retryError}
              </p>
            )}
            {attention.length === 0 ? (
              <p className="text-success flex items-center gap-2 py-4 text-sm font-medium">
                <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                Nothing needs attention.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {attention.map((d) => (
                  <li
                    key={d.id}
                    className="grid items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/documents/${d.id}`}
                          className="truncate font-semibold hover:underline"
                        >
                          {d.file_name}
                        </Link>
                        <StatusBadge status={d.status} />
                        <EmailMark doc={d} />
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-sm">{attentionText(d)}</p>
                    </div>
                    <div className="sm:justify-self-end">
                      {d.status === "failed" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={retrying !== null}
                          onClick={() => retry(d.id)}
                        >
                          {retrying === d.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <RotateCw />
                          )}
                          Retry
                        </Button>
                      ) : (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/documents/${d.id}`}>
                            {d.status === "processed" ? "Review" : "Open"}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {inFlight.length > 0 && (
            <section aria-labelledby="progress-h">
              <SectionLabel>
                <span id="progress-h">In progress</span>
              </SectionLabel>
              <ul className="divide-border divide-y">
                {inFlight.slice(0, 5).map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <Link
                      href={`/dashboard/documents/${d.id}`}
                      className="min-w-0 truncate font-medium hover:underline"
                    >
                      {d.file_name}
                    </Link>
                    <StatusBadge status={d.status} verbose />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Recent */}
          <section aria-labelledby="recent-h">
            <SectionLabel
              aside={
                <Link
                  href="/dashboard/documents"
                  className="text-foreground inline-flex items-center gap-1 font-semibold hover:underline"
                >
                  All documents ({documentsTotal}) <ArrowRight className="size-3" />
                </Link>
              }
            >
              <span id="recent-h">Recent documents</span>
            </SectionLabel>
            <ul className="divide-border divide-y">
              {recent.map((d) => (
                <li
                  key={d.id}
                  className="grid items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto_7rem]"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/documents/${d.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {d.file_name}
                    </Link>
                    <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 text-xs">
                      <span className="truncate">
                        {d.summary?.seller_name ?? formatDate(d.created_at)}
                        {d.summary?.invoice_number && (
                          <span className="figures"> · {d.summary.invoice_number}</span>
                        )}
                      </span>
                      <EmailMark doc={d} showSender={false} />
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                  <p className="figures text-sm sm:text-right">
                    {d.summary ? formatMoney(d.summary.grand_total, d.summary.currency) : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Ledger strip */}
          <dl className="border-border grid grid-cols-2 border-y-2 sm:grid-cols-4">
            {strip.map(([label, value], i) => (
              <div
                key={label}
                className={`border-border px-4 py-3 ${i % 2 === 1 ? "border-l" : ""} ${i > 0 ? "sm:border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i === 0 ? "sm:pl-0" : ""}`}
              >
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="figures text-lg font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
