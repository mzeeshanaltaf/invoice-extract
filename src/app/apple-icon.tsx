import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: "36px",
          fontFamily: "sans-serif",
        }}
      >
        <span
          style={{
            color: "#a5b4fc",
            fontSize: "80px",
            fontWeight: 800,
            letterSpacing: "-2px",
          }}
        >
          IE
        </span>
      </div>
    ),
    { ...size }
  );
}
