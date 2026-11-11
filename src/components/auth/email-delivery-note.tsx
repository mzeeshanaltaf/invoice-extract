import { OTP_SENDER_EMAIL } from "@/lib/otp-sender";

/**
 * Persistent on-screen note rather than a transient message: the user has
 * usually switched to their mail client by the time a toast would disappear.
 * Naming the sender matters — people search their spam folder by address.
 */
export function EmailDeliveryNote() {
  return (
    <p className="rounded-md border border-border bg-muted px-3 py-2.5 text-xs text-muted-foreground">
      Can&apos;t find the email? Check your spam or junk folder. It arrives from{" "}
      <span className="font-medium break-all text-foreground">{OTP_SENDER_EMAIL}</span>.
    </p>
  );
}
