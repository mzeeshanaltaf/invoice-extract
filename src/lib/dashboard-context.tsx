"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { api, ApiError, resetApiAuth } from "@/lib/api";
import {
  isInFlight,
  type CreditTransaction,
  type Credits,
  type DocumentDetail,
  type UserAnalytics,
  type UserDocument,
} from "@/lib/types";

/** How often to re-fetch the document list while any document is in flight. */
const POLL_INTERVAL_MS = 2000;
/** The list is fetched in one page; the dashboard has no pagination yet. */
const DOCUMENTS_PAGE_SIZE = 100;
const HISTORY_PAGE_SIZE = 100;

const EMPTY_CREDITS: Credits = { current_balance: 0, held: 0, available: 0 };

interface DashboardData {
  analytics: UserAnalytics | null;
  /** current_balance, held (reserved by in-flight documents) and available. */
  credits: Credits;
  creditHistory: CreditTransaction[];
  documents: UserDocument[];
  /** Total documents on the server (may exceed `documents.length`). */
  documentsTotal: number;
  /** True only for the very first load. */
  isLoading: boolean;
  /** True while at least one document is queued/validating/extracting. */
  hasInFlight: boolean;
  /** Last load/poll failure, or null. Cleared by the next success. */
  error: string | null;
  /** Re-fetch overview (credits, analytics, history) and the document list. */
  refreshAll: () => Promise<void>;
  /** Re-fetch only the document list. */
  refreshDocuments: () => Promise<void>;
  /** Full detail for one document; cached once it is in a terminal state. */
  getDocumentDetail: (id: string) => Promise<DocumentDetail | null>;
  /** Store a freshly returned detail (e.g. the PATCH response) in the cache. */
  putDocumentDetail: (detail: DocumentDetail) => void;
  /** Delete documents on the server and drop them from local state. */
  deleteDocuments: (ids: string[]) => Promise<void>;
}

const DashboardDataContext = createContext<DashboardData | null>(null);

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : "Something went wrong.";
}

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [credits, setCredits] = useState<Credits>(EMPTY_CREDITS);
  const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [documentsTotal, setDocumentsTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-document detail cache, only for documents that reached a terminal state.
  const detailCache = useRef<Map<string, DocumentDetail>>(new Map());
  // Ids that were in flight at the last list refresh (to notice completions).
  const prevInFlight = useRef<Set<string>>(new Set());
  // Guards against overlapping polls.
  const pollBusy = useRef(false);

  const hasInFlight = useMemo(
    () => documents.some((d) => isInFlight(d.status)),
    [documents]
  );

  const applyDocuments = useCallback((items: UserDocument[], total: number) => {
    // Drop cached details whose document changed (edit, retry, status change).
    for (const d of items) {
      const hit = detailCache.current.get(d.id);
      if (hit && hit.updated_at !== d.updated_at) {
        detailCache.current.delete(d.id);
      }
    }
    setDocuments(items);
    setDocumentsTotal(total);
  }, []);

  const loadOverview = useCallback(async () => {
    const o = await api.overview({
      documentsLimit: 1,
      historyLimit: HISTORY_PAGE_SIZE,
    });
    setCredits(o.credits);
    setAnalytics(o.user_analytics);
    setCreditHistory(o.credit_history);
  }, []);

  const loadDocuments = useCallback(async () => {
    const list = await api.listDocuments({ limit: DOCUMENTS_PAGE_SIZE });
    applyDocuments(list.items, list.total);
    return list.items;
  }, [applyDocuments]);

  const refreshAll = useCallback(async () => {
    try {
      const [, items] = await Promise.all([loadOverview(), loadDocuments()]);
      prevInFlight.current = new Set(
        items.filter((d) => isInFlight(d.status)).map((d) => d.id)
      );
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }, [loadOverview, loadDocuments]);

  const refreshDocuments = useCallback(async () => {
    try {
      await loadDocuments();
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }, [loadDocuments]);

  // Initial load. Entering the dashboard starts from a fresh token so a token
  // cached for a previous user in this tab can never be reused.
  useEffect(() => {
    resetApiAuth();
    let cancelled = false;
    refreshAll().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshAll]);

  // Poll only while something is in flight.
  useEffect(() => {
    if (!hasInFlight) return;

    const tick = async () => {
      if (pollBusy.current || document.hidden) return;
      pollBusy.current = true;
      try {
        const items = await loadDocuments();
        const nowInFlight = new Set(
          items.filter((d) => isInFlight(d.status)).map((d) => d.id)
        );
        // Anything that left the in-flight set may have been charged or
        // rejected: refresh credits, analytics and history.
        const settled = [...prevInFlight.current].some(
          (id) => !nowInFlight.has(id)
        );
        prevInFlight.current = nowInFlight;
        if (settled) await loadOverview();
        setError(null);
      } catch (err) {
        setError(messageOf(err));
      } finally {
        pollBusy.current = false;
      }
    };

    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasInFlight, loadDocuments, loadOverview]);

  const getDocumentDetail = useCallback(
    async (id: string): Promise<DocumentDetail | null> => {
      const hit = detailCache.current.get(id);
      if (hit) return hit;
      try {
        const detail = await api.getDocument(id);
        if (!isInFlight(detail.status)) detailCache.current.set(id, detail);
        return detail;
      } catch {
        return null;
      }
    },
    []
  );

  const putDocumentDetail = useCallback(
    (detail: DocumentDetail) => {
      if (isInFlight(detail.status)) detailCache.current.delete(detail.id);
      else detailCache.current.set(detail.id, detail);
      // The list summary (totals, edited flag, warnings) changed too.
      void refreshDocuments();
    },
    [refreshDocuments]
  );

  const deleteDocuments = useCallback(
    async (ids: string[]) => {
      const res = await api.deleteDocuments(ids);
      const gone = new Set(res.ids);
      for (const id of gone) detailCache.current.delete(id);
      setDocuments((prev) => prev.filter((d) => !gone.has(d.id)));
      setDocumentsTotal((t) => Math.max(0, t - gone.size));
      // Held credits and analytics may have changed.
      await refreshAll();
    },
    [refreshAll]
  );

  const value = useMemo<DashboardData>(
    () => ({
      analytics,
      credits,
      creditHistory,
      documents,
      documentsTotal,
      isLoading,
      hasInFlight,
      error,
      refreshAll,
      refreshDocuments,
      getDocumentDetail,
      putDocumentDetail,
      deleteDocuments,
    }),
    [
      analytics,
      credits,
      creditHistory,
      documents,
      documentsTotal,
      isLoading,
      hasInFlight,
      error,
      refreshAll,
      refreshDocuments,
      getDocumentDetail,
      putDocumentDetail,
      deleteDocuments,
    ]
  );

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error(
      "useDashboardData must be used within DashboardDataProvider"
    );
  }
  return ctx;
}
