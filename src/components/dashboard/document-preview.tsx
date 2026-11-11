"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Download, FileX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailMark } from "@/components/dashboard/status-badge";
import { api, saveBlob } from "@/lib/api";
import { useDocumentBlob } from "@/lib/use-document-blob";
import { formatDate } from "@/lib/utils";
import type { UserDocument } from "@/lib/types";

// react-pdf/pdfjs needs the browser: keep it client-only.
const PdfViewer = dynamic(
  () => import("@/components/ui/pdf-viewer").then((m) => ({ default: m.PdfViewer })),
  {
    ssr: false,
    loading: () => <Spinner />,
  }
);

function Spinner() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Loading the original">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}

function ImagePreview({ documentId, alt }: { documentId: string; alt: string }) {
  const file = useDocumentBlob(documentId);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file.status !== "ready") {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (file.status === "error") {
    return <p className="text-muted-foreground py-16 text-center text-sm">{file.message}</p>;
  }
  if (!url) return <Spinner />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="mx-auto max-h-[70vh] object-contain" />;
}

type PreviewDoc = Pick<
  UserDocument,
  | "id"
  | "file_name"
  | "mime_type"
  | "file_available"
  | "file_deleted_at"
  | "source"
  | "source_detail"
  | "status"
>;

/** The source file, inline beside the ledger. Says why when there is no file to show. */
export function SourcePreview({ doc }: { doc: PreviewDoc }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      saveBlob(await api.documentFile(doc.id), doc.file_name);
    } catch {
      // The preview area already explains a removed file; nothing else to do.
    } finally {
      setDownloading(false);
    }
  };

  const subject = doc.source_detail?.subject;

  return (
    <section aria-label="Original document" className="border-border bg-card overflow-hidden rounded-md border">
      <div className="border-border flex h-12 items-center justify-between gap-3 border-b px-4">
        <h2 className="eyebrow">Original</h2>
        {doc.file_available && (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={download} disabled={downloading}>
            {downloading ? <Loader2 className="animate-spin" /> : <Download />}
            Download
          </Button>
        )}
      </div>

      <div className="bg-muted/60 min-h-64 p-3">
        {doc.file_available ? (
          doc.mime_type === "application/pdf" ? (
            <PdfViewer documentId={doc.id} />
          ) : (
            <ImagePreview documentId={doc.id} alt={doc.file_name} />
          )
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <FileX className="text-muted-foreground size-8" aria-hidden="true" />
            {doc.file_deleted_at ? (
              <>
                <p className="font-semibold">The original was removed.</p>
                <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
                  Your retention setting deleted it on {formatDate(doc.file_deleted_at)}. The
                  extracted data is still here.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">No original is stored.</p>
                <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
                  {doc.status === "rejected"
                    ? "Files that are rejected are not kept."
                    : "There is no file to show for this document."}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {doc.source === "email" && (
        <div className="border-border space-y-0.5 border-t px-4 py-3 text-sm">
          <EmailMark doc={doc} />
          {subject && (
            <p className="text-muted-foreground truncate text-xs">Subject: {subject}</p>
          )}
        </div>
      )}
    </section>
  );
}
