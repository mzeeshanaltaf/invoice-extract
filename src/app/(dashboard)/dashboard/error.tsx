"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <AlertCircle className="mb-4 h-10 w-10 text-muted-foreground/50" />
      <h2 className="mb-2 text-lg font-semibold">Something went wrong</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
