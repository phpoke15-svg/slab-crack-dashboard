;(function () {
  const BUILD = "20260715e"
  const stage = document.getElementById("stage")
  const viewport = document.getElementById("viewport")
  const video = document.getElementById("video")
  const capture = document.getElementById("capture")
  const hudLayer = document.getElementById("hudLayer")
  const statusEl = document.getElementById("status")
  const scanBtn = document.getElementById("scanBtn")
  const clearBtn = document.getElementById("clearHud")
  const modelTag = document.getElementById("modelTag")
  const toastEl = document.getElementById("toast")
  const buildTag = document.getElementById("buildTag")

  if (buildTag) buildTag.textContent = BUILD
  console.log("[BinderHud] build", BUILD)

  const captureCtx = capture.getContext("2d")
  const hud = BinderHud.createHud(hudLayer)

  let scanning = false
  let toastTimer = null

  function setStatus(text) {
    statusEl.textContent = text
  }

  function showToast(message) {
    console.warn("[BinderHud] toast:", message)
    if (!toastEl) {
      setStatus(message)
      return
    }
    toastEl.textContent = message
    toastEl.hidden = false
    toastEl.classList.add("is-visible")
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("is-visible")
      toastEl.hidden = true
    }, 5200)
  }

  function layoutViewport() {
    const vw = video.videoWidth || 1280
    const vh = video.videoHeight || 720
    const sw = stage.clientWidth || window.innerWidth
    const sh = stage.clientHeight || window.innerHeight
    const usableH = Math.max(200, sh - 8)
    const scale = Math.min(sw / vw, usableH / vh)
    const dw = Math.max(1, Math.round(vw * scale))
    const dh = Math.max(1, Math.round(vh * scale))
    const left = Math.round((sw - dw) / 2)
    const top = Math.round((usableH - dh) / 2)

    viewport.style.left = `${left}px`
    viewport.style.top = `${top}px`
    viewport.style.width = `${dw}px`
    viewport.style.height = `${dh}px`
    hud.relayout()
  }

  /**
   * Raw video → canvas → JPEG (downscaled like SlabCrack scan for faster Gemini).
   */
  function captureFrameDirect() {
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) {
      throw new Error("Camera frame not available yet — try again in a moment")
    }

    const maxW = 768
    const scale = w > maxW ? maxW / w : 1
    const cw = Math.round(w * scale)
    const ch = Math.round(h * scale)
    capture.width = cw
    capture.height = ch
    captureCtx.drawImage(video, 0, 0, cw, ch)

    const dataUrl = capture.toDataURL("image/jpeg", 0.52)
    const prefix = "data:image/jpeg;base64,"
    const data = dataUrl.startsWith(prefix) ? dataUrl.slice(prefix.length) : dataUrl

    console.log("[BinderHud] direct capture", {
      build: BUILD,
      source: `${w}x${h}`,
      export: `${cw}x${ch}`,
      base64Chars: data.length,
    })
    return { mimeType: "image/jpeg", data }
  }

  async function startCamera() {
    setStatus("Requesting camera…")
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    })
    video.srcObject = stream
    await video.play()
    layoutViewport()
    setStatus("Point at cards — tap Scan Feed")
    video.addEventListener("loadedmetadata", layoutViewport)
    video.addEventListener("resize", layoutViewport)
  }

  async function mapPool(items, concurrency, worker) {
    let cursor = 0
    await Promise.all(
      Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (cursor < items.length) {
          const i = cursor
          cursor += 1
          await worker(items[i], i)
        }
      }),
    )
  }

  /** Price in parallel (up to 4) so HUD fills in as each comp lands. */
  async function priceDetectedCards(cards) {
    const toFetch = []
    cards.forEach((c, i) => {
      const cached = BinderCache.getPrice(c)
      if (cached?.prices) hud.updateCard(i, { pricing: cached })
      else toFetch.push({ index: i, card: c })
    })
    if (!toFetch.length) return

    await mapPool(toFetch, 4, async ({ index, card }) => {
      try {
        const results = await BinderApi.priceCards(
          [
            {
              slot: index + 1,
              name: card.name,
              set: card.set,
              number: card.number,
            },
          ],
          pcKey(),
        )
        const r = results[0]
        if (!r || r.ok === false) {
          hud.updateCard(index, { priceError: r?.error || "lookup failed" })
          return
        }
        BinderCache.setPrice(cards[index], r)
        hud.updateCard(index, { pricing: r })
      } catch (priceErr) {
        console.warn("[BinderHud] card price failed", index, priceErr)
        hud.updateCard(index, {
          priceError: priceErr instanceof Error ? priceErr.message : "lookup failed",
        })
      }
    })
  }

  async function runScan() {
    if (scanning) return
    scanning = true
    scanBtn.disabled = true
    setStatus("Scanning feed with Gemini…")

    try {
      layoutViewport()
      const frame = captureFrameDirect()
      const result = await BinderApi.scanFrame({
        mimeType: frame.mimeType,
        data: frame.data,
      })

      console.log("[BinderHud] Gemini raw JSON string:", result.rawJson)
      console.log("[BinderHud] Gemini cards:", result.cards)

      const cards = (result.cards || []).map((c, i) => ({ ...c, slot: i + 1 }))

      if (!cards.length) {
        hud.clear()
        showToast("No cards detected. Try adjusting lighting or camera angle.")
        setStatus("Ready — tap Scan Feed")
        return
      }

      layoutViewport()
      hud.render(cards)

      modelTag.textContent = `Model ${result.model || "gemini"} · ${cards.length} card${
        cards.length === 1 ? "" : "s"
      }`
      setStatus(`Outlined ${cards.length} card${cards.length === 1 ? "" : "s"} — pricing…`)

      await priceDetectedCards(cards)
      setStatus(`Done — ${cards.length} card${cards.length === 1 ? "" : "s"} outlined`)
    } catch (err) {
      console.error("[BinderHud] scan error", err)
      const msg = err instanceof Error ? err.message : "Scan failed"
      if (/timeout|timed out|504|FUNCTION_INVOCATION/i.test(msg)) {
        showToast("Scan timed out — try again with fewer cards / better light.")
      } else if (/not configured|GEMINI|HTTP|failed|missing|unavailable/i.test(msg)) {
        showToast(`Scan failed: ${msg.slice(0, 160)}`)
      } else {
        showToast("No cards detected. Try adjusting lighting or camera angle.")
      }
      setStatus("Ready — tap Scan Feed")
    } finally {
      scanning = false
      scanBtn.disabled = false
    }
  }

  hud.setOnSelect((card) => {
    const price = card.pricing?.prices?.rawNm
    setStatus(
      price
        ? `${card.name} · NM $${Number(price).toFixed(2)}`
        : `${card.name}${card.set ? ` · ${card.set}` : ""}`,
    )
  })

  scanBtn.addEventListener("click", () => void runScan())
  clearBtn.addEventListener("click", () => {
    hud.clear()
    BinderCache.clearAll()
    setStatus("HUD cleared — tap Scan Feed")
  })
  window.addEventListener("resize", layoutViewport)
  window.addEventListener("orientationchange", () => setTimeout(layoutViewport, 250))

  void (async () => {
    try {
      await startCamera()
    } catch (err) {
      console.error(err)
      showToast("Camera permission denied or unavailable.")
      setStatus("Camera unavailable")
    }
  })()
})()
