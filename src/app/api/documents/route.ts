import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { callN8nWebhook, N8N_ENDPOINTS } from "@/lib/n8n";
import type { UserDocument } from "@/lib/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await callN8nWebhook<UserDocument[]>(
      N8N_ENDPOINTS.DOCUMENTS,
      {
        event_type: "get_user_documents",
        user_id: userId,
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
