import { ImageResponse } from "next/og";

export const alt = "InvoiceExtract — AI-Powered Invoice Data Extraction";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f172a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.35)",
            borderRadius: "100px",
            padding: "10px 20px",
            marginBottom: "36px",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#818cf8",
            }}
          />
          <span
            style={{
              color: "#a5b4fc",
              fontSize: "20px",
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            AI-Powered Invoice Extraction
          </span>
        </div>

        <div
          style={{
            fontSize: "84px",
            fontWeight: 800,
            color: "#f8fafc",
            lineHeight: 1.05,
            marginBottom: "28px",
            letterSpacing: "-2px",
          }}
        >
          InvoiceExtract
        </div>

        <div
          style={{
            fontSize: "30px",
            color: "#94a3b8",
            lineHeight: 1.5,
            maxWidth: "680px",
            marginBottom: "60px",
          }}
        >
          Upload PDFs or images. Get structured data instantly.
        </div>

        <div
          style={{
            fontSize: "22px",
            color: "#475569",
            letterSpacing: "0.01em",
          }}
        >
          invoicextract.zeeshanai.cloud
        </div>

        <div
          style={{
            position: "absolute",
            right: "80px",
            bottom: "60px",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: "90px" }}>📄</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
