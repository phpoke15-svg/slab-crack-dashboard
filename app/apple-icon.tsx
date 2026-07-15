import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0e14",
          borderRadius: 36,
          fontSize: 72,
          fontWeight: 800,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <span style={{ color: "#f4f7fb" }}>C</span>
        <span style={{ color: "#4ade80" }}>T</span>
      </div>
    ),
    { ...size },
  )
}
