"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/lib/dashboard-context";

/** Shown above every dashboard page when loading or polling the API fails. */
export function ApiErrorBanner() {
  const { error, refreshAll } = useDashboardData();
  if (!error) return null;
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={() => void refreshAll()}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
