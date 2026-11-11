import { Plus } from "lucide-react";

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What counts as an invoice?",
    a: "Supplier invoices and bills as a PDF, PNG or JPEG. Before anything is read, each file is checked. Menus, photos, letters and other non-invoices are sent back and use no credits, and neither does a page that is too blurry to read.",
  },
  {
    q: "What does a credit pay for?",
    a: "One credit reads one page. A new account starts with five. Credits are only spent when a document is read successfully: rejected, duplicate and failed files cost nothing.",
  },
  {
    q: "What if a figure is wrong?",
    a: "Click it and type the right one. Your edit is saved alongside the original extraction, so you can reset to what was read at any time. If the line items and totals do not add up, the invoice is flagged and the fields are marked.",
  },
  {
    q: "What happens to my original files?",
    a: "You choose: keep them, or delete them after 7, 30 or 90 days. Only the original PDF or image is removed; the extracted data stays until you delete the document or your account. You can delete either at any time.",
  },
  {
    q: "Who reads my documents?",
    a: "Pages are sent to OpenAI's API to be read. The privacy policy covers what is sent, what we keep, and for how long.",
  },
  {
    q: "Can I forward invoices by email?",
    a: "Yes. Each account can turn on a private address; attachments sent to it are checked and read like uploads. You can switch it off or replace the address whenever you like.",
  },
];

/** Native <details>: keyboard and screen-reader friendly with no script. */
export function Faq() {
  return (
    <div className="border-border divide-border divide-y border-y">
      {FAQ.map(({ q, a }) => (
        <details key={q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-semibold marker:hidden [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2">
            {q}
            <Plus
              aria-hidden="true"
              className="text-primary size-5 shrink-0 transition-transform duration-200 ease-out group-open:rotate-45"
            />
          </summary>
          <p className="text-muted-foreground max-w-2xl pb-5 leading-relaxed">{a}</p>
        </details>
      ))}
    </div>
  );
}
