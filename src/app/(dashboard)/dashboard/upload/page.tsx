"use client";

import Link from "next/link";
import { useDashboardData } from "@/lib/dashboard-context";
import { UploadForm } from "@/components/dashboard/upload-form";
import { PageHeader } from "@/components/dashboard/page-header";

export default function UploadPage() {
  const { credits, isLoading } = useDashboardData();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Upload"
        description={
          <>
            Each page costs one credit, charged only when a document is read.
            {!isLoading && (
              <>
                {" "}
                You have <span className="text-foreground figures font-semibold">{credits.available}</span>{" "}
                {credits.available === 1 ? "credit" : "credits"} available
                {credits.held > 0 && <> ({credits.held} held by documents in progress)</>}.
              </>
            )}
          </>
        }
      />
      {!isLoading && credits.available === 0 && (
        <p role="status" className="border-warning/30 bg-warning-soft text-warning mb-6 rounded-md border px-4 py-3 text-sm font-medium">
          You have no credits left, so new files will be refused. Documents already in progress are
          not affected.{" "}
          <Link href="/contact" className="underline underline-offset-4">
            Ask us for more
          </Link>
          .
        </p>
      )}
      <UploadForm />
    </div>
  );
}
