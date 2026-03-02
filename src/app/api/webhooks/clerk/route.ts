import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { callN8nWebhook, N8N_ENDPOINTS } from "@/lib/n8n";
import type { SignupCreditsResponse } from "@/lib/types";

export async function POST(req: Request) {
  const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!CLERK_WEBHOOK_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SECRET env variable.");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(CLERK_WEBHOOK_SECRET);
  let event: WebhookEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const eventType = event.type;

  if (eventType === "user.created") {
    const userId = event.data.id;
    try {
      await callN8nWebhook<SignupCreditsResponse>(N8N_ENDPOINTS.CREDITS, {
        event_type: "signup_credits",
        user_id: userId,
      });
      console.log("Signup credits assigned for user:", userId);
    } catch (error) {
      console.error("Failed to assign signup credits:", error);
      return new Response("Failed to process webhook", { status: 500 });
    }
  }

  if (eventType === "user.deleted") {
    console.log("User deleted:", event.data.id);
  }

  return new Response("OK", { status: 200 });
}
