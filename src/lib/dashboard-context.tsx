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
  UserDataResponse,
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
      const r = await fetch("/api/user-data");
      if (!r.ok) return;
      const data: UserDataResponse = await r.json();
      if (!data) return;

      if (data.user_analytics) {
        setAnalytics(data.user_analytics);
      }

      setCreditBalance(data.remaining_credit ?? 0);
      setCreditHistory(Array.isArray(data.credit_history) ? data.credit_history : []);

      const docs = Array.isArray(data.user_documents) ? data.user_documents : [];
      setDocuments(docs);

      // Pre-populate document detail cache from the full response
      docDetailCache.current.clear();
      for (const doc of docs) {
        if (doc.file_id && doc.invoice_object) {
          docDetailCache.current.set(doc.file_id, {
            file_id: doc.file_id,
            file_name: doc.file_name,
            file_size: doc.file_size,
            num_pages: doc.num_pages,
            markdown_text: doc.markdown_text,
            invoice_object: doc.invoice_object,
          });
        }
      }
    } catch {
      // silently fail — state stays at defaults
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
