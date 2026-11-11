import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { StaticSpecimen } from "@/components/brand/invoice-specimen";

/**
 * Split layout for every auth screen: the form on paper at the left, a quiet
 * ledger specimen at the right (hidden below lg). Server component; the forms
 * stay client components inside it.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:min-h-0">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-sm lg:mx-0 lg:ml-[clamp(0rem,6vw,6rem)]">{children}</div>
        </div>
      </div>

      <aside
        aria-hidden="true"
        className="bg-sidebar border-sidebar-border ledger-lines relative hidden flex-col items-center justify-center gap-6 border-l p-12 lg:flex"
      >
        <StaticSpecimen className="w-full max-w-sm" />
        <p className="text-muted-foreground max-w-xs text-center text-sm">
          A sample invoice from a made-up supplier, read and checked.
        </p>
      </aside>
    </main>
  );
}
