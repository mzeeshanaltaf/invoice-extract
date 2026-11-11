"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { useDashboardData } from "@/lib/dashboard-context";

function titleFor(pathname: string) {
  if (pathname.startsWith("/dashboard/documents/")) return "Document";
  if (pathname.startsWith("/dashboard/documents")) return "Documents";
  if (pathname.startsWith("/dashboard/upload")) return "Upload";
  if (pathname.startsWith("/dashboard/credits")) return "Credits";
  if (pathname.startsWith("/dashboard/settings")) return "Settings";
  return "Overview";
}

/** Compact balance for narrow screens, where the sidebar is closed. */
function CreditChip() {
  const { credits, isLoading } = useDashboardData();
  if (isLoading) return null;
  return (
    <Link
      href="/dashboard/credits"
      className="border-border bg-card figures hover:bg-accent inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium md:hidden"
    >
      {credits.available}{" "}
      <span className="text-muted-foreground font-sans text-xs">credits</span>
    </Link>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-border bg-background flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2 md:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 gap-0 p-0">
            <SheetTitle className="sr-only">Dashboard menu</SheetTitle>
            <Sidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <Logo href="/dashboard" className="md:hidden" textClassName="hidden min-[400px]:inline" />
        <span className="text-muted-foreground hidden truncate text-sm font-medium md:inline">
          {titleFor(pathname)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <CreditChip />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
