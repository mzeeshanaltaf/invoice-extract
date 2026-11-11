import { cn } from "@/lib/utils";

/** Title block shared by every dashboard page. The only place a display face appears in the app. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-5",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1.5 max-w-prose text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small section label with a ruled underline. */
export function SectionLabel({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="border-border mb-2 flex items-baseline justify-between gap-4 border-b-2 pb-2">
      <h2 className="text-sm font-bold">{children}</h2>
      {aside && <div className="text-muted-foreground text-xs">{aside}</div>}
    </div>
  );
}
