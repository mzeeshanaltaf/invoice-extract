"use client";

import { useDashboardData } from "@/lib/dashboard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { CreditCard } from "lucide-react";

export default function CreditsPage() {
  const { creditBalance, creditHistory, isLoading } = useDashboardData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-14 w-24" />
            <Skeleton className="mt-2 h-4 w-32" />
          </CardContent>
        </Card>
        <div>
          <Skeleton className="mb-4 h-6 w-48" />
          <Card>
            <CardContent className="pt-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your credit balance and view transaction history.
        </p>
      </div>

      {/* Balance card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Balance
            </CardTitle>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-5xl font-bold">{creditBalance}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            credits remaining
          </p>
        </CardContent>
      </Card>

      {/* Transaction history */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Transaction History</h2>
        {creditHistory.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No transactions yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditHistory.map((tx) => (
                  <TableRow key={tx.transaction_id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(tx.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {tx.description}
                    </TableCell>
                    <TableCell>
                      {tx.reference_file_id && tx.file_name_snapshot ? (
                        <Link
                          href={`/dashboard/documents/${tx.reference_file_id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {tx.file_name_snapshot}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {tx.transaction_type === "signup_bonus"
                          ? "Signup"
                          : tx.transaction_type === "document_processing"
                            ? "Processing"
                            : tx.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        tx.credits_delta > 0
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {tx.credits_delta > 0
                        ? `+${tx.credits_delta}`
                        : tx.credits_delta}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
