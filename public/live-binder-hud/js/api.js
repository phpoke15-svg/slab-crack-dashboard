;(function (global) {
  function apiBase() {
    if (global.LIVE_BINDER_API_BASE) return String(global.LIVE_BINDER_API_BASE).replace(/\/$/, "")
    if (global.location.pathname.startsWith("/live-binder-hud")) {
      return "/api/live-binder-hud"
    }
    return "/api"
  }

  function scanUrl() {
    return `${apiBase()}/scan`
  }

  function pricesUrl() {
    const base = apiBase()
    return base === "/api/live-binder-hud" ? `${base}/price` : `${base}/prices`
  }

  async function scanFrame(payload) {
    const body =
      typeof payload === "string"
        ? { mimeType: "image/jpeg", data: payload.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "") }
        : {
            mimeType: payload.mimeType || "image/jpeg",
            data: String(payload.data || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""),
          }

    console.log("[BinderApi] scan payload", {
      mimeType: body.mimeType,
      dataChars: body.data.length,
      dataHead: body.data.slice(0, 40),
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 55_000)

    let res
    try {
      res = await fetch(scanUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Scan timed out waiting for Gemini")
      }
      throw err
    }
    clearTimeout(timer)

    const text = await res.text()
    let data = {}
    try {
      data = JSON.parse(text)
    } catch {
      if (/FUNCTION_INVOCATION_TIMEOUT|timed out/i.test(text)) {
        throw new Error("Scan timed out on the server")
      }
      throw new Error(`Scan failed (${res.status}) — non-JSON response`)
    }

    console.log("[BinderApi] scan response rawJson:", data.rawJson)
    console.log("[BinderApi] scan response cards:", data.cards)
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `Scan failed (${res.status})`)
    }
    return data
  }

  async function priceCards(cards, apiKey) {
    const res = await fetch(pricesUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-pricecharting-key": apiKey } : {}),
      },
      body: JSON.stringify({ cards, apiKey: apiKey || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `Price lookup failed (${res.status})`)
    }
    return data.results || []
  }

  global.BinderApi = { apiBase, scanFrame, priceCards }
})(window)
