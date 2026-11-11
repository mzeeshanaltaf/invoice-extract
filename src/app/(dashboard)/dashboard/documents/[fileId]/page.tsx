"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  Loader2,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { useDashboardData } from "@/lib/dashboard-context";
import { api } from "@/lib/api";
import {
  isInFlight,
  type DocumentDetail,
  type ExportFormat,
  type InvoiceData,
} from "@/lib/types";
import { documentIssueMessage } from "@/lib/error-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stamp } from "@/components/brand/stamp";
import { formatDate, formatFileSize } from "@/lib/utils";
import { MarkdownViewer } from "@/components/dashboard/markdown-viewer";
import { EmailMark, StatusBadge } from "@/components/dashboard/status-badge";
import { InvoiceLedger } from "@/components/dashboard/invoice-ledger";
import { SourcePreview } from "@/components/dashboard/document-preview";

const PROGRESS_STEPS = [
  { status: "queued", label: "Queued" },
  { status: "validating", label: "Checking it is an invoice" },
  { status: "extracting", label: "Reading" },
] as const;

function ProgressSteps({ status }: { status: string }) {
  const current = PROGRESS_STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="border-border grid border-y-2 sm:grid-cols-3" aria-label="Progress">
      {PROGRESS_STEPS.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "next";
        return (
          <li
            key={s.status}
            aria-current={state === "current" ? "step" : undefined}
            className={`border-border flex items-center gap-3 px-4 py-4 text-sm ${i > 0 ? "sm:border-l" : ""} ${i > 0 ? "border-t sm:border-t-0" : ""} ${state === "next" ? "text-muted-foreground" : "font-semibold"}`}
          >
            <span className="figures flex size-6 shrink-0 items-center justify-center">
              {state === "done" ? (
                <Check className="text-success size-4" strokeWidth={3} aria-hidden="true" />
              ) : state === "current" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <span aria-hidden="true">{i + 1}</span>
              )}
            </span>
            {s.label}
            {state === "done" && <span className="sr-only">(done)</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function DocumentDetailPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const { getDocumentDetail, putDocumentDetail, refreshAll } = useDashboardData();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [draft, setDraft] = useState<InvoiceData | null>(null); // non-null = has local edits
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"ledger" | "original">("ledger");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setDraft(null);

    getDocumentDetail(fileId).then((result) => {
      if (cancelled) return;
      if (result) setDoc(result);
      else setError(true);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fileId, getDocumentDetail]);

  // While the document is still being processed, poll it directly.
  const inFlight = doc ? isInFlight(doc.status) : false;
  useEffect(() => {
    if (!inFlight) return;
    let busyPoll = false;
    const timer = setInterval(async () => {
      if (busyPoll || document.hidden) return;
      busyPoll = true;
      try {
        const next = await api.getDocument(fileId);
        setDoc(next);
        if (!isInFlight(next.status)) {
          putDocumentDetail(next);
          void refreshAll(); // credits and analytics changed
        }
      } catch {
        // transient; the next tick retries
      } finally {
        busyPoll = false;
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [inFlight, fileId, putDocumentDetail, refreshAll]);

  const flaggedPaths = useMemo(
    () => new Set((doc?.warnings ?? []).flatMap((w) => w.fields)),
    [doc?.warnings]
  );

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }, []);

  const dirty =
    draft !== null &&
    doc?.current_data != null &&
    JSON.stringify(draft) !== JSON.stringify(doc.current_data);

  const save = async () => {
    if (!draft || !doc) return;
    setSaving(true);
    setActionError(null);
    try {
      const updated = await api.editDocument(doc.id, draft);
      setDoc(updated);
      putDocumentDetail(updated);
      setDraft(null);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  const resetEdits = () =>
    run("reset", async () => {
      if (!doc) return;
      const updated = await api.editDocument(doc.id, null);
      setDoc(updated);
      putDocumentDetail(updated);
      setDraft(null);
      setConfirmReset(false);
    });

  const exportAs = (format: ExportFormat) =>
    run(`export-${format}`, () => api.exportDocument(fileId, format));

  const retry = () =>
    run("retry", async () => {
      const next = await api.retryDocument(fileId);
      setDoc((prev) => (prev ? { ...prev, ...next } : prev));
      void refreshAll();
    });

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3 gap-1.5">
      <Link href="/dashboard/documents">
        <ArrowLeft /> Documents
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <div aria-hidden="true">
        <Skeleton className="mb-6 h-9 w-72" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div>
        {back}
        <div className="border-border bg-card max-w-xl rounded-md border p-8">
          <h1 className="font-display text-2xl font-bold">Document not found.</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            It may have been deleted, or the link may be wrong.
          </p>
        </div>
      </div>
    );
  }

  const meta = doc.current_data?.invoice_metadata;

  const header = (
    <div className="mb-6">
      {back}
      <h1 className="font-display text-2xl leading-tight font-bold tracking-tight break-words md:text-3xl">
        {doc.file_name}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusBadge status={doc.status} verbose />
        {doc.status === "processed" && doc.confidence && (
          <Badge variant={doc.confidence === "high" ? "success" : doc.confidence === "medium" ? "warning" : "destructive"}>
            {doc.confidence} confidence
          </Badge>
        )}
        {doc.edited && <Badge variant="outline">Edited</Badge>}
        {meta?.invoice_number && (
          <span className="figures text-muted-foreground text-sm">{meta.invoice_number}</span>
        )}
        <EmailMark doc={doc} />
        {savedFlash && (
          <span role="status" className="text-success animate-in fade-in inline-flex items-center gap-1 text-sm font-semibold duration-200">
            <Check className="size-4" strokeWidth={3} aria-hidden="true" /> Saved
          </span>
        )}
      </div>
    </div>
  );

  /* ── Not (yet) processed ───────────────────────────────────── */
  if (doc.status !== "processed" || !doc.current_data) {
    return (
      <div className="max-w-4xl">
        {header}
        {actionError && (
          <p role="alert" className="text-destructive mb-4 text-sm">
            {actionError}
          </p>
        )}

        {inFlight ? (
          <section aria-label="Processing">
            <ProgressSteps status={doc.status} />
            <p className="text-muted-foreground mt-4 text-sm">
              This page updates by itself. You can leave it and come back; reading can take a
              minute or more.
            </p>
            <div className="ledger-lines border-border bg-card mt-6 h-64 rounded-md border [--rule-h:2.25rem]" aria-hidden="true" />
          </section>
        ) : (
          <section className="border-border bg-card rounded-md border p-6 sm:p-8">
            {doc.status === "rejected" && (
              <Stamp size="lg" rotate={-4} className="mb-5">
                {doc.error_code === "UNREADABLE" ? "Unreadable" : "Not an invoice"}
              </Stamp>
            )}
            <p className="max-w-xl text-base leading-relaxed">
              {documentIssueMessage(doc.status, doc.error_code, doc.status_detail)}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {doc.status === "failed" && (
                <Button onClick={retry} disabled={busy !== null} className="gap-2">
                  {busy === "retry" ? <Loader2 className="animate-spin" /> : <RotateCw />}
                  Retry
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/dashboard/upload">Upload another</Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    );
  }

  /* ── Processed: source on the left, editable ledger on the right ── */
  const ledgerValue = draft ?? doc.current_data;
  const sourceVisible = mobileView === "original";

  return (
    <div>
      {header}

      {/* Exports and reset */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["xlsx", "csv", "json"] as ExportFormat[]).map((f) => (
          <Button
            key={f}
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy !== null}
            onClick={() => exportAs(f)}
          >
            {busy === `export-${f}` ? <Loader2 className="animate-spin" /> : <Download />}
            {f === "xlsx" ? "Excel" : f.toUpperCase()}
          </Button>
        ))}
        {doc.edited &&
          (confirmReset ? (
            <span role="alertdialog" aria-label="Confirm reset" className="border-border bg-card flex flex-wrap items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <span className="font-medium">Discard your edits and restore what was read?</span>
              <Button size="sm" variant="destructive" disabled={busy !== null} onClick={resetEdits} className="gap-1.5">
                {busy === "reset" && <Loader2 className="animate-spin" />}
                Restore
              </Button>
              <Button size="sm" variant="outline" disabled={busy === "reset"} onClick={() => setConfirmReset(false)}>
                Keep my edits
              </Button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" className="gap-1.5" disabled={busy !== null} onClick={() => setConfirmReset(true)}>
              <RotateCcw /> Reset to original
            </Button>
          ))}
      </div>

      {actionError && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          {actionError}
        </p>
      )}

      {doc.warnings.length > 0 && (
        <section
          aria-label="Figures to check"
          className="border-warning/30 bg-warning-soft mb-6 rounded-md border px-4 py-3"
        >
          <p className="text-warning flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {doc.warnings.length} {doc.warnings.length === 1 ? "thing" : "things"} to check
          </p>
          <ul className="text-foreground mt-1.5 list-disc space-y-0.5 pl-9 text-sm">
            {doc.warnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 pl-6 text-xs">
            The fields concerned are marked &ldquo;Check&rdquo; in the ledger.
          </p>
        </section>
      )}

      {/* Phone-width switch between the two panes */}
      <div className="border-border mb-4 inline-flex rounded-md border p-0.5 lg:hidden" role="group" aria-label="Show">
        {(
          [
            ["ledger", "Ledger"],
            ["original", "Original"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={mobileView === v}
            onClick={() => setMobileView(v)}
            className={`min-h-10 rounded-sm px-5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${
              mobileView === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className={`${sourceVisible ? "block" : "hidden"} lg:sticky lg:top-0 lg:block`}>
          <SourcePreview doc={doc} />
        </div>

        <div className={`${sourceVisible ? "hidden" : "block"} min-w-0 lg:block`}>
          <Tabs defaultValue="ledger">
            <TabsList variant="line" className="mb-2">
              <TabsTrigger value="ledger">Ledger</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="file">File</TabsTrigger>
            </TabsList>

            <TabsContent value="ledger" className="space-y-3">
              <InvoiceLedger value={ledgerValue} onChange={setDraft} flaggedPaths={flaggedPaths} />

              {doc.detected_signals.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">Signals it found</p>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.detected_signals.map((s) => (
                      <Badge key={s} variant="outline">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {dirty && (
                <div
                  role="region"
                  aria-label="Unsaved changes"
                  className="paper-sheet border-ring sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3"
                >
                  <p className="text-sm font-semibold">You have unsaved changes.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={saving} onClick={() => setDraft(null)}>
                      Discard
                    </Button>
                    <Button size="sm" disabled={saving} onClick={save} className="gap-1.5">
                      {saving && <Loader2 className="animate-spin" />}
                      Save changes
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transcript">
              <MarkdownViewer content={doc.markdown_text ?? ""} />
            </TabsContent>

            <TabsContent value="file">
              <dl className="border-border bg-card divide-border divide-y rounded-md border">
                {(
                  [
                    ["File name", doc.file_name],
                    ["Size", formatFileSize(doc.file_size)],
                    ["Pages", String(doc.num_pages)],
                    [
                      "Source",
                      doc.source === "email"
                        ? `Email${doc.source_detail?.sender ? ` from ${doc.source_detail.sender}` : ""}`
                        : "Upload",
                    ],
                    ["Added", formatDate(doc.created_at)],
                    [
                      "Original file",
                      doc.file_available
                        ? "Stored"
                        : doc.file_deleted_at
                          ? `Removed ${formatDate(doc.file_deleted_at)}`
                          : "Not stored",
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium break-words">{value}</dd>
                  </div>
                ))}
                <div className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <dt className="text-muted-foreground">Document ID</dt>
                  <dd className="figures text-muted-foreground text-xs break-all">{doc.id}</dd>
                </div>
              </dl>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
