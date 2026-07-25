"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Countdown for the "Resend code" button. Mirrors the server's 3-per-60s limit
 * on the emailOTP plugin, so users see a friendly timer instead of an opaque
 * rate-limit error.
 */
export function useCooldown(seconds = 60) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  return {
    remaining,
    active: remaining > 0,
    start: useCallback(() => setRemaining(seconds), [seconds]),
  };
}
