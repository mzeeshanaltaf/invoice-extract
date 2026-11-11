"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  FileStack,
  HelpCircle,
  LayoutDashboard,
  Settings,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/lib/dashboard-context";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/upload", label: "Upload", icon: Upload },
  { href: "/dashboard/documents", label: "Documents", icon: FileStack },
  { href: "/dashboard/credits", label: "Credits", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/** Always-visible balance: available credits, with what in-flight documents hold. */
function CreditBalance({ onNavigate }: { onNavigate?: () => void }) {
  const { credits, isLoading } = useDashboardData();
  return (
    <Link
      href="/dashboard/credits"
      onClick={onNavigate}
      className="border-sidebar-border bg-card hover:bg-sidebar-accent block rounded-md border p-3 transition-colors duration-150"
    >
      <p className="eyebrow">Credits available</p>
      {isLoading ? (
        <Skeleton className="mt-2 h-8 w-12" />
      ) : (
        <p className="figures mt-1 text-3xl leading-tight font-medium">{credits.available}</p>
      )}
      <p className="text-muted-foreground mt-1 text-xs">
        {isLoading
          ? " "
          : credits.held > 0
            ? `${credits.held} held by documents in progress`
            : credits.available === 0
              ? "None left. Uploads are paused."
              : "1 credit reads 1 page"}
      </p>
    </Link>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground flex h-full w-60 flex-col border-r">
      <div className="flex h-14 items-center px-4">
        <Logo href="/dashboard" />
      </div>

      <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard" ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-md border px-3 text-sm font-medium transition-colors duration-150",
                    active
                      ? "border-sidebar-border bg-sidebar-accent text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground border-transparent"
                  )}
                >
                  <Icon className={cn("size-4", active && "text-primary")} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 p-3">
        <CreditBalance onNavigate={onNavigate} />
        <Link
          href="/contact"
          onClick={onNavigate}
          className="text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150"
        >
          <HelpCircle className="size-4" aria-hidden="true" />
          Help and support
        </Link>
      </div>
    </aside>
  );
}
