"use client";

import { Tabs as TabsPrimitive } from "radix-ui";

/* One invoice, three export shapes. Field names and column headers are the real ones. */

const JSON_SAMPLE = `{
  "invoice_metadata": {
    "invoice_number": "HB-20417",
    "invoice_date": "2026-10-14",
    "due_date": "2026-11-13",
    "currency": "GBP"
  },
  "seller": { "name": "Halden & Birch Ltd", "company_name": null },
  "buyer": { "name": "Marlow & Co. Accounts" },
  "line_items": [
    { "line_number": 1, "description": "Archive box, A4",
      "quantity": 12, "unit_price": 3.5, "line_total": 42.0 },
    { "line_number": 2, "description": "Ledger book, 192 pp",
      "quantity": 6, "unit_price": 8.25, "line_total": 49.5 }
  ],
  "totals": {
    "subtotal": 193.0, "tax_total": 38.6, "shipping_cost": null,
    "grand_total": 231.6
  }
}`;

const CSV_SAMPLE = `Invoice number,Invoice date,Seller,Grand total,Line,Description,Quantity,Unit price,Line total
HB-20417,2026-10-14,Halden & Birch Ltd,231.6,1,"Archive box, A4",12,3.5,42
HB-20417,2026-10-14,Halden & Birch Ltd,231.6,2,"Ledger book, 192 pp",6,8.25,49.5
HB-20417,2026-10-14,Halden & Birch Ltd,231.6,3,"Copier paper 80gsm, ream",20,4.1,82
HB-20417,2026-10-14,Halden & Birch Ltd,231.6,4,"Stamp ink, red",3,6.5,19.5`;

const SHEET_HEAD = ["Invoice number", "Line", "Description", "Quantity", "Unit price", "Line total"];
const SHEET_ROWS = [
  ["HB-20417", "1", "Archive box, A4", "12", "3.50", "42.00"],
  ["HB-20417", "2", "Ledger book, 192 pp", "6", "8.25", "49.50"],
  ["HB-20417", "3", "Copier paper 80gsm, ream", "20", "4.10", "82.00"],
  ["HB-20417", "4", "Stamp ink, red", "3", "6.50", "19.50"],
];
const NUMERIC = new Set([1, 3, 4, 5]);

const TABS = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Spreadsheet" },
] as const;

function Code({ children }: { children: string }) {
  return (
    <pre tabIndex={0} aria-label="Export sample" className="figures text-band-foreground/90 overflow-x-auto p-4 text-[0.8125rem] leading-relaxed sm:p-5">
      <code>{children}</code>
    </pre>
  );
}

export function DeveloperExports() {
  return (
    <TabsPrimitive.Root defaultValue="json" className="border-band-foreground/20 bg-band-foreground/[0.06] min-w-0 rounded-md border">
      <TabsPrimitive.List
        aria-label="Export format"
        className="border-band-foreground/20 flex gap-1 border-b px-2 pt-2"
      >
        {TABS.map((t) => (
          <TabsPrimitive.Trigger
            key={t.value}
            value={t.value}
            className="text-band-foreground/75 hover:text-band-foreground data-[state=active]:text-band-foreground data-[state=active]:border-primary -mb-px h-10 cursor-pointer rounded-t-sm border-b-2 border-transparent px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            {t.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      <TabsPrimitive.Content value="json">
        <Code>{JSON_SAMPLE}</Code>
      </TabsPrimitive.Content>
      <TabsPrimitive.Content value="csv">
        <Code>{CSV_SAMPLE}</Code>
      </TabsPrimitive.Content>
      <TabsPrimitive.Content value="xlsx">
        <div tabIndex={0} aria-label="Spreadsheet sample" className="overflow-x-auto p-4 sm:p-5">
          <table className="figures text-band-foreground/90 w-full min-w-[34rem] border-collapse text-[0.8125rem]">
            <thead>
              <tr className="text-band-foreground/60">
                <th className="border-band-foreground/20 w-8 border px-2 py-1 font-normal" />
                {["A", "B", "C", "D", "E", "F"].map((c) => (
                  <th key={c} className="border-band-foreground/20 border px-2 py-1 font-normal">
                    {c}
                  </th>
                ))}
              </tr>
              <tr>
                <th scope="row" className="border-band-foreground/20 text-band-foreground/60 border px-2 py-1 text-center font-normal">
                  1
                </th>
                {SHEET_HEAD.map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`border-band-foreground/20 border px-2 py-1 font-semibold ${NUMERIC.has(i) ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SHEET_ROWS.map((row, r) => (
                <tr key={r}>
                  <th scope="row" className="border-band-foreground/20 text-band-foreground/60 border px-2 py-1 text-center font-normal">
                    {r + 2}
                  </th>
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={`border-band-foreground/20 border px-2 py-1 ${NUMERIC.has(i) ? "text-right" : "text-left"}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-band-foreground/70 mt-3 font-sans text-xs">
            Sheet &ldquo;Line items&rdquo;. The workbook also has an &ldquo;Invoices&rdquo; sheet, one row per invoice.
          </p>
        </div>
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  );
}
