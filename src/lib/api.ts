/**
 * Typed browser client for the InvoicExtract API (FastAPI service in `backend/`).
 *
 * Auth: Next.js keeps the Better Auth session; this module trades the session
 * cookie for a short-lived JWT (GET /api/auth/token), caches it, refreshes it
 * shortly before it expires, and sends it as `Authorization: Bearer`. A 401
 * drops the cached token and retries exactly once with a fresh one.
 *
 * Client-only (uses `authClient` and `fetch` from the browser).
 */

import { authClient } from "@/lib/auth-client";
import type {
  ApiLimits,
  Credits,
  DeleteAccountResponse,
  DeleteDocumentsResponse,
  DocumentDetail,
  DocumentListResponse,
  ExportFormat,
  InvoiceData,
  OverviewResponse,
  TransactionsResponse,
  UploadResponse,
  UserAnalytics,
  UserDocument,
  UserSettings,
  UserSettingsPatch,
} from "@/lib/types";

/* ─── Config ───────────────────────────────────────────────────── */

/**
 * Build-time (`NEXT_PUBLIC_*`). The localhost fallback exists for `next dev`
 * only: a production build without the variable fails loudly instead of
 * silently talking to localhost.
 */
const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000")
).replace(/\/$/, "");

/** Refresh the token when fewer than this many ms of validity remain. */
const REFRESH_MARGIN_MS = 60_000;

/* ─── Errors ───────────────────────────────────────────────────── */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Machine code from the API error envelope, e.g. `PDF_ENCRYPTED`. */
    public readonly code: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ─── Token cache ──────────────────────────────────────────────── */

interface CachedToken {
  token: string;
  /** Expiry in epoch ms, read from the JWT's `exp` claim. */
  expiresAt: number;
}

let cached: CachedToken | null = null;
let inflight: Promise<string> | null = null;

function decodeExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json).exp;
    if (typeof exp === "number") return exp * 1000;
  } catch {
    // fall through
  }
  // Unreadable claim: treat as valid for a minute so we never loop on refresh.
  return Date.now() + 60_000;
}

async function fetchToken(): Promise<string> {
  // GET /api/auth/token (Better Auth `jwt()` plugin), authenticated by the
  // session cookie. `$fetch` rather than `jwtClient()`: that plugin's typings
  // fail to compile on better-auth 1.6.24 and it adds nothing we use.
  const { data, error } = await authClient.$fetch<{ token: string }>("/token", {
    method: "GET",
  });
  if (error || !data?.token) {
    throw new ApiError(
      "Your session has expired. Please sign in again.",
      401,
      "UNAUTHORIZED"
    );
  }
  cached = { token: data.token, expiresAt: decodeExpiry(data.token) };
  return data.token;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (
    !forceRefresh &&
    cached &&
    cached.expiresAt - Date.now() > REFRESH_MARGIN_MS
  ) {
    return cached.token;
  }
  // Concurrent callers share one token request.
  if (!inflight) {
    inflight = fetchToken().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/**
 * Forget the cached token. Call on sign-out and account deletion so the next
 * user in the same tab can never reuse the previous user's token.
 */
export function resetApiAuth(): void {
  cached = null;
  inflight = null;
}

/* ─── Request core ─────────────────────────────────────────────── */

async function toApiError(res: Response): Promise<ApiError> {
  let code = "HTTP_ERROR";
  let message = `Request failed (${res.status}).`;
  let details: Record<string, unknown> = {};
  try {
    const body = await res.json();
    const err = body?.error;
    if (err && typeof err === "object") {
      const { code: c, message: m, ...rest } = err as Record<string, unknown>;
      if (typeof c === "string") code = c;
      if (typeof m === "string") message = m;
      details = rest;
    }
  } catch {
    // non-JSON error body: keep defaults
  }
  return new ApiError(message, res.status, code, details);
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  if (!API_URL) {
    throw new ApiError(
      "The API address is not configured (NEXT_PUBLIC_API_URL).",
      0,
      "API_NOT_CONFIGURED"
    );
  }

  const send = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    try {
      return await fetch(`${API_URL}${path}`, { ...init, headers });
    } catch {
      throw new ApiError(
        "Could not reach the server. Check your connection and try again.",
        0,
        "NETWORK_ERROR"
      );
    }
  };

  let res = await send(await getToken());
  if (res.status === 401) {
    // Expired or rotated key: one retry with a freshly issued token.
    cached = null;
    res = await send(await getToken(true));
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init);
  return (await res.json()) as T;
}

function jsonBody(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // fall through
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain ? plain[1] : fallback;
}

/** Hand a blob to the browser as a file download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ─── Endpoints ────────────────────────────────────────────────── */

export const api = {
  /** Public; no token needed server-side but harmless to send. */
  limits: () => json<ApiLimits>("/v1/meta/limits"),

  overview: (opts: { documentsLimit?: number; historyLimit?: number } = {}) =>
    json<OverviewResponse>(
      `/v1/overview${qs({
        documents_limit: opts.documentsLimit,
        history_limit: opts.historyLimit,
      })}`
    ),

  credits: () => json<Credits>("/v1/credits"),
  transactions: (opts: { limit?: number; offset?: number } = {}) =>
    json<TransactionsResponse>(`/v1/credits/transactions${qs(opts)}`),
  analytics: () => json<UserAnalytics>("/v1/analytics"),

  listDocuments: (
    opts: { limit?: number; offset?: number; q?: string; status?: string[] } = {}
  ) =>
    json<DocumentListResponse>(
      `/v1/documents${qs({
        limit: opts.limit,
        offset: opts.offset,
        q: opts.q,
        status: opts.status?.join(","),
      })}`
    ),

  getDocument: (id: string) => json<DocumentDetail>(`/v1/documents/${id}`),

  /** Bulk upload. Always 202; inspect `results[]` per file. */
  upload: (files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    return json<UploadResponse>("/v1/documents", { method: "POST", body: fd });
  },

  /** Full replacement of the edited data, or `null` to reset to the model output. */
  editDocument: (id: string, editedData: InvoiceData | null) =>
    json<DocumentDetail>(
      `/v1/documents/${id}`,
      jsonBody("PATCH", { edited_data: editedData })
    ),

  retryDocument: (id: string) =>
    json<UserDocument>(`/v1/documents/${id}/retry`, { method: "POST" }),

  deleteDocuments: (ids: string[]) =>
    json<DeleteDocumentsResponse>(
      "/v1/documents/delete",
      jsonBody("POST", { ids })
    ),

  /** The original uploaded file. Throws `FILE_REMOVED` (410) after retention. */
  documentFile: async (id: string): Promise<Blob> => {
    const res = await request(`/v1/documents/${id}/file`);
    return res.blob();
  },

  /** Download one document's export (json | csv | xlsx). */
  exportDocument: async (id: string, format: ExportFormat): Promise<void> => {
    const res = await request(
      `/v1/documents/${id}/export${qs({ format })}`
    );
    saveBlob(await res.blob(), filenameFrom(res, `invoice.${format}`));
  },

  /** Download several documents in one file. Non-processed ones are skipped. */
  exportDocuments: async (ids: string[], format: ExportFormat): Promise<void> => {
    const res = await request("/v1/exports", jsonBody("POST", { ids, format }));
    saveBlob(await res.blob(), filenameFrom(res, `invoices.${format}`));
  },

  settings: () => json<UserSettings>("/v1/settings"),
  updateSettings: (patch: UserSettingsPatch) =>
    json<UserSettings>("/v1/settings", jsonBody("PATCH", patch)),
  regenerateInboundAddress: () =>
    json<UserSettings>("/v1/settings/inbound-address/regenerate", {
      method: "POST",
    }),

  /** Removes API-side data only. The caller must then delete the Better Auth user. */
  deleteAccount: () =>
    json<DeleteAccountResponse>("/v1/account", { method: "DELETE" }),
};
