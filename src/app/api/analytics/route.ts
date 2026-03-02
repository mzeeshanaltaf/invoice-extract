import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { callN8nWebhook, N8N_ENDPOINTS } from "@/lib/n8n";
import type { UserAnalytics } from "@/lib/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await callN8nWebhook<UserAnalytics | UserAnalytics[]>(
      N8N_ENDPOINTS.ANALYTICS,
      {
        event_type: "get_analytics_per_user",
        user_id: userId,
      }
    );
    // Handle both array and plain object responses from n8n
    const data = Array.isArray(result) ? result[0] : result;
    return NextResponse.json(data ?? null);
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
