"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Receipt, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const isSignUp = mode === "sign-up";
  // Set by the forgot-password flow, which finishes without a session.
  const justReset = !isSignUp && searchParams.get("reset") === "1";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: redirect,
    });
    if (error) {
      setError(error.message || "Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  }

  function verifyUrl() {
    return `/verify-email?email=${encodeURIComponent(email.trim())}&redirect=${encodeURIComponent(redirect)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { error } = isSignUp
      ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
      : await authClient.signIn.email({ email: email.trim(), password });

    if (error) {
      // The account exists but isn't verified. The server already sent a fresh
      // code (emailVerification.sendOnSignIn), so hand off to the verify screen
      // instead of showing an error the user can't act on.
      if (error.code === "EMAIL_NOT_VERIFIED") {
        router.push(verifyUrl());
        return;
      }
      setError(error.message || "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    if (isSignUp) {
      // requireEmailVerification means sign-up issues no session.
      router.push(verifyUrl());
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <Link href="/" className="flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">InvoiceExtract</span>
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSignUp
            ? "Start extracting invoice data — 5 free credits on signup."
            : "Sign in to continue to your dashboard."}
        </p>
      </div>

      {justReset && (
        <p className="mb-5 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-center text-sm text-muted-foreground">
          Password updated. Sign in with your new password.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={handleGoogle}
        disabled={googleLoading || submitting}
      >
        {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </Button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
        )}
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
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {!isSignUp && (
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <Input
            id="password"
            type="password"
            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting || googleLoading}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-foreground hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="font-medium text-foreground hover:underline">
              Sign up
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
