import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the InvoicExtract team: questions, feedback, or support.",
};

// Short error codes set by the API route's redirect (?error=...) mapped to
// human-readable copy. Keep keys in sync with the route handler's fail() calls.
const ERROR_MESSAGES: Record<string, string> = {
  fields: "Please fill in all fields.",
  email: "Please enter a valid email address.",
  length: "Message must be 5000 characters or fewer.",
  rate: "Too many submissions. Please try again later.",
  server: "Service is temporarily unavailable. Please try again later.",
  parse: "Invalid submission. Please try again.",
};

type Props = {
  searchParams: Promise<{ sent?: string; error?: string }>;
};

export default async function ContactPage({ searchParams }: Props) {
  const { sent, error } = await searchParams;
  const initialError = error
    ? ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."
    : undefined;

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
      <div>
        <p className="eyebrow">Contact</p>
        <h1 className="font-display mt-3 text-4xl leading-[1.04] font-extrabold tracking-[-0.02em] md:text-5xl">
          Write to us.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-md text-lg leading-relaxed">
          A question about a figure, a feature you need, a problem with a file: send it here and a
          person reads it.
        </p>
        <p className="text-muted-foreground mt-4 max-w-md leading-relaxed">
          If it is about a specific document, include its file name so we can find it.
        </p>
      </div>

      <div className="paper-sheet border-border/60 rounded-md border p-6 sm:p-8">
        <ContactForm initialSuccess={!!sent} initialError={initialError} />
      </div>
    </div>
  );
}
