/**
 * The address auth OTP emails are sent from.
 *
 * Client-safe on purpose: the verify-email / forgot-password screens name the
 * sender in their "check your spam folder" note, and `src/lib/email.ts` uses it
 * as the fallback `from`, so the copy and the real sender can never drift.
 */
export const OTP_SENDER_EMAIL = "noreply@verification.zeeshanai.cloud";
