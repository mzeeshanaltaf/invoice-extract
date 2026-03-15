import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { callN8nWebhook, N8N_ENDPOINTS } from "@/lib/n8n";
import type { UserDataResponse } from "@/lib/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await callN8nWebhook<UserDataResponse[]>(
      N8N_ENDPOINTS.DOCUMENTS,
      {
        event_type: "get_user_data",
        user_id: userId,
      }
    );
    return NextResponse.json(result[0] ?? null);
  } catch (error) {
    console.error("User data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
