import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { callN8nWebhookFormData, N8N_ENDPOINTS } from "@/lib/n8n";
import type { OcrResponse } from "@/lib/types";

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const incomingFormData = await req.formData();
  const file = incomingFormData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, PNG, or JPEG." },
      { status: 400 }
    );
  }

  const n8nFormData = new FormData();
  n8nFormData.append("event_type", "perform_ocr");
  n8nFormData.append("user_id", userId);
  n8nFormData.append("file", file);

  try {
    const result = await callN8nWebhookFormData<OcrResponse>(
      N8N_ENDPOINTS.OCR,
      n8nFormData
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("OCR processing error:", error);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}
