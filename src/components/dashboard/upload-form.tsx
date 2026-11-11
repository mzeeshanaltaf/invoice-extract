"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Loader2,
  RotateCw,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stamp } from "@/components/brand/stamp";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { api, ApiError } from "@/lib/api";
import { documentIssueMessage, requestErrorMessage, uploadErrorMessage } from "@/lib/error-copy";
import { useDashboardData } from "@/lib/dashboard-context";
import { formatFileSize, formatMoney } from "@/lib/utils";
import { isInFlight, type ApiLimits, type UploadFileResult } from "@/lib/types";

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ALLOWED_EXT = /\.(pdf|png|jpe?g)$/i;

// Fallbacks until GET /v1/meta/limits answers (the server stays authoritative).
const DEFAULT_LIMITS = { maxFileMb: 10, maxPages: 10, maxFiles: 10 };

/** Refusals worth a second try without touching the file. */
const RETRYABLE = new Set(["INSUFFICIENT_CREDITS", "TOO_MANY_IN_FLIGHT", "RATE_LIMITED"]);

type Phase = "ready" | "uploading" | "tracking" | "refused" | "blocked";

interface Entry {
  key: string;
  file: File | null;
  name: string;
  size: number;
  mime: string;
  phase: Phase;
  documentId?: string;
  code?: string;
  reason?: string;
}

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

interface UploadFormProps {
  /** Called after at least one file was accepted (defaults to refreshing the dashboard). */
  onUploadSuccess?: () => void;
}

export function UploadForm({ onUploadSuccess }: UploadFormProps) {
  const { documents, refreshAll } = useDashboardData();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [retrying, setRetrying] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .limits()
      .then((l: ApiLimits) => {
        if (cancelled) return;
        setLimits({
          maxFileMb: l.max_file_mb,
          maxPages: l.max_pdf_pages,
          maxFiles: l.max_files_per_upload,
        });
      })
      .catch(() => {
        // keep defaults
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const docById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const dupes: string[] = [];
      setEntries((prev) => {
        const have = new Set(prev.map((e) => e.key));
        const next = [...prev];
        for (const f of incoming) {
          const key = fileKey(f);
          if (have.has(key)) {
            dupes.push(f.name);
            continue;
          }
          have.add(key);
          const typeOk = ALLOWED_TYPES.includes(f.type) || (!f.type && ALLOWED_EXT.test(f.name));
          let blocked: string | undefined;
          if (!typeOk) blocked = "Unsupported type. Use a PDF, PNG or JPEG.";
          else if (f.size === 0) blocked = "This file is empty.";
          else if (f.size > limits.maxFileMb * 1024 * 1024)
            blocked = `Larger than ${limits.maxFileMb} MB (this one is ${formatFileSize(f.size)}).`;
          next.push({
            key,
            file: blocked ? null : f,
            name: f.name,
            size: f.size,
            mime: f.type,
            phase: blocked ? "blocked" : "ready",
            reason: blocked,
          });
        }
        return next;
      });
      setNotice(dupes.length ? `Already in the list: ${dupes.join(", ")}.` : null);
    },
    [limits.maxFileMb]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const readyEntries = entries.filter((e) => e.phase === "ready");
  const uploading = entries.some((e) => e.phase === "uploading");

  const upload = async () => {
    const batch = entries.filter((e) => e.phase === "ready" && e.file);
    if (batch.length === 0) return;
    setNotice(null);
    const batchKeys = new Set(batch.map((e) => e.key));
    setEntries((prev) => prev.map((e) => (batchKeys.has(e.key) ? { ...e, phase: "uploading" } : e)));

    // The API takes up to `maxFiles` per request; send larger drops in chunks.
    let accepted = 0;
    for (let i = 0; i < batch.length; i += limits.maxFiles) {
      const chunk = batch.slice(i, i + limits.maxFiles);
      try {
        const res = await api.upload(chunk.map((e) => e.file as File));
        const used = new Set<number>();
        const resultFor = (e: Entry, idx: number): UploadFileResult | undefined => {
          const byIndex = res.results[idx];
          if (byIndex && byIndex.file_name === e.name && !used.has(idx)) {
            used.add(idx);
            return byIndex;
          }
          const j = res.results.findIndex((r, n) => r.file_name === e.name && !used.has(n));
          if (j >= 0) {
            used.add(j);
            return res.results[j];
          }
          return undefined;
        };
        const byKey = new Map<string, UploadFileResult | undefined>();
        chunk.forEach((e, idx) => byKey.set(e.key, resultFor(e, idx)));
        accepted += res.accepted;
        setEntries((prev) =>
          prev.map((e) => {
            if (!byKey.has(e.key)) return e;
            const r = byKey.get(e.key);
            if (r?.success && r.document_id) {
              return { ...e, file: null, phase: "tracking", documentId: r.document_id };
            }
            if (r) {
              return {
                ...e,
                phase: "refused",
                code: r.error_code ?? undefined,
                reason: uploadErrorMessage(r),
              };
            }
            return { ...e, phase: "refused", reason: "No answer for this file. Try again." };
          })
        );
      } catch (err) {
        const message =
          err instanceof ApiError
            ? requestErrorMessage(err.code, err.message)
            : "Upload failed. Check your connection and try again.";
        const chunkKeys = new Set(chunk.map((e) => e.key));
        setNotice(message);
        setEntries((prev) =>
          prev.map((e) => (chunkKeys.has(e.key) ? { ...e, phase: "ready" } : e))
        );
        break;
      }
    }
    if (accepted > 0) {
      if (onUploadSuccess) onUploadSuccess();
      else await refreshAll();
    }
  };

  const remove = (key: string) => setEntries((prev) => prev.filter((e) => e.key !== key));

  const requeue = (key: string) =>
    setEntries((prev) =>
      prev.map((e) =>
        e.key === key && e.file ? { ...e, phase: "ready", code: undefined, reason: undefined } : e
      )
    );

  const retryFailed = async (entryKey: string, documentId: string) => {
    setRetrying(entryKey);
    setNotice(null);
    try {
      await api.retryDocument(documentId);
      await refreshAll();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not retry that document.");
    } finally {
      setRetrying(null);
    }
  };

  const clearFinished = () =>
    setEntries((prev) =>
      prev.filter((e) => {
        if (e.phase === "ready" || e.phase === "uploading") return true;
        if (e.phase === "tracking") {
          const d = e.documentId ? docById.get(e.documentId) : undefined;
          return !d || isInFlight(d.status) || d.status === "failed";
        }
        return false;
      })
    );

  const summary = useMemo(() => {
    let reading = 0;
    let done = 0;
    let stopped = 0;
    for (const e of entries) {
      if (e.phase === "tracking") {
        const d = e.documentId ? docById.get(e.documentId) : undefined;
        if (!d || isInFlight(d.status)) reading++;
        else if (d.status === "processed") done++;
        else stopped++;
      } else if (e.phase === "refused" || e.phase === "blocked") stopped++;
    }
    return { reading, done, stopped };
  }, [entries, docById]);

  const hasFinished = entries.some(
    (e) =>
      e.phase === "blocked" ||
      e.phase === "refused" ||
      (e.phase === "tracking" &&
        (!e.documentId || !docById.get(e.documentId) || !isInFlight(docById.get(e.documentId)!.status)))
  );

  return (
    <div className="space-y-6">
      {/* Drop zone: a real label, so it works from the keyboard and a screen reader */}
      <label
        htmlFor="invoice-files"
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        className={`focus-within:outline-ring bg-card flex cursor-pointer flex-col items-start gap-3 rounded-md border-2 border-dashed p-6 transition-colors duration-150 focus-within:outline-2 focus-within:outline-offset-2 sm:p-8 ${
          isDragging ? "border-primary bg-accent" : "border-input hover:bg-accent/50"
        }`}
      >
        <input
          ref={inputRef}
          id="invoice-files"
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          className="sr-only"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = ""; // allow picking the same file again later
          }}
        />
        <span className="flex items-center gap-3">
          <Upload className="text-primary size-6" aria-hidden="true" />
          <span className="font-display text-xl font-bold">Drop invoices here, or choose files</span>
        </span>
        <span className="figures text-muted-foreground text-xs leading-relaxed">
          PDF, PNG or JPEG · {limits.maxFileMb} MB per file · {limits.maxPages} pages per PDF ·{" "}
          {limits.maxFiles} files at a time
        </span>
      </label>

      {notice && (
        <p role="alert" className="text-destructive text-sm">
          {notice}
        </p>
      )}

      {entries.length > 0 && (
        <section aria-label="Files">
          <div className="border-border mb-1 flex flex-wrap items-center justify-between gap-3 border-b-2 pb-2">
            <p className="text-sm font-bold" role="status" aria-live="polite">
              {entries.length} {entries.length === 1 ? "file" : "files"}
              <span className="text-muted-foreground ml-2 font-normal">
                {[
                  summary.reading ? `${summary.reading} in progress` : null,
                  summary.done ? `${summary.done} done` : null,
                  summary.stopped ? `${summary.stopped} stopped` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </p>
            {hasFinished && (
              <Button variant="ghost" size="xs" onClick={clearFinished}>
                Clear finished
              </Button>
            )}
          </div>

          <ul className="divide-border divide-y">
            {entries.map((e) => {
              const Icon = e.mime === "application/pdf" || /\.pdf$/i.test(e.name) ? FileText : ImageIcon;
              const doc = e.documentId ? docById.get(e.documentId) : undefined;
              const stateKey = e.phase === "tracking" ? `t-${doc?.status ?? "queued"}` : e.phase;
              const issue =
                doc && (doc.status === "rejected" || doc.status === "failed")
                  ? documentIssueMessage(doc.status, doc.error_code, doc.status_detail)
                  : null;
              return (
                <li
                  key={e.key}
                  className="grid items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{e.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatFileSize(e.size)}
                        {doc && doc.num_pages > 0 && (
                          <>
                            {" · "}
                            {doc.num_pages} {doc.num_pages === 1 ? "page" : "pages"}
                          </>
                        )}
                        {doc?.status === "processed" && doc.summary && (
                          <span className="figures text-foreground">
                            {" · "}
                            {doc.summary.invoice_number ?? "no number"}
                            {" · "}
                            {formatMoney(doc.summary.grand_total, doc.summary.currency)}
                          </span>
                        )}
                      </p>
                      {(e.reason || issue) && (
                        <p className="text-muted-foreground mt-1 max-w-xl text-sm">{e.reason ?? issue}</p>
                      )}
                    </div>
                  </div>

                  <div
                    key={stateKey}
                    className="animate-in fade-in flex flex-wrap items-center gap-2 duration-200 sm:justify-end"
                  >
                    {e.phase === "ready" && (
                      <>
                        <Badge variant="outline">Ready</Badge>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${e.name}`}
                          onClick={() => remove(e.key)}
                        >
                          <X />
                        </Button>
                      </>
                    )}
                    {e.phase === "uploading" && (
                      <Badge variant="secondary">
                        <Loader2 className="animate-spin" aria-hidden="true" />
                        Uploading
                      </Badge>
                    )}
                    {e.phase === "tracking" && (
                      <>
                        {doc?.status === "rejected" && doc.error_code === "NOT_AN_INVOICE" && (
                          <Stamp size="sm" rotate={-4}>
                            Not an invoice
                          </Stamp>
                        )}
                        <StatusBadge status={doc?.status ?? "queued"} verbose />
                        {doc?.status === "processed" && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/documents/${doc.id}`}>Open</Link>
                          </Button>
                        )}
                        {doc?.status === "failed" && e.documentId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={retrying !== null}
                            onClick={() => retryFailed(e.key, e.documentId!)}
                          >
                            {retrying === e.key ? <Loader2 className="animate-spin" /> : <RotateCw />}
                            Retry
                          </Button>
                        )}
                      </>
                    )}
                    {(e.phase === "refused" || e.phase === "blocked") && (
                      <>
                        {e.code === "DUPLICATE_DOCUMENT" ? (
                          <Stamp size="sm" rotate={-4}>
                            Duplicate
                          </Stamp>
                        ) : (
                          <Badge variant="destructive">
                            <AlertTriangle aria-hidden="true" />
                            {e.phase === "blocked" ? "Not uploaded" : "Refused"}
                          </Badge>
                        )}
                        {e.phase === "refused" && e.file && RETRYABLE.has(e.code ?? "") && (
                          <Button variant="outline" size="sm" onClick={() => requeue(e.key)}>
                            Try again
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${e.name} from the list`}
                          onClick={() => remove(e.key)}
                        >
                          <X />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {readyEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Button onClick={upload} disabled={uploading} size="lg" className="gap-2">
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {uploading
              ? "Uploading"
              : `Extract ${readyEntries.length} ${readyEntries.length === 1 ? "file" : "files"}`}
          </Button>
          <p className="text-muted-foreground text-sm">
            Credits are spent per page, and only when a file is read successfully.
          </p>
        </div>
      )}
    </div>
  );
}
