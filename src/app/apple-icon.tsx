import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#c83314",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "30px",
          fontFamily: "sans-serif",
        }}
      >
        <span
          style={{
            color: "#fdfaf3",
            fontSize: "92px",
            fontWeight: 800,
            letterSpacing: "-3px",
          }}
        >
          IE
        </span>
      </div>
    ),
    { ...size }
  );
}
