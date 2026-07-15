import { ImageResponse } from "next/og"

export const runtime = "edge"

const size = 512

export async function GET() {
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
          borderRadius: 96,
          fontSize: 200,
          fontWeight: 800,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <span style={{ color: "#f4f7fb" }}>C</span>
        <span style={{ color: "#4ade80" }}>T</span>
      </div>
    ),
    { width: size, height: size },
  )
}
