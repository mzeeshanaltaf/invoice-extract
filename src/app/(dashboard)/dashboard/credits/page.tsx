"use client";

import Link from "next/link";
import { useDashboardData } from "@/lib/dashboard-context";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, SectionLabel } from "@/components/dashboard/page-header";
import { formatDate } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  signup_bonus: "Signup",
  document_processing: "Pages read",
  refund: "Refund",
  manual_adjustment: "Adjustment",
};

export default function CreditsPage() {
  const { credits, creditHistory, isLoading } = useDashboardData();

  if (isLoading) {
    return (
      <div aria-hidden="true">
        <PageHeader title="Credits" />
        <Skeleton className="mb-8 h-28 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Credits"
        description="One credit reads one page. A credit is only spent when a document is read successfully; rejected, duplicate and failed files cost nothing."
      />

      {/* Balance, set as a ledger statement */}
      <dl className="border-border bg-card mb-10 grid rounded-md border sm:grid-cols-3">
        <div className="px-5 py-4">
          <dt className="eyebrow">Available</dt>
          <dd className="mt-1">
            <span className="figures block text-4xl leading-tight font-medium">{credits.available}</span>
            <span className="text-muted-foreground mt-1 block text-xs">what a new upload can spend</span>
          </dd>
        </div>
        <div className="border-border border-t px-5 py-4 sm:border-t-0 sm:border-l">
          <dt className="eyebrow">Held</dt>
          <dd className="mt-1">
            <span className="figures block text-4xl leading-tight font-medium">{credits.held}</span>
            <span className="text-muted-foreground mt-1 block text-xs">reserved by documents in progress</span>
          </dd>
        </div>
        <div className="border-border border-t px-5 py-4 sm:border-t-0 sm:border-l">
          <dt className="eyebrow">Balance</dt>
          <dd className="mt-1">
            <span className="figures block text-4xl leading-tight font-medium">{credits.current_balance}</span>
            <span className="text-muted-foreground mt-1 block text-xs">available plus held</span>
          </dd>
        </div>
      </dl>

      <section aria-labelledby="ledger-h">
        <SectionLabel aside={creditHistory.length > 0 ? `${creditHistory.length} entries` : undefined}>
          <span id="ledger-h">Transaction ledger</span>
        </SectionLabel>
        {creditHistory.length === 0 ? (
          <p className="text-muted-foreground py-8 text-sm">
            Nothing yet. Entries appear here when your signup credits arrive and when pages are
            read.
          </p>
        ) : (
          <div className="border-border bg-card rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditHistory.map((tx) => (
                  <TableRow key={tx.transaction_id}>
                    <TableCell className="text-muted-foreground align-top text-sm">
                      {formatDate(tx.created_at)}
                    </TableCell>
                    <TableCell className="max-w-64 align-top whitespace-normal sm:max-w-md">
                      <p className="font-medium">{tx.description}</p>
                      {tx.reference_file_id && tx.file_name_snapshot && (
                        <Link
                          href={`/dashboard/documents/${tx.reference_file_id}`}
                          className="text-muted-foreground block truncate text-xs underline-offset-4 hover:underline"
                        >
                          {tx.file_name_snapshot}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="hidden align-top sm:table-cell">
                      <Badge variant="secondary">
                        {TYPE_LABEL[tx.transaction_type] ?? tx.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`figures text-right align-top font-medium ${
                        tx.credits_delta > 0 ? "text-success" : ""
                      }`}
                    >
                      {tx.credits_delta > 0 ? `+${tx.credits_delta}` : tx.credits_delta}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
