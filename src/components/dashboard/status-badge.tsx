import { AlertTriangle, Ban, Check, Clock, Loader2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isInFlight, type DocumentStatus, type UserDocument } from "@/lib/types";

const SHORT: Record<DocumentStatus, string> = {
  queued: "Queued",
  validating: "Checking",
  extracting: "Reading",
  processed: "Extracted",
  rejected: "Rejected",
  failed: "Failed",
};

const LONG: Record<DocumentStatus, string> = {
  queued: "Queued",
  validating: "Checking it is an invoice",
  extracting: "Reading",
  processed: "Done",
  rejected: "Rejected",
  failed: "Failed",
};

/** Every state carries a word and a mark, never color alone. */
export function StatusBadge({
  status,
  verbose = false,
}: {
  status: DocumentStatus;
  verbose?: boolean;
}) {
  const label = (verbose ? LONG : SHORT)[status] ?? status;

  if (status === "queued") {
    return (
      <Badge variant="secondary">
        <Clock aria-hidden="true" />
        {label}
      </Badge>
    );
  }
  if (isInFlight(status)) {
    return (
      <Badge variant="secondary" aria-live="polite">
        <Loader2 aria-hidden="true" className="animate-spin" />
        {label}
      </Badge>
    );
  }
  if (status === "processed") {
    return (
      <Badge variant="success">
        <Check aria-hidden="true" strokeWidth={3} />
        {label}
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="warning">
        <Ban aria-hidden="true" />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <AlertTriangle aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** "By email" marker with the sender, shown wherever a document arrived by email. */
export function EmailMark({
  doc,
  showSender = true,
}: {
  doc: Pick<UserDocument, "source" | "source_detail">;
  showSender?: boolean;
}) {
  if (doc.source !== "email") return null;
  const sender = doc.source_detail?.sender;
  return (
    <span
      className="text-muted-foreground inline-flex min-w-0 items-center gap-1 text-xs"
      title={sender ? `Arrived by email from ${sender}` : "Arrived by email"}
    >
      <Mail className="size-3 shrink-0" aria-hidden="true" />
      <span className="shrink-0">By email</span>
      {showSender && sender && <span className="truncate">from {sender}</span>}
    </span>
  );
}
