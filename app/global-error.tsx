"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0e14",
          color: "#e8eaed",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>CollecTools</p>
          <p style={{ marginTop: 12, opacity: 0.7, fontSize: 14 }}>
            Something went wrong loading the app.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              border: 0,
              borderRadius: 12,
              padding: "10px 16px",
              background: "#22c55e",
              color: "#052e16",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <p style={{ marginTop: 16, fontSize: 11, opacity: 0.4 }}>
            {error.digest ? `Ref ${error.digest}` : null}
          </p>
        </div>
      </body>
    </html>
  )
}
