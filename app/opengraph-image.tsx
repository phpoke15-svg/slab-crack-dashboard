import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "CollecTools — Pokémon TCG collector toolkit"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(145deg, #0b0e14 0%, #121a24 45%, #0d2818 100%)",
          color: "#f4f7fb",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#0b0e14",
              border: "1px solid rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            <span style={{ color: "#f4f7fb" }}>C</span>
            <span style={{ color: "#3ecf8e" }}>T</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1.5 }}>
              Collec<span style={{ color: "#3ecf8e" }}>Tools</span>
            </div>
            <div style={{ fontSize: 22, color: "rgba(244,247,251,0.65)", marginTop: 4 }}>
              Pokémon TCG collector toolkit
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 920 }}>
          <div
            style={{
              fontSize: 54,
              fontWeight: 750,
              letterSpacing: -1.8,
              lineHeight: 1.15,
            }}
          >
            SlabCrack · SlabLab · PokeMatch · Queue Watch
          </div>
          <div style={{ fontSize: 26, color: "rgba(244,247,251,0.72)", lineHeight: 1.4 }}>
            Graded arbitrage, PSA 10 spreads, trading matches, and Pokemon Center queue alerts.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 22, color: "rgba(244,247,251,0.55)" }}>
          collectools.app
        </div>
      </div>
    ),
    { ...size },
  )
}
