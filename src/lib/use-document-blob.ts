"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

type BlobState =
  | { status: "loading" }
  | { status: "ready"; blob: Blob }
  | { status: "error"; message: string; removed: boolean };

/**
 * Fetches a document's original file from `GET /v1/documents/{id}/file` (with
 * the Authorization header, which a plain `<img src>` could not send) and
 * returns it as a Blob. `removed` is true when retention already deleted it.
 */
export function useDocumentBlob(documentId: string): BlobState {
  const [state, setState] = useState<BlobState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api
      .documentFile(documentId)
      .then((blob) => {
        if (!cancelled) setState({ status: "ready", blob });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const removed = err instanceof ApiError && err.code === "FILE_REMOVED";
        setState({
          status: "error",
          removed,
          message: removed
            ? "The original file was removed under your retention setting. The extracted data is still available."
            : err instanceof Error
              ? err.message
              : "Could not load the file.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return state;
}
