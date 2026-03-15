"use client";

import { useUser } from "@clerk/nextjs";
import { useDashboardData } from "@/lib/dashboard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  FileStack,
  FileText,
  Image as ImageIcon,
  Layers,
  CreditCard,
  Upload,
  ArrowRight,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useUser();
  const { analytics, creditBalance, creditHistory, isLoading } =
    useDashboardData();

  const recentTransactions = creditHistory.slice(0, 5);

  const statCards = [
    {
      label: "Total Documents",
      value: analytics?.total_documents_processed ?? 0,
      icon: FileStack,
    },
    {
      label: "Total Pages",
      value: analytics?.total_pages_processed ?? 0,
      icon: Layers,
    },
    {
      label: "PDFs Processed",
      value: analytics?.total_pdfs_processed ?? 0,
      icon: FileText,
    },
    {
      label: "Images Processed",
      value: analytics?.total_images_processed ?? 0,
      icon: ImageIcon,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-12 w-20" />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.firstName ?? "there"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s an overview of your invoice processing activity.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credit balance + Recent activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Credit balance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Credits Remaining
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-4xl font-bold">{creditBalance}</p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/dashboard/credits">View credit history</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No activity yet. Upload your first invoice to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.transaction_id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.file_name_snapshot ?? tx.transaction_type} ·{" "}
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                    <span
                      className={
                        tx.credits_delta > 0
                          ? "ml-4 font-semibold text-green-600"
                          : "ml-4 font-semibold text-red-500"
                      }
                    >
                      {tx.credits_delta > 0
                        ? `+${tx.credits_delta}`
                        : tx.credits_delta}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty state CTA */}
      {(!analytics || analytics.total_documents_processed === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Upload className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">
              Process your first invoice
            </h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Upload a PDF or image of an invoice and our AI will extract all
              the data into structured JSON format.
            </p>
            <Button asChild className="gap-2">
              <Link href="/dashboard/upload">
                Upload invoice <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Badge variant="secondary" className="mt-4">
              5 free credits on signup
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
