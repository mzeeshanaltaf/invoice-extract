import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { callN8nWebhook, N8N_ENDPOINTS } from "@/lib/n8n";
import type { CreditTransaction } from "@/lib/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await callN8nWebhook<CreditTransaction[]>(
      N8N_ENDPOINTS.CREDITS,
      {
        event_type: "credit_history",
        user_id: userId,
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Credit history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit history" },
      { status: 500 }
    );
  }
}
