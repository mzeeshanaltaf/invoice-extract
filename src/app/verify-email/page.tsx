import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Enter the code we emailed you to finish setting up your account.",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return (
    <AuthShell>
      {/* useSearchParams() opts the form into client-side rendering; without
          this boundary the build errors. */}
      <Suspense>
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  );
}
