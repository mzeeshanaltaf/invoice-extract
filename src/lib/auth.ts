import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, jwt } from "better-auth/plugins";
import { Pool } from "pg";
import { sendOtpEmail } from "@/lib/email";

/**
 * Postgres pool for Better Auth.
 *
 * All Better Auth tables (user/session/account/verification) live in the
 * `invoice_extract` schema. We pin the connection's search_path so both the
 * migration CLI and the runtime resolve unqualified table names to that schema.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: "-c search_path=invoice_extract",
});

export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
    // Sign-up creates the account but issues NO session until the emailed code
    // is entered. Existing accounts with emailVerified = false hit this on their
    // next sign-in and get walked through the same flow (no backfill needed).
    // Google accounts arrive pre-verified and are unaffected.
    requireEmailVerification: true,
  },
  emailVerification: {
    // An unverified sign-in attempt gets a fresh code, so there's always one
    // waiting when the client redirects to /verify-email.
    sendOnSignIn: true,
    // Verifying the code issues the session, so the user lands on the dashboard
    // instead of being bounced back to sign in.
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  user: {
    // Account deletion: the Settings screen first calls DELETE /v1/account on the
    // API (documents, files, credits), then authClient.deleteUser() removes the
    // Better Auth user. Signup credits are no longer granted here: the API grants
    // them on a user's first authenticated request.
    deleteUser: { enabled: true },
  },
  plugins: [
    emailOTP({
      // Replaces Better Auth's link-based verification email with the OTP
      // sender, so sign-up and unverified sign-in both emit a 6-digit code.
      overrideDefaultEmailVerification: true,
      // The plugin mounts POST /sign-in/email-otp whether or not we build UI for
      // it. Left open, an unknown email hitting it would get a new, nameless,
      // passwordless account. We don't offer passwordless sign-in.
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 600, // 10 minutes — keep in sync with EXPIRY_MINUTES in email.ts
      allowedAttempts: 3,
      storeOTP: "hashed", // a DB leak shouldn't hand over live codes
      rateLimit: { window: 60, max: 3 },
      sendVerificationOTP: async ({ email, otp, type }) => {
        // Only the flows we actually expose, so an unused endpoint can't quietly
        // mail our users.
        if (type !== "email-verification" && type !== "forget-password") return;
        await sendOtpEmail(email, otp, type);
      },
    }),
    // Issues the short-lived JWT the browser sends to the FastAPI service
    // (GET /api/auth/token, keys at /api/auth/jwks). With issuer/audience left
    // unset both default to BETTER_AUTH_URL, which is exactly what the API's
    // verifier requires. The payload is cut down to `sub` (added by the plugin)
    // so no name or email travels in the token.
    jwt({
      jwt: {
        definePayload: () => ({}),
      },
    }),
    // nextCookies() must stay last.
    nextCookies(),
  ],
});
