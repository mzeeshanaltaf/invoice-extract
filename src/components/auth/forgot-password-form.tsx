"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpField } from "@/components/auth/otp-field";
import { EmailDeliveryNote } from "@/components/auth/email-delivery-note";
import { useCooldown } from "@/components/auth/use-cooldown";

/**
 * One route, two steps. Keeping the reset step here means no second page needs
 * the email in its URL.
 */
export function ForgotPasswordForm() {
  const router = useRouter();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cooldown = useCooldown(60);

  /**
   * Always resolves successfully for addresses with no account (and sends
   * nothing), so the copy below stays deliberately neutral — anything more
   * specific would leak which emails are registered.
   */
  async function requestCode() {
    const { error } = await authClient.emailOtp.requestPasswordReset({
      email: email.trim(),
    });
    if (error) {
      setError(error.message || "Could not send a code. Please try again.");
      return false;
    }
    return true;
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    const ok = await requestCode();
    setSubmitting(false);
    if (!ok) return;

    cooldown.start();
    setStep("reset");
    setNotice("If an account exists for that email, we sent a code.");
  }

  async function handleResend() {
    setError("");
    setNotice("");
    setResending(true);

    const ok = await requestCode();
    setResending(false);
    if (!ok) return;

    cooldown.start();
    setOtp("");
    setNotice("A new code is on its way.");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { error } = await authClient.emailOtp.resetPassword({
      email: email.trim(),
      otp,
      password,
    });

    if (error) {
      setError(error.message || "Could not reset your password. Please try again.");
      setSubmitting(false);
      return;
    }

    // resetPassword creates no session, so send them through sign-in.
    router.push("/sign-in?reset=1");
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight">
          {step === "request" ? "Reset your password" : "Choose a new password"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {step === "request" ? (
            "Enter your email and we'll send you a 6-digit code."
          ) : (
            <>
              Enter the code we sent to{" "}
              <span className="font-medium break-all text-foreground">{email.trim()}</span> and pick
              a new password.
            </>
          )}
        </p>
      </div>

      {step === "request" ? (
        <form onSubmit={handleRequest} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {error && (<p role="alert" className="text-sm text-destructive">{error}</p>)}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <OtpField value={otp} onChange={setOtp} disabled={submitting} autoFocus />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {error && (<p role="alert" className="text-sm text-destructive">{error}</p>)}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset password
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleResend}
            disabled={resending || cooldown.active || submitting}
          >
            {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {cooldown.active ? `Resend code in ${cooldown.remaining}s` : "Resend code"}
          </Button>
        </form>
      )}

      {step === "reset" && (
        <div className="mt-6">
          <EmailDeliveryNote />
        </div>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
