import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { callN8nWebhook, N8N_ENDPOINTS } from "@/lib/n8n";
import type { SignupCreditsResponse } from "@/lib/types";

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
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Grant signup credits via the n8n backend, keyed on the new user id.
          // Replaces the former Clerk `user.created` webhook flow.
          try {
            await callN8nWebhook<SignupCreditsResponse>(N8N_ENDPOINTS.CREDITS, {
              event_type: "signup_credits",
              user_id: user.id,
            });
            console.log("Signup credits assigned for user:", user.id);
          } catch (error) {
            console.error("Failed to assign signup credits:", error);
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});
