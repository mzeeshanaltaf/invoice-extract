import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f172a",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
          fontFamily: "sans-serif",
        }}
      >
        <span
          style={{
            color: "#a5b4fc",
            fontSize: "16px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
          }}
        >
          IE
        </span>
      </div>
    ),
    { ...size }
  );
}
