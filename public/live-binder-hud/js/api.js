;(function (global) {
  function apiBase() {
    if (global.LIVE_BINDER_API_BASE) return String(global.LIVE_BINDER_API_BASE).replace(/\/$/, "")
    if (global.location.pathname.startsWith("/live-binder-hud")) {
      return "/api/live-binder-hud"
    }
    return "/api"
  }

  function scanUrl() {
    const base = apiBase()
    return `${base}/scan`
  }

  function pricesUrl() {
    const base = apiBase()
    return base === "/api/live-binder-hud" ? `${base}/price` : `${base}/prices`
  }

  /** Full-frame Gemini box_2d detect. */
  async function scanFrame(imageDataUrl) {
    const res = await fetch(scanUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
    })
    const data = await res.json().catch(() => ({}))
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
