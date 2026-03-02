"use client";

import { UserButton } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

interface TopNavProps {
  breadcrumb?: string;
}

export function TopNav({ breadcrumb = "Dashboard" }: TopNavProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4">
      {/* Mobile sidebar trigger */}
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Breadcrumb */}
        <span className="text-sm font-medium text-muted-foreground">
          {breadcrumb}
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserButton />
      </div>
    </header>
  );
}
