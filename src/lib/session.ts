import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Returns the authenticated user's id, or null if there is no valid session.
 * This id is the sole key used by the n8n backend (forwarded as `user_id`).
 */
export async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}
