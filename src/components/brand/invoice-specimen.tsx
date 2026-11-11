"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Check, RotateCcw } from "lucide-react";
import { Stamp } from "@/components/brand/stamp";
import { cn } from "@/lib/utils";

/*
 * The signature illustration: one sample invoice, built in HTML (no stock
 * imagery). It appears three ways:
 *   HeroSpecimen       a scan rule reads it into a ledger, then a stamp lands
 *   AnnotatedSpecimen  numbered pins with leader lines to what gets read
 *   StaticSpecimen     the finished frame, quiet, for the auth screens
 * All figures are internally consistent: 42.00 + 49.50 + 82.00 + 19.50 =
 * 193.00; 20% VAT = 38.60; total 231.60.
 */

type FieldId =
  | "vendor"
  | "buyer"
  | "number"
  | "issued"
  | "due"
  | "lines"
  | "subtotal"
  | "tax"
  | "total"
  | "bank";

const SCAN_IDS: FieldId[] = ["vendor", "number", "issued", "due", "lines", "subtotal", "tax", "total"];

const LEDGER: { id: FieldId; label: string; value: string }[] = [
  { id: "vendor", label: "Vendor", value: "Halden & Birch Ltd" },
  { id: "number", label: "Invoice no.", value: "HB-20417" },
  { id: "issued", label: "Issued", value: "2026-10-14" },
  { id: "due", label: "Due", value: "2026-11-13" },
  { id: "lines", label: "Line items", value: "4 lines" },
  { id: "subtotal", label: "Subtotal", value: "193.00" },
  { id: "tax", label: "VAT 20%", value: "38.60" },
  { id: "total", label: "Total GBP", value: "231.60" },
];

const LINES = [
  { desc: "Archive box, A4", qty: "12", unit: "3.50", amount: "42.00" },
  { desc: "Ledger book, 192 pp", qty: "6", unit: "8.25", amount: "49.50" },
  { desc: "Copier paper 80gsm, ream", qty: "20", unit: "4.10", amount: "82.00" },
  { desc: "Stamp ink, red", qty: "3", unit: "6.50", amount: "19.50" },
];

/* ── Field context ─────────────────────────────────────────────── */

interface SpecCtx {
  revealed: ReadonlySet<string> | "all";
  onAnchor?: (id: FieldId, el: HTMLElement | null) => void;
}
const Ctx = createContext<SpecCtx>({ revealed: "all" });

/** A field on the invoice. Gets the vermilion underline once it is "read". */
function F({
  id,
  anchor,
  children,
}: {
  id: FieldId;
  anchor?: boolean;
  children: React.ReactNode;
}) {
  const { revealed, onAnchor } = useContext(Ctx);
  const on = revealed === "all" || revealed.has(id);
  return (
    <span
      ref={anchor && onAnchor ? (el) => onAnchor(id, el) : undefined}
      data-on={on}
      className="spec-f"
    >
      {children}
    </span>
  );
}

/* ── The paper ─────────────────────────────────────────────────── */

function SpecimenSheet({
  className,
  sheetRef,
  children,
}: {
  className?: string;
  sheetRef?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
}) {
  return (
    // font-size scales with the container so the page keeps its proportions at any width
    <div
      ref={sheetRef}
      data-sheet
      className={cn(
        "paper-sheet relative overflow-hidden rounded-[3px] border border-border/60 text-foreground",
        className
      )}
      style={{ fontSize: "max(8px, 3.1cqw)" }}
    >
      <div className="px-[1.9em] pt-[1.8em] pb-[2.6em]">
        <p className="font-display text-[1.5em] leading-[1.1] font-bold tracking-tight">
          <F id="vendor" anchor>
            Halden &amp; Birch Ltd
          </F>
        </p>
        <div className="mt-[0.5em] flex items-end justify-between gap-[1em]">
          <p className="text-muted-foreground text-[0.82em] leading-[1.45]">
            14 Wharf Lane, Leeds LS1 4AP
            <br />
            VAT GB 218 4471 09
          </p>
          <p className="text-muted-foreground text-[0.78em] font-semibold tracking-[0.22em] uppercase">
            Invoice
          </p>
        </div>

        <dl className="col-rules border-border mt-[1.5em] grid grid-cols-3 border-y py-[0.7em] text-[0.85em] [&>*]:px-[0.8em] [&>*:first-child]:pl-0">
          <div>
            <dt className="text-muted-foreground text-[0.82em]">Invoice no.</dt>
            <dd className="figures font-medium">
              <F id="number" anchor>
                HB-20417
              </F>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[0.82em]">Issued</dt>
            <dd className="figures font-medium">
              <F id="issued" anchor>
                14 Oct 2026
              </F>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[0.82em]">Due</dt>
            <dd className="figures font-medium">
              <F id="due" anchor>
                13 Nov 2026
              </F>
            </dd>
          </div>
        </dl>

        <div className="mt-[1.3em] text-[0.85em] leading-[1.4]">
          <p className="text-muted-foreground text-[0.82em]">Bill to</p>
          <p className="font-medium">
            <F id="buyer" anchor>
              Marlow &amp; Co. Accounts
            </F>
          </p>
          <p className="text-muted-foreground">Unit 3, Canal Row, Bristol BS1 6QT</p>
        </div>

        <table className="mt-[1.4em] w-full text-[0.85em]">
          <thead>
            <tr className="border-foreground/70 text-muted-foreground border-b text-[0.82em]">
              <th className="pb-[0.4em] text-left font-medium">Description</th>
              <th className="pb-[0.4em] text-right font-medium">Qty</th>
              <th className="pb-[0.4em] text-right font-medium">Unit</th>
              <th className="pb-[0.4em] text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {LINES.map((l, i) => (
              <tr key={l.desc} className="border-border border-b">
                <td className="py-[0.5em] pr-[0.6em]">
                  <F id="lines" anchor={i === 0}>
                    {l.desc}
                  </F>
                </td>
                <td className="figures py-[0.5em] text-right">{l.qty}</td>
                <td className="figures py-[0.5em] text-right">{l.unit}</td>
                <td className="figures py-[0.5em] text-right">{l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-[0.9em] ml-auto w-[62%] text-[0.85em]">
          <div className="flex justify-between py-[0.2em]">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="figures">
              <F id="subtotal" anchor>
                193.00
              </F>
            </dd>
          </div>
          <div className="flex justify-between py-[0.2em]">
            <dt className="text-muted-foreground">VAT 20%</dt>
            <dd className="figures">
              <F id="tax" anchor>
                38.60
              </F>
            </dd>
          </div>
          <div className="border-foreground/70 mt-[0.3em] flex justify-between border-t-2 pt-[0.4em] font-semibold">
            <dt>Total GBP</dt>
            <dd className="figures">
              <F id="total" anchor>
                231.60
              </F>
            </dd>
          </div>
        </dl>

        <p className="border-border text-muted-foreground mt-[1.6em] border-t border-dashed pt-[0.8em] text-[0.76em] leading-[1.5]">
          Pay by bank transfer within 30 days.
          <br />
          <F id="bank" anchor>
            IBAN GB82 WEST 1234 5698 7654 32
          </F>
          <span className="figures"> · BIC WESTGB22</span>
        </p>
      </div>
      {children}
    </div>
  );
}

/* ── The ledger beside it ──────────────────────────────────────── */

function LedgerPanel({
  revealed,
  className,
}: {
  revealed: ReadonlySet<string> | "all";
  className?: string;
}) {
  const isOn = (id: string) => revealed === "all" || revealed.has(id);
  return (
    <div
      className={cn(
        "paper-sheet ledger-lines border-border/60 relative rounded-[3px] border [--rule-h:2.25rem]",
        className
      )}
    >
      <div className="flex h-9 items-center justify-between px-4">
        <span className="eyebrow">Extracted</span>
        <span className="eyebrow">Ledger</span>
      </div>
      <ol>
        {LEDGER.map((r, i) => (
          <li
            key={r.id}
            data-on={isOn(r.id)}
            className="hero-row grid h-9 grid-cols-[1.75rem_5.25rem_minmax(0,1fr)] items-center px-4 text-sm"
          >
            <span className="figures text-muted-foreground text-xs">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-muted-foreground">{r.label}</span>
            <span className="figures truncate text-right font-medium">{r.value}</span>
          </li>
        ))}
        <li
          data-on={isOn("check")}
          className="hero-row text-success flex h-9 items-center gap-2 px-4 text-sm font-medium"
        >
          <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
          Lines add up to the subtotal
        </li>
      </ol>
    </div>
  );
}

/* ── Hero: scan, read, stamp ───────────────────────────────────── */

const DEFAULT_THRESHOLDS: Record<string, number> = {
  vendor: 0.07,
  number: 0.2,
  issued: 0.2,
  due: 0.2,
  lines: 0.55,
  subtotal: 0.74,
  tax: 0.78,
  total: 0.83,
};

export function HeroSpecimen() {
  const reduce = useReducedMotion();
  const allIds = useMemo(() => new Set<string>([...SCAN_IDS, "check"]), []);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [stamped, setStamped] = useState(false);
  const [scanning, setScanning] = useState(false);

  const progress = useMotionValue(0);
  const scanY = useTransform(progress, [0, 1], ["-100%", "0%"]);

  const sheetRef = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<FieldId, HTMLElement>());
  const timers = useRef<number[]>([]);
  const controls = useRef<{ stop: () => void } | null>(null);
  const playing = useRef(false);
  const finished = useRef(false);

  const onAnchor = useCallback((id: FieldId, el: HTMLElement | null) => {
    if (el) anchors.current.set(id, el);
    else anchors.current.delete(id);
  }, []);

  const measure = useCallback(() => {
    const out: Record<string, number> = { ...DEFAULT_THRESHOLDS };
    const sheet = sheetRef.current;
    if (!sheet) return out;
    const sr = sheet.getBoundingClientRect();
    if (sr.height === 0) return out;
    for (const id of SCAN_IDS) {
      const el = anchors.current.get(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out[id] = Math.min(0.98, Math.max(0.02, (r.top + r.height / 2 - sr.top) / sr.height));
    }
    return out;
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const showFinal = useCallback(() => {
    setRevealed(new Set(allIds));
    setStamped(true);
    setScanning(false);
    progress.set(1);
    finished.current = true;
    playing.current = false;
  }, [allIds, progress]);

  const play = useCallback(() => {
    if (playing.current) return;
    playing.current = true;
    finished.current = false;
    clearTimers();
    controls.current?.stop();
    setStamped(false);
    setRevealed(new Set());
    progress.set(0);
    setScanning(true);

    const th = measure();
    let count = 0;
    controls.current = animate(progress, 1, {
      duration: 3.4,
      ease: [0.45, 0.05, 0.35, 1],
      onUpdate: (v) => {
        const ids = SCAN_IDS.filter((id) => th[id] <= v);
        if (ids.length !== count) {
          count = ids.length;
          setRevealed(new Set(ids));
        }
      },
      onComplete: () => {
        setRevealed(new Set(allIds));
        setScanning(false);
        timers.current.push(
          window.setTimeout(() => {
            setStamped(true);
            finished.current = true;
            playing.current = false;
          }, 320)
        );
      },
    });
  }, [allIds, clearTimers, measure, progress]);

  useEffect(() => {
    if (reduce) {
      showFinal();
      return;
    }
    // Wait a beat so fonts and layout have settled before the first scan.
    timers.current.push(window.setTimeout(play, 650));
    return () => {
      clearTimers();
      controls.current?.stop();
      playing.current = false;
    };
  }, [reduce, play, showFinal, clearTimers]);

  const ctx = useMemo<SpecCtx>(() => ({ revealed, onAnchor }), [revealed, onAnchor]);

  return (
    <div
      className="relative"
      onPointerEnter={() => {
        if (!reduce && finished.current) play();
      }}
    >
      <noscript>
        <style>{`.hero-row{opacity:1!important;transform:none!important}.spec-f{background-size:100% .13em!important}.hero-stamp{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      <div
        role="img"
        aria-label="A sample invoice being read. A scan rule moves down the page and lifts the vendor, invoice number, dates, line items and totals into a ledger, then an EXTRACTED stamp lands on the page."
        className="grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-0"
      >
        <div aria-hidden="true" className="@container relative z-10 w-full max-w-[26rem] justify-self-center md:justify-self-start">
          <Ctx.Provider value={ctx}>
            <SpecimenSheet sheetRef={sheetRef}>
              {/* scan rule */}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-300",
                  scanning ? "opacity-100" : "opacity-0"
                )}
              >
                <motion.div className="absolute inset-0" style={{ y: scanY }}>
                  <div className="from-primary/0 to-primary/15 absolute right-0 bottom-0 left-0 h-[4.5em] bg-gradient-to-b" />
                  <div className="bg-primary absolute right-0 bottom-0 left-0 h-[2px]" />
                </motion.div>
              </div>

              {/* the stamp lands */}
              <motion.div
                className="hero-stamp absolute top-[2.5%] right-[3%]"
                initial={false}
                animate={
                  stamped
                    ? { opacity: 1, scale: 1, rotate: -7 }
                    : { opacity: 0, scale: 1.3, rotate: -14 }
                }
                transition={{ duration: reduce ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }}
              >
                <Stamp tone="green" size="md" rotate={0} decorative>
                  Extracted
                </Stamp>
              </motion.div>
            </SpecimenSheet>
          </Ctx.Provider>
        </div>

        <div aria-hidden="true" className="relative z-20 md:mt-20 md:-ml-4">
          <LedgerPanel revealed={revealed} />
        </div>
      </div>

      {!reduce && (
        <button
          type="button"
          onClick={() => {
            if (finished.current) play();
          }}
          className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Replay the scan
        </button>
      )}
    </div>
  );
}

/* ── Static: the finished frame ────────────────────────────────── */

export function StaticSpecimen({ className }: { className?: string }) {
  const ctx = useMemo<SpecCtx>(() => ({ revealed: "all" }), []);
  return (
    <div
      role="img"
      aria-label="A sample invoice beside the ledger of figures read from it, stamped EXTRACTED."
      className={cn("relative", className)}
    >
      <div aria-hidden="true" className="@container w-full max-w-[24rem]">
        <Ctx.Provider value={ctx}>
          <SpecimenSheet>
            <div className="absolute top-[2.5%] right-[3%]" style={{ transform: "rotate(-7deg)" }}>
              <Stamp tone="green" size="md" rotate={0} decorative>
                Extracted
              </Stamp>
            </div>
          </SpecimenSheet>
        </Ctx.Provider>
      </div>
    </div>
  );
}

/* ── Annotated: what gets read ─────────────────────────────────── */

const LEGEND: {
  anchor: FieldId;
  title: string;
  text: string;
  fields: string;
}[] = [
  {
    anchor: "vendor",
    title: "Seller and buyer",
    text: "Names, addresses and contact details for both sides. A company name is added only when a person and a business both appear.",
    fields: "seller, buyer",
  },
  {
    anchor: "due",
    title: "Number and dates",
    text: "Invoice number, issue date, due date and currency, exactly as printed.",
    fields: "invoice_metadata",
  },
  {
    anchor: "lines",
    title: "Line items",
    text: "Every row: description, quantity, unit price, discount, tax and line total.",
    fields: "line_items[]",
  },
  {
    anchor: "total",
    title: "Tax and totals",
    text: "Subtotal, tax, shipping, grand total, amount paid and balance due. If the lines and totals do not add up, the invoice is flagged.",
    fields: "totals",
  },
  {
    anchor: "bank",
    title: "Payment details",
    text: "Terms, method, bank name, account number, IBAN and SWIFT or BIC.",
    fields: "payment_details",
  },
];

interface Pin {
  n: number;
  x: number;
  y: number;
  d: string | null;
}

export function AnnotatedSpecimen() {
  const wrap = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<FieldId, HTMLElement>());
  const [pins, setPins] = useState<Pin[]>([]);
  const ctx = useMemo<SpecCtx>(
    () => ({
      revealed: "all",
      onAnchor: (id, el) => {
        if (el) anchors.current.set(id, el);
        else anchors.current.delete(id);
      },
    }),
    []
  );

  const compute = useCallback(() => {
    const w = wrap.current;
    if (!w) return;
    const sheet = w.querySelector<HTMLElement>("[data-sheet]");
    if (!sheet) return;
    const wr = w.getBoundingClientRect();
    const sr = sheet.getBoundingClientRect();
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const next: Pin[] = [];
    LEGEND.forEach((item, i) => {
      const a = anchors.current.get(item.anchor);
      if (!a) return;
      const ar = a.getBoundingClientRect();
      const x = sr.right - wr.left;
      const y = ar.top + ar.height / 2 - wr.top;
      let d: string | null = null;
      const dot = w.querySelector<HTMLElement>(`[data-legend-dot="${i + 1}"]`);
      if (wide && dot) {
        const lr = dot.getBoundingClientRect();
        const x2 = lr.left - wr.left;
        const y2 = lr.top + lr.height / 2 - wr.top;
        // Stagger the vertical run so leaders never cross each other.
        const base = x + 22;
        const xm = y2 >= y ? base + (LEGEND.length - i) * 8 : base + i * 8;
        d = `M${x + 11} ${y} H${xm} V${y2} H${x2}`;
      }
      next.push({ n: i + 1, x, y, d });
    });
    setPins(next);
  }, []);

  useLayoutEffect(() => {
    compute();
    const ro = new ResizeObserver(compute);
    if (wrap.current) ro.observe(wrap.current);
    window.addEventListener("resize", compute);
    void document.fonts?.ready.then(compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [compute]);

  return (
    <div ref={wrap} className="relative grid gap-10 lg:grid-cols-[26rem_minmax(0,1fr)] lg:items-stretch lg:gap-x-24">
      <div className="@container w-full max-w-[26rem]">
        <Ctx.Provider value={ctx}>
          <SpecimenSheet />
        </Ctx.Provider>
      </div>

      <ol className="flex flex-col gap-6 lg:justify-between lg:py-2">
        {LEGEND.map((item, i) => (
          <li key={item.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
            <span
              data-legend-dot={i + 1}
              className="bg-primary text-primary-foreground figures mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-bold"
            >
              {i + 1}
            </span>
            <div className="max-w-md">
              <h3 className="font-display text-lg leading-snug font-bold">{item.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{item.text}</p>
              <p className="figures text-foreground/70 mt-1.5 text-xs">{item.fields}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* pins on the paper's edge + leader lines (leaders only when wide) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <svg className="absolute inset-0 size-full overflow-visible">
          {pins.map(
            (p) =>
              p.d && (
                <path key={p.n} d={p.d} fill="none" strokeWidth="1.25" className="stroke-primary" />
              )
          )}
        </svg>
        {pins.map((p) => (
          <span
            key={p.n}
            className="bg-primary text-primary-foreground figures absolute flex size-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold"
            style={{ left: p.x, top: p.y }}
          >
            {p.n}
          </span>
        ))}
      </div>
    </div>
  );
}
