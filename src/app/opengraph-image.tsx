import { ImageResponse } from "next/og";
import { OgCard } from "@/lib/og-card";

export const alt = "InvoicExtract: invoices in, figures out";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgCard />, { ...size });
}
