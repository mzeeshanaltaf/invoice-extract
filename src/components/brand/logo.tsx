import Link from "next/link";
import { cn } from "@/lib/utils";

/** The mark: a ruled page with a stamped box on its last line. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
    >
      <rect x="3" y="2.5" width="18" height="19" rx="2" className="stroke-foreground" strokeWidth="1.6" />
      <path d="M7 8h10M7 12h10" className="stroke-foreground" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="12.2" y="14.2" width="5.4" height="3.6" rx="0.6" className="stroke-primary" strokeWidth="1.6" />
      <path d="M7 16h2.6" className="stroke-foreground" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  href = "/",
  className,
  textClassName,
}: {
  href?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const inner = (
    <>
      <LogoMark />
      <span
        className={cn(
          "font-display text-lg font-bold leading-none tracking-tight",
          textClassName
        )}
      >
        InvoicExtract
      </span>
    </>
  );
  if (href === null) {
    return <span className={cn("inline-flex items-center gap-2", className)}>{inner}</span>;
  }
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)} aria-label="InvoicExtract home">
      {inner}
    </Link>
  );
}
