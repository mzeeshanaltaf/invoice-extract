"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession } from "@/lib/auth-client";
import { UserMenu } from "@/components/auth/user-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const LINKS = [
  { href: "/#read", label: "What gets read" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const { data: session, isPending } = useSession();

  return (
    <header className="bg-background border-border sticky top-0 z-50 w-full border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-medium lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground hover:text-foreground decoration-primary underline-offset-8 transition-colors hover:underline hover:decoration-2"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isPending ? null : session ? (
            <>
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserMenu />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Start free</Link>
              </Button>
            </>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 gap-0 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="border-border flex h-16 items-center border-b px-4">
                <Logo />
              </div>
              <nav aria-label="Mobile" className="flex flex-col p-2">
                {LINKS.map((l) => (
                  <SheetClose asChild key={l.href}>
                    <Link
                      href={l.href}
                      className="hover:bg-accent flex min-h-12 items-center rounded-md px-3 text-base font-medium"
                    >
                      {l.label}
                    </Link>
                  </SheetClose>
                ))}
                {!isPending && !session && (
                  <SheetClose asChild>
                    <Link
                      href="/sign-in"
                      className="hover:bg-accent flex min-h-12 items-center rounded-md px-3 text-base font-medium"
                    >
                      Sign in
                    </Link>
                  </SheetClose>
                )}
                {!isPending && session && (
                  <SheetClose asChild>
                    <Link
                      href="/dashboard"
                      className="hover:bg-accent flex min-h-12 items-center rounded-md px-3 text-base font-medium"
                    >
                      Dashboard
                    </Link>
                  </SheetClose>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
