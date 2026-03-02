import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { callN8nWebhook, N8N_ENDPOINTS } from "@/lib/n8n";
import type { MarkdownInvoiceResponse } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await params;

  try {
    const result = await callN8nWebhook<MarkdownInvoiceResponse[]>(
      N8N_ENDPOINTS.DOCUMENTS,
      {
        event_type: "get_markdown_invoice_object",
        user_id: userId,
        file_id: fileId,
      }
    );
    return NextResponse.json(result[0] ?? null);
  } catch (error) {
    console.error("Document detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}
