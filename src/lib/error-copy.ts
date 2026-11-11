import type { UploadFileResult } from "@/lib/types";

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * User-facing text for a per-file upload failure. Falls back to the API's own
 * message for codes without bespoke copy.
 */
export function uploadErrorMessage(r: UploadFileResult): string {
  const d = r.details ?? {};
  switch (r.error_code) {
    case "PDF_ENCRYPTED":
      return "This PDF is password-protected. Remove the password and upload it again.";
    case "PAGE_LIMIT_EXCEEDED": {
      const pages = num(d.pages);
      const max = num(d.max_pages);
      return pages && max
        ? `This PDF has ${pages} pages; the limit is ${max} per file. Split it and upload the parts.`
        : (r.message ?? "This PDF has too many pages.");
    }
    case "FILE_TOO_LARGE":
      return r.message ?? "This file is larger than the size limit.";
    case "EMPTY_FILE":
      return "This file is empty.";
    case "INVALID_DOCUMENT":
      return "Unsupported or damaged file. Use a PDF, PNG or JPEG.";
    case "DUPLICATE_DOCUMENT": {
      const name = str(d.existing_file_name);
      return name
        ? `You already uploaded this file as "${name}".`
        : "You already uploaded this file.";
    }
    case "INSUFFICIENT_CREDITS": {
      const available = num(d.available);
      const required = num(d.required);
      return available !== undefined && required !== undefined
        ? `Not enough credits: this file needs ${required}, you have ${available} available.`
        : "Not enough credits for this file.";
    }
    case "TOO_MANY_IN_FLIGHT":
      return "Too many documents are still processing. Wait for some to finish, then try again.";
    case "RATE_LIMITED":
      return "Upload limit reached for this hour. Please try again later.";
    default:
      return r.message ?? "This file could not be uploaded.";
  }
}

/** Text for a document the pipeline rejected or failed (shown in lists/detail). */
export function documentIssueMessage(
  status: string,
  errorCode: string | null,
  statusDetail: string | null
): string {
  if (status === "rejected") {
    if (errorCode === "NOT_AN_INVOICE") {
      return "This doesn't look like an invoice, so it wasn't processed. No credits were used.";
    }
    if (errorCode === "UNREADABLE") {
      return "The document is too blurry or unclear to read. Try a sharper scan or photo. No credits were used.";
    }
    return statusDetail ?? "This document was rejected. No credits were used.";
  }
  if (status === "failed") {
    return (
      statusDetail ??
      "Processing failed. You can retry it; no credits were used."
    );
  }
  return statusDetail ?? "";
}

/** Request-level (whole upload) failures. */
export function requestErrorMessage(code: string, fallback: string): string {
  switch (code) {
    case "NO_FILES":
      return "Choose at least one file.";
    case "TOO_MANY_FILES":
      return fallback;
    case "REQUEST_TOO_LARGE":
      return "That upload is too large. Try fewer or smaller files.";
    default:
      return fallback;
  }
}
