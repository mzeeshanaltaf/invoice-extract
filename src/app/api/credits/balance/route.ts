import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { callN8nWebhook, N8N_ENDPOINTS } from "@/lib/n8n";
import type { CreditBalance } from "@/lib/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await callN8nWebhook<CreditBalance[]>(
      N8N_ENDPOINTS.CREDITS,
      {
        event_type: "get_remaining_credit",
        user_id: userId,
      }
    );
    return NextResponse.json(result[0] ?? { current_balance: 0 });
  } catch (error) {
    console.error("Credit balance error:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit balance" },
      { status: 500 }
    );
  }
}
