"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  UserAnalytics,
  CreditTransaction,
  UserDocument,
  MarkdownInvoiceResponse,
} from "@/lib/types";

interface DashboardData {
  analytics: UserAnalytics | null;
  creditBalance: number;
  creditHistory: CreditTransaction[];
  documents: UserDocument[];
  isLoading: boolean;
  refreshAll: () => Promise<void>;
  getDocumentDetail: (
    fileId: string
  ) => Promise<MarkdownInvoiceResponse | null>;
}

const DashboardDataContext = createContext<DashboardData | null>(null);

/** Safely extract a single item — handles both array and unwrapped responses */
function unwrap<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  if (typeof raw === "object" && "error" in (raw as Record<string, unknown>))
    return null;
  return raw as T;
}

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cache for document detail pages — keyed by fileId
  const docDetailCache = useRef<Map<string, MarkdownInvoiceResponse>>(
    new Map()
  );

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [analyticsData, balanceData, historyData, docsData] =
        await Promise.all([
          fetch("/api/analytics")
            .then(async (r) => {
              if (!r.ok) return null;
              return r.json();
            })
            .catch(() => null),
          fetch("/api/credits/balance")
            .then(async (r) => {
              if (!r.ok) return null;
              return r.json();
            })
            .catch(() => null),
          fetch("/api/credits/history")
            .then(async (r) => {
              if (!r.ok) return [];
              return r.json();
            })
            .catch(() => []),
          fetch("/api/documents")
            .then(async (r) => {
              if (!r.ok) return [];
              return r.json();
            })
            .catch(() => []),
        ]);

      // Analytics — handle array or unwrapped object
      const a = unwrap<UserAnalytics>(analyticsData);
      if (a && "total_documents_processed" in a) {
        setAnalytics(a);
      }

      // Credit balance — handle array or unwrapped object
      const b = unwrap<{ current_balance: number }>(balanceData);
      if (b && "current_balance" in b) {
        setCreditBalance(b.current_balance ?? 0);
      }

      // Credit history — always an array
      const h = Array.isArray(historyData) ? historyData : [];
      setCreditHistory(h);

      // Documents — always an array
      const d = Array.isArray(docsData) ? docsData : [];
      setDocuments(d);

      // Clear document detail cache on refresh (data may have changed)
      docDetailCache.current.clear();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /** Fetch a single document detail — returns from cache if available */
  const getDocumentDetail = useCallback(
    async (fileId: string): Promise<MarkdownInvoiceResponse | null> => {
      // Check cache first
      const cached = docDetailCache.current.get(fileId);
      if (cached) return cached;

      try {
        const r = await fetch(`/api/documents/${fileId}`);
        if (!r.ok) return null;
        const raw = await r.json();
        const doc = unwrap<MarkdownInvoiceResponse>(raw);
        if (doc && "invoice_object" in doc) {
          docDetailCache.current.set(fileId, doc);
          return doc;
        }
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  return (
    <DashboardDataContext.Provider
      value={{
        analytics,
        creditBalance,
        creditHistory,
        documents,
        isLoading,
        refreshAll: fetchAll,
        getDocumentDetail,
      }}
    >
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
