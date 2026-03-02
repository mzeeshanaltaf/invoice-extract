"use client";

import { useDashboardData } from "@/lib/dashboard-context";
import { UploadForm } from "@/components/dashboard/upload-form";

export default function UploadPage() {
  const { creditBalance, refreshAll } = useDashboardData();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a PDF or image to extract invoice data. You have{" "}
          <span className="font-semibold text-foreground">{creditBalance}</span>{" "}
          {creditBalance === 1 ? "credit" : "credits"} remaining.
        </p>
      </div>
      <UploadForm credits={creditBalance} onUploadSuccess={refreshAll} />
    </div>
  );
}
