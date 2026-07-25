"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Receipt, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { OtpField } from "@/components/auth/otp-field";
import { EmailDeliveryNote } from "@/components/auth/email-delivery-note";
import { useCooldown } from "@/components/auth/use-cooldown";

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cooldown = useCooldown(60);

  // A code is always sent by the server before the user gets here (sign-up, or
  // the EMAIL_NOT_VERIFIED sign-in path), so never send on mount — that
  // double-sends and burns the rate limit.
  useEffect(() => {
    if (!email) router.replace("/sign-up");
  }, [email, router]);

  async function handleVerify(code: string) {
    if (code.length !== 6 || verifying) return;
    setError("");
    setNotice("");
    setVerifying(true);

    const { error } = await authClient.emailOtp.verifyEmail({ email, otp: code });

    if (error) {
      setError(error.message || "That code isn't valid. Please try again.");
      setOtp("");
      setVerifying(false);
      return;
    }

    // autoSignInAfterVerification means the session already exists.
    router.push(redirect);
    router.refresh();
  }

  async function handleResend() {
    setError("");
    setNotice("");
    setResending(true);

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });

    setResending(false);
    if (error) {
      setError(error.message || "Could not send a new code. Please try again.");
      return;
    }

    cooldown.start();
    setOtp("");
    setNotice("A new code is on its way.");
  }

  if (!email) return null;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <Link href="/" className="flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">InvoiceExtract</span>
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Verify your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium break-all text-foreground">{email}</span>. It expires in 10
          minutes.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleVerify(otp);
        }}
        className="flex flex-col gap-4"
      >
        <OtpField
          value={otp}
          onChange={setOtp}
          onComplete={(code) => void handleVerify(code)}
          disabled={verifying}
          autoFocus
        />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

        <Button type="submit" className="w-full" disabled={verifying || otp.length !== 6}>
          {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify email
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={handleResend}
          disabled={resending || cooldown.active || verifying}
        >
          {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {cooldown.active ? `Resend code in ${cooldown.remaining}s` : "Resend code"}
        </Button>
      </form>

      <div className="mt-6">
        <EmailDeliveryNote />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Wrong email?{" "}
        <Link href="/sign-up" className="font-medium text-foreground hover:underline">
          Start over
        </Link>
      </p>
    </div>
  );
}
