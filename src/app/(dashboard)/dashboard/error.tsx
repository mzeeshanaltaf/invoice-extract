"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="border-border bg-card max-w-xl rounded-md border p-8">
      <h2 className="font-display text-2xl font-bold">Something went wrong.</h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <Button onClick={reset} className="mt-5">
        Try again
      </Button>
    </div>
  );
}
