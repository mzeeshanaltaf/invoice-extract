"use client";

import { useEffect, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  InvoiceData,
  InvoiceLineItem,
  InvoiceParty,
  InvoiceTotals,
} from "@/lib/types";

/*
 * The extracted invoice as an editable ledger. Fields look like printed lines
 * until hovered or focused. Fields named by a warning wear a "Check" mark.
 * Empty inputs become null ("not on the document"); 0 stays 0.
 */

const ledgerInput =
  "h-9 w-full min-w-0 rounded-sm border border-transparent border-b-border bg-transparent px-1.5 text-sm transition-colors duration-150 placeholder:italic placeholder:text-muted-foreground hover:border-input hover:bg-card focus-visible:border-ring focus-visible:bg-card focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring data-[flag=true]:border-warning data-[flag=true]:bg-warning-soft disabled:opacity-60";

function parseNumber(text: string): number | null | undefined {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  // undefined = not a number yet (e.g. "-" or "1e"): keep typing, don't commit.
  return Number.isFinite(n) ? n : undefined;
}

type FlagFn = (path: string) => boolean;

function Field({
  label,
  htmlFor,
  flagged,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  flagged?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-muted-foreground text-xs font-medium">
          {label}
        </Label>
        {flagged && (
          <span className="text-warning text-[0.6875rem] font-bold tracking-wide uppercase">Check</span>
        )}
      </div>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  className,
  flagged,
  placeholder = "Not on document",
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  className?: string;
  flagged?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} flagged={flagged} className={className}>
      <input
        id={id}
        data-flag={flagged || undefined}
        placeholder={placeholder}
        className={ledgerInput}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      />
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
  className,
  flagged,
  placeholder = "Not on document",
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
  flagged?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value == null ? "" : String(value));

  // Re-sync when the value changes from outside (e.g. reset), but never while
  // the text still parses to the current value (that would eat "12." mid-typing).
  useEffect(() => {
    if (parseNumber(text) !== value) setText(value == null ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Field label={label} htmlFor={id} flagged={flagged} className={className}>
      <input
        id={id}
        data-flag={flagged || undefined}
        inputMode="decimal"
        placeholder={placeholder}
        className={cn(ledgerInput, "figures text-right")}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseNumber(e.target.value);
          if (n !== undefined) onChange(n);
        }}
      />
    </Field>
  );
}

function Section({
  title,
  flagged,
  action,
  children,
}: {
  title: string;
  flagged?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border border-t px-4 py-5 first:border-t-0 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-baseline gap-2 text-sm font-bold">
          {title}
          {flagged && (
            <span className="text-warning text-[0.6875rem] font-bold tracking-wide uppercase">Check</span>
          )}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function PartyFields({
  prefix,
  party,
  onChange,
  flag,
}: {
  prefix: "seller" | "buyer";
  party: InvoiceParty;
  onChange: (p: InvoiceParty) => void;
  flag: FlagFn;
}) {
  const set = <K extends keyof InvoiceParty>(k: K, v: InvoiceParty[K]) =>
    onChange({ ...party, [k]: v });
  const addr = party.address;
  const contact = party.contact;
  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      <TextField label="Name" value={party.name} onChange={(v) => set("name", v)} flagged={flag(`${prefix}.name`)} />
      <TextField label="Company name" value={party.company_name} onChange={(v) => set("company_name", v)} />
      <TextField
        label="Street"
        className="sm:col-span-2"
        value={addr.street}
        onChange={(v) => set("address", { ...addr, street: v })}
      />
      <TextField label="City" value={addr.city} onChange={(v) => set("address", { ...addr, city: v })} />
      <TextField label="State" value={addr.state} onChange={(v) => set("address", { ...addr, state: v })} />
      <TextField
        label="Postal code"
        value={addr.postal_code}
        onChange={(v) => set("address", { ...addr, postal_code: v })}
      />
      <TextField label="Country" value={addr.country} onChange={(v) => set("address", { ...addr, country: v })} />
      <TextField label="Email" value={contact.email} onChange={(v) => set("contact", { ...contact, email: v })} />
      <TextField label="Phone" value={contact.phone} onChange={(v) => set("contact", { ...contact, phone: v })} />
      <TextField
        label="Website"
        className="sm:col-span-2"
        value={contact.website}
        onChange={(v) => set("contact", { ...contact, website: v })}
      />
    </div>
  );
}

const TOTAL_FIELDS: { key: keyof InvoiceTotals; label: string }[] = [
  { key: "subtotal", label: "Subtotal" },
  { key: "discount_total", label: "Discount total" },
  { key: "tax_total", label: "Tax total" },
  { key: "shipping_cost", label: "Shipping" },
  { key: "other_charges", label: "Other charges" },
  { key: "grand_total", label: "Grand total" },
  { key: "amount_paid", label: "Amount paid" },
  { key: "balance_due", label: "Balance due" },
];

const EMPTY_LINE: InvoiceLineItem = {
  line_number: null,
  item_code: null,
  description: null,
  quantity: null,
  unit_of_measure: null,
  unit_price: null,
  discount: null,
  tax_rate: null,
  tax_amount: null,
  line_total: null,
};

export function InvoiceLedger({
  value,
  onChange,
  flaggedPaths,
}: {
  value: InvoiceData;
  onChange: (next: InvoiceData) => void;
  /** Dotted field paths named by the API's warnings (e.g. "totals.subtotal"). */
  flaggedPaths: ReadonlySet<string>;
}) {
  const meta = value.invoice_metadata;
  const pay = value.payment_details;
  const bank = pay.bank_details;
  const notesId = useId();
  const flag: FlagFn = (path) => flaggedPaths.has(path);
  const linesFlagged = flag("line_items");

  const setLine = (i: number, patch: Partial<InvoiceLineItem>) =>
    onChange({
      ...value,
      line_items: value.line_items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    });

  const setMeta = (patch: Partial<typeof meta>) =>
    onChange({ ...value, invoice_metadata: { ...meta, ...patch } });

  const setPay = (patch: Partial<typeof pay>) =>
    onChange({ ...value, payment_details: { ...pay, ...patch } });

  const setBank = (patch: Partial<typeof bank>) =>
    setPay({ bank_details: { ...bank, ...patch } });

  return (
    <div className="paper-sheet border-border/70 rounded-md border">
      <Section title="Invoice">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <TextField
            label="Invoice number"
            value={meta.invoice_number}
            onChange={(v) => setMeta({ invoice_number: v })}
            flagged={flag("invoice_metadata.invoice_number")}
          />
          <TextField
            label="Invoice date"
            value={meta.invoice_date}
            onChange={(v) => setMeta({ invoice_date: v })}
            flagged={flag("invoice_metadata.invoice_date")}
          />
          <TextField
            label="Due date"
            value={meta.due_date}
            onChange={(v) => setMeta({ due_date: v })}
            flagged={flag("invoice_metadata.due_date")}
          />
          <TextField label="Currency" value={meta.currency} onChange={(v) => setMeta({ currency: v })} />
        </div>
      </Section>

      <Section title="Seller">
        <PartyFields prefix="seller" party={value.seller} onChange={(p) => onChange({ ...value, seller: p })} flag={flag} />
      </Section>

      <Section title="Buyer">
        <PartyFields prefix="buyer" party={value.buyer} onChange={(p) => onChange({ ...value, buyer: p })} flag={flag} />
      </Section>

      <Section
        title="Line items"
        flagged={linesFlagged}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              onChange({
                ...value,
                line_items: [
                  ...value.line_items,
                  { ...EMPTY_LINE, line_number: value.line_items.length + 1 },
                ],
              })
            }
          >
            <Plus /> Add line
          </Button>
        }
      >
        {value.line_items.length === 0 && (
          <p className="text-muted-foreground text-sm">No line items were found on this invoice.</p>
        )}
        <ol className="divide-border divide-y">
          {value.line_items.map((line, i) => (
            <li key={i} className="py-3 first:pt-0 last:pb-0">
              <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_2.25rem] items-end gap-x-3 gap-y-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_5rem_6.5rem_6.5rem_2.25rem]">
                <span className="figures text-muted-foreground pb-2 text-xs">{line.line_number ?? i + 1}</span>
                <TextField
                  label="Description"
                  value={line.description}
                  onChange={(v) => setLine(i, { description: v })}
                />
                <div className="col-start-3 row-start-1 flex justify-end sm:col-start-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={`Remove line ${line.line_number ?? i + 1}`}
                    onClick={() =>
                      onChange({
                        ...value,
                        line_items: value.line_items.filter((_, idx) => idx !== i),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="col-span-3 grid grid-cols-3 gap-x-3 sm:col-span-3 sm:col-start-3 sm:row-start-1 sm:grid-cols-[5rem_6.5rem_6.5rem]">
                  <NumberField label="Qty" value={line.quantity} onChange={(v) => setLine(i, { quantity: v })} />
                  <NumberField label="Unit price" value={line.unit_price} onChange={(v) => setLine(i, { unit_price: v })} />
                  <NumberField
                    label="Line total"
                    value={line.line_total}
                    onChange={(v) => setLine(i, { line_total: v })}
                    flagged={linesFlagged}
                  />
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 pl-0 sm:grid-cols-5 sm:pl-[2.25rem]">
                <TextField label="Item code" value={line.item_code} placeholder="none" onChange={(v) => setLine(i, { item_code: v })} />
                <TextField label="Unit" value={line.unit_of_measure} placeholder="none" onChange={(v) => setLine(i, { unit_of_measure: v })} />
                <NumberField label="Discount" value={line.discount} placeholder="none" onChange={(v) => setLine(i, { discount: v })} />
                <NumberField label="Tax rate" value={line.tax_rate} placeholder="none" onChange={(v) => setLine(i, { tax_rate: v })} />
                <NumberField label="Tax amount" value={line.tax_amount} placeholder="none" onChange={(v) => setLine(i, { tax_amount: v })} />
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Totals">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {TOTAL_FIELDS.map(({ key, label }) => (
            <NumberField
              key={key}
              label={label}
              value={value.totals[key]}
              flagged={flag(`totals.${key}`)}
              onChange={(v) => onChange({ ...value, totals: { ...value.totals, [key]: v } })}
            />
          ))}
        </div>
      </Section>

      <Section title="Payment details">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <TextField label="Payment terms" value={pay.payment_terms} onChange={(v) => setPay({ payment_terms: v })} />
          <TextField label="Payment method" value={pay.payment_method} onChange={(v) => setPay({ payment_method: v })} />
          <TextField label="Bank name" value={bank.bank_name} onChange={(v) => setBank({ bank_name: v })} />
          <TextField label="Account number" value={bank.account_number} onChange={(v) => setBank({ account_number: v })} />
          <TextField label="IBAN" value={bank.iban} onChange={(v) => setBank({ iban: v })} />
          <TextField label="SWIFT/BIC" value={bank.swift_bic} onChange={(v) => setBank({ swift_bic: v })} />
        </div>
      </Section>

      <Section title="Notes">
        <Label htmlFor={notesId} className="sr-only">
          Notes
        </Label>
        <textarea
          id={notesId}
          rows={2}
          placeholder="Not on document"
          className={cn(ledgerInput, "h-auto min-h-16 resize-y py-1.5")}
          value={value.notes ?? ""}
          onChange={(e) => onChange({ ...value, notes: e.target.value === "" ? null : e.target.value })}
        />
      </Section>
    </div>
  );
}
