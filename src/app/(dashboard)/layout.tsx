import type { Metadata } from "next";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopNav } from "@/components/dashboard/top-nav";
import { ApiErrorBanner } from "@/components/dashboard/api-error-banner";
import { DashboardDataProvider } from "@/lib/dashboard-context";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardDataProvider>
      <a
        href="#main"
        className="bg-card text-foreground focus:border-ring sr-only z-[100] rounded-md border px-3 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopNav />
          <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
              <ApiErrorBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardDataProvider>
  );
}
