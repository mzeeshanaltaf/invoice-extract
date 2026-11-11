"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2, RotateCw, Search, Trash2, Upload } from "lucide-react";
import { useDashboardData } from "@/lib/dashboard-context";
import { api } from "@/lib/api";
import { isInFlight, type ExportFormat, type UserDocument } from "@/lib/types";
import { documentIssueMessage } from "@/lib/error-copy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmailMark, StatusBadge } from "@/components/dashboard/status-badge";
import { formatDate, formatFileSize, formatMoney } from "@/lib/utils";

type StatusFilter = "all" | "in_progress" | "processed" | "rejected" | "failed";

const STATUS_PARAMS: Record<Exclude<StatusFilter, "all">, string[]> = {
  in_progress: ["queued", "validating", "extracting"],
  processed: ["processed"],
  rejected: ["rejected"],
  failed: ["failed"],
};

function kindOf(mime: string) {
  return mime === "application/pdf" ? "PDF" : mime.replace("image/", "").toUpperCase();
}

export default function DocumentsPage() {
  const { documents, documentsTotal, isLoading, refreshAll, deleteDocuments } = useDashboardData();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [remote, setRemote] = useState<{ items: UserDocument[]; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtering = q.trim() !== "" || status !== "all";

  // Any change to the loaded list (new document, status moved on) re-runs an active search.
  const listSignature = useMemo(
    () => documents.map((d) => `${d.id}:${d.status}:${d.updated_at ?? ""}`).join("|"),
    [documents]
  );

  useEffect(() => {
    if (!filtering) {
      setRemote(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.listDocuments({
          limit: 100,
          q: q.trim() || undefined,
          status: status === "all" ? undefined : STATUS_PARAMS[status],
        });
        if (!cancelled) {
          setRemote({ items: res.items, total: res.total });
          setActionError(null);
        }
      } catch (err) {
        if (!cancelled) setActionError(err instanceof Error ? err.message : "Search failed.");
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, status, filtering, listSignature]);

  const rows: UserDocument[] = filtering ? (remote?.items ?? []) : documents;
  const searching = filtering && remote === null;
  const total = filtering ? (remote?.total ?? 0) : documentsTotal;

  // Only keep selections that are still on screen.
  const selectedDocs = useMemo(() => rows.filter((d) => selected.has(d.id)), [rows, selected]);
  const selectedIds = selectedDocs.map((d) => d.id);
  const exportable = selectedDocs.filter((d) => d.status === "processed").map((d) => d.id);
  const allChecked: boolean | "indeterminate" =
    rows.length > 0 && selectedIds.length === rows.length
      ? true
      : selectedIds.length > 0
        ? "indeterminate"
        : false;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allChecked === true ? new Set() : new Set(rows.map((d) => d.id)));

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const exportSelected = (format: ExportFormat) =>
    run(`export-${format}`, () => api.exportDocuments(exportable, format));

  const retry = (id: string) =>
    run(`retry-${id}`, async () => {
      await api.retryDocument(id);
      await refreshAll();
    });

  const doDelete = () =>
    run("delete", async () => {
      await deleteDocuments(selectedIds);
      setSelected(new Set());
      setConfirmDelete(false);
    });

  if (isLoading) {
    return (
      <div aria-hidden="true">
        <PageHeader title="Documents" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Every invoice you have sent in, with its status and total."
        actions={
          <Button asChild className="gap-2">
            <Link href="/dashboard/upload">
              <Upload /> Upload
            </Link>
          </Button>
        }
      />

      {documents.length === 0 ? (
        <div className="border-border bg-card rounded-md border p-8">
          <h2 className="font-display text-xl font-bold">No documents yet.</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
            Upload a PDF or photo of an invoice. It appears here with a status while it is checked
            and read, then as a ledger you can edit and export.
          </p>
          <Button asChild className="mt-5 gap-2">
            <Link href="/dashboard/upload">
              <Upload /> Upload your first invoice
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Search and filter */}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <Label htmlFor="doc-search" className="mb-1.5 text-xs">
                Search
              </Label>
              <div className="relative">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  id="doc-search"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="File name, seller, buyer or invoice number"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-52">
              <Label htmlFor="doc-status" className="mb-1.5 text-xs">
                Status
              </Label>
              <NativeSelect
                id="doc-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
              >
                <option value="all">All</option>
                <option value="in_progress">In progress</option>
                <option value="processed">Extracted</option>
                <option value="rejected">Rejected</option>
                <option value="failed">Failed</option>
              </NativeSelect>
            </div>
          </div>

          {/* Selection bar, or the inline delete confirmation in its place */}
          {selectedIds.length > 0 &&
            (confirmDelete ? (
              <div
                role="alertdialog"
                aria-label="Confirm delete"
                className="border-destructive/40 bg-card mb-3 flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-sm"
              >
                <p className="min-w-0 flex-1 basis-72">
                  <span className="font-semibold">
                    Delete {selectedIds.length} {selectedIds.length === 1 ? "document" : "documents"}?
                  </span>{" "}
                  <span className="text-muted-foreground">
                    The original files and extracted data are removed for good. Credits already
                    spent are not refunded.
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy !== null}
                    onClick={doDelete}
                  >
                    {busy === "delete" && <Loader2 className="animate-spin" />}
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === "delete"}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep them
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-border bg-card mb-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="mr-2 font-semibold" role="status">
                  {selectedIds.length} selected
                </span>
                {(["xlsx", "csv", "json"] as ExportFormat[]).map((f) => (
                  <Button
                    key={f}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy !== null || exportable.length === 0}
                    onClick={() => exportSelected(f)}
                  >
                    {busy === `export-${f}` ? <Loader2 className="animate-spin" /> : <Download />}
                    {f === "xlsx" ? "Excel" : f.toUpperCase()}
                  </Button>
                ))}
                {exportable.length === 0 && (
                  <span className="text-muted-foreground text-xs">
                    Only extracted documents can be exported.
                  </span>
                )}
                <Button
                  variant="outline-destructive"
                  size="sm"
                  className="ml-auto gap-1.5"
                  disabled={busy !== null}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            ))}

          {actionError && (
            <p role="alert" className="text-destructive mb-3 text-sm">
              {actionError}
            </p>
          )}

          <div className="border-border bg-card rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 pl-4">
                    <Checkbox
                      aria-label="Select all documents"
                      checked={allChecked}
                      onCheckedChange={toggleAll}
                      disabled={rows.length === 0}
                    />
                  </TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Seller</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Total</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Pages</TableHead>
                  <TableHead className="hidden xl:table-cell">Added</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {searching ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell colSpan={8}>
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="text-muted-foreground py-10 text-center text-sm whitespace-normal">
                      No documents match. Try a different search or status.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((doc) => {
                    const issue =
                      doc.status === "rejected" || doc.status === "failed"
                        ? documentIssueMessage(doc.status, doc.error_code, doc.status_detail)
                        : null;
                    return (
                      <TableRow key={doc.id} data-state={selected.has(doc.id) ? "selected" : undefined}>
                        <TableCell className="pl-4 align-top">
                          <Checkbox
                            aria-label={`Select ${doc.file_name}`}
                            checked={selected.has(doc.id)}
                            onCheckedChange={() => toggle(doc.id)}
                          />
                        </TableCell>
                        <TableCell className="max-w-56 align-top whitespace-normal sm:max-w-xs lg:max-w-sm">
                          <Link
                            href={`/dashboard/documents/${doc.id}`}
                            className="block truncate font-semibold hover:underline"
                          >
                            {doc.file_name}
                          </Link>
                          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                            <span>
                              {kindOf(doc.mime_type)} · {formatFileSize(doc.file_size)}
                              {doc.summary?.invoice_number && (
                                <span className="figures"> · {doc.summary.invoice_number}</span>
                              )}
                              {doc.summary && (
                                <span className="figures text-foreground md:hidden">
                                  {" · "}
                                  {formatMoney(doc.summary.grand_total, doc.summary.currency)}
                                </span>
                              )}
                            </span>
                            <EmailMark doc={doc} />
                            {doc.status === "processed" && !doc.file_available && doc.file_deleted_at && (
                              <span>Original removed</span>
                            )}
                          </p>
                          {issue && (
                            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{issue}</p>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap items-center gap-1">
                            <StatusBadge status={doc.status} />
                            {doc.edited && <Badge variant="outline">Edited</Badge>}
                            {doc.warning_count > 0 && (
                              <Badge variant="warning">{doc.warning_count} to check</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden max-w-40 truncate align-top lg:table-cell">
                          {doc.summary?.seller_name ?? ""}
                        </TableCell>
                        <TableCell className="figures hidden text-right align-top text-sm md:table-cell">
                          {doc.summary ? formatMoney(doc.summary.grand_total, doc.summary.currency) : ""}
                        </TableCell>
                        <TableCell className="figures text-muted-foreground hidden text-right align-top md:table-cell">
                          {doc.num_pages}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden align-top text-sm xl:table-cell">
                          {formatDate(doc.created_at)}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          {doc.status === "failed" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={busy !== null}
                              onClick={() => retry(doc.id)}
                            >
                              {busy === `retry-${doc.id}` ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <RotateCw />
                              )}
                              Retry
                            </Button>
                          ) : (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/dashboard/documents/${doc.id}`}>
                                {doc.status === "processed" ? "Open" : "View"}
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              {filtering
                ? `${rows.length} of ${total} ${total === 1 ? "match" : "matches"}`
                : total > rows.length
                  ? `Showing the latest ${rows.length} of ${total} documents. Search to find older ones.`
                  : `${total} ${total === 1 ? "document" : "documents"}`}
            </span>
            {rows.some((d) => isInFlight(d.status)) && (
              <span>Documents in progress update here by themselves.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
