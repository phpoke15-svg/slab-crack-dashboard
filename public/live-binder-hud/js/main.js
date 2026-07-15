;(function () {
  const stage = document.getElementById("stage")
  const viewport = document.getElementById("viewport")
  const video = document.getElementById("video")
  const capture = document.getElementById("capture")
  const hudLayer = document.getElementById("hudLayer")
  const statusEl = document.getElementById("status")
  const scanBtn = document.getElementById("scanBtn")
  const autoToggle = document.getElementById("autoScan")
  const clearBtn = document.getElementById("clearHud")
  const pcKeyInput = document.getElementById("pcKey")
  const modelTag = document.getElementById("modelTag")

  const captureCtx = capture.getContext("2d", { willReadFrequently: true })
  const hud = BinderHud.createHud(hudLayer)

  const STABLE_MS = 2000
  const SAMPLE_EVERY_N = 4
  // HTMLMediaElement.HAVE_ENOUGH_DATA
  const HAVE_ENOUGH_DATA = 4

  let running = false
  let scanning = false
  let frameCount = 0
  let prevSample = null
  let stableSince = null
  let lastAutoScanAt = 0

  function setStatus(text) {
    statusEl.textContent = text
  }

  function pcKey() {
    return (pcKeyInput.value || localStorage.getItem("lbhud:pcKey") || "").trim()
  }

  pcKeyInput.value = localStorage.getItem("lbhud:pcKey") || ""
  pcKeyInput.addEventListener("change", () => {
    localStorage.setItem("lbhud:pcKey", pcKeyInput.value.trim())
  })

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

    if (capture.width !== vw || capture.height !== vh) {
      capture.width = vw
      capture.height = vh
    }

    hud.relayout()
  }

  function waitForVideoReady(timeoutMs = 8000) {
    if (video.readyState >= HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      const started = performance.now()
      const timer = setInterval(() => {
        if (video.readyState >= HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          clearInterval(timer)
          resolve()
          return
        }
        if (performance.now() - started > timeoutMs) {
          clearInterval(timer)
          reject(
            new Error(
              `Camera not ready (readyState=${video.readyState}, need ${HAVE_ENOUGH_DATA})`,
            ),
          )
        }
      }, 50)
    })
  }

  function sampleFingerprint() {
    const tw = 48
    const th = 27
    const tmp = document.createElement("canvas")
    tmp.width = tw
    tmp.height = th
    const ctx = tmp.getContext("2d", { willReadFrequently: true })
    ctx.drawImage(video, 0, 0, tw, th)
    const { data } = ctx.getImageData(0, 0, tw, th)
    const out = new Uint8Array(tw * th)
    for (let i = 0, p = 0; i < out.length; i++, p += 4) {
      out[i] = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) | 0
    }
    return out
  }

  function sampleMotion(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity
    let sum = 0
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
    return sum / a.length
  }

  /** Reject blank / near-black captures before calling Gemini. */
  function assertCaptureNotBlank(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    const w = Math.min(64, canvas.width)
    const h = Math.min(36, canvas.height)
    if (w < 2 || h < 2) throw new Error("Capture canvas has no size")
    const sample = document.createElement("canvas")
    sample.width = w
    sample.height = h
    const sctx = sample.getContext("2d", { willReadFrequently: true })
    sctx.drawImage(canvas, 0, 0, w, h)
    const { data } = sctx.getImageData(0, 0, w, h)
    let sum = 0
    let sumSq = 0
    const n = w * h
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const g = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114
      sum += g
      sumSq += g * g
    }
    const mean = sum / n
    const variance = sumSq / n - mean * mean
    console.log("[BinderHud] capture quality", { mean, variance, w: canvas.width, h: canvas.height })
    if (mean < 2 && variance < 1) {
      throw new Error("Capture looks blank (black frame) — wait for the camera and retry")
    }
    if (variance < 0.5) {
      throw new Error("Capture looks blank (no detail) — wait for the camera and retry")
    }
  }

  /**
   * Capture JPEG @ 0.8 and strip the data-URL prefix for Gemini inlineData.
   * @returns {{ mimeType: string, data: string, dataUrl: string }}
   */
  function captureFrameForGemini() {
    if (video.readyState < HAVE_ENOUGH_DATA) {
      throw new Error(`video.readyState is ${video.readyState}, need ${HAVE_ENOUGH_DATA}`)
    }
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("videoWidth/videoHeight are 0")
    }

    capture.width = video.videoWidth
    capture.height = video.videoHeight
    captureCtx.drawImage(video, 0, 0, capture.width, capture.height)
    assertCaptureNotBlank(capture)

    let exportCanvas = capture
    const maxW = 1280
    if (capture.width > maxW) {
      const scale = maxW / capture.width
      const tmp = document.createElement("canvas")
      tmp.width = Math.round(capture.width * scale)
      tmp.height = Math.round(capture.height * scale)
      tmp.getContext("2d").drawImage(capture, 0, 0, tmp.width, tmp.height)
      exportCanvas = tmp
    }

    const dataUrl = exportCanvas.toDataURL("image/jpeg", 0.8)
    const prefix = "data:image/jpeg;base64,"
    if (!dataUrl.startsWith(prefix)) {
      throw new Error("Expected JPEG data URL from canvas.toDataURL")
    }
    const data = dataUrl.slice(prefix.length)
    console.log("[BinderHud] captured frame", {
      videoReadyState: video.readyState,
      videoSize: `${video.videoWidth}x${video.videoHeight}`,
      exportSize: `${exportCanvas.width}x${exportCanvas.height}`,
      dataUrlPrefix: dataUrl.slice(0, 30),
      base64Chars: data.length,
      base64Head: data.slice(0, 40),
    })
    return { mimeType: "image/jpeg", data, dataUrl }
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
    await waitForVideoReady()
    layoutViewport()
    running = true
    setStatus("Point at any cards — tap Scan Feed (or hold steady 2s)")
    requestAnimationFrame(tick)
  }

  function tick() {
    if (!running) return
    requestAnimationFrame(tick)
    if (!video.videoWidth) return

    frameCount++
    if (frameCount % 30 === 0) layoutViewport()

    if (!scanning && autoToggle.checked && frameCount % SAMPLE_EVERY_N === 0) {
      if (video.readyState < HAVE_ENOUGH_DATA) return
      const sample = sampleFingerprint()
      const motion = sampleMotion(prevSample, sample)
      prevSample = sample
      if (motion < 4.5) {
        if (!stableSince) stableSince = performance.now()
      } else {
        stableSince = null
      }

      if (
        stableSince &&
        performance.now() - stableSince >= STABLE_MS &&
        performance.now() - lastAutoScanAt > 8000
      ) {
        lastAutoScanAt = performance.now()
        void runScan("auto")
      } else if (!scanning && !hud.getCards().length) {
        const ms = stableSince ? Math.round(performance.now() - stableSince) : 0
        setStatus(ms ? `Camera stabilizing… ${ms}ms` : "Point at cards — move less to auto-scan")
      }
    }
  }

  async function runScan(reason) {
    if (scanning) return
    scanning = true
    scanBtn.disabled = true
    setStatus(reason === "auto" ? "Stable — scanning feed…" : "Scanning feed with Gemini…")
    stableSince = null

    try {
      await waitForVideoReady()
      layoutViewport()
      const frame = captureFrameForGemini()
      const result = await BinderApi.scanFrame({ mimeType: frame.mimeType, data: frame.data })

      console.log("[BinderHud] Gemini raw JSON string:", result.rawJson)
      console.log("[BinderHud] Gemini cards:", result.cards)

      const cards = (result.cards || []).map((c, i) => ({
        ...c,
        slot: i + 1,
      }))

      if (!cards.length) {
        hud.clear()
        setStatus("No cards in Gemini JSON — check console for rawJson")
        console.warn("[BinderHud] Empty cards[] — rawJson was:", result.rawJson)
        return
      }

      hud.render(cards)
      modelTag.textContent = `Model ${result.model || "gemini"} · ${cards.length} card${cards.length === 1 ? "" : "s"}`
      setStatus(`Found ${cards.length} card${cards.length === 1 ? "" : "s"} — pricing…`)

      const toFetch = []
      cards.forEach((c, i) => {
        const cached = BinderCache.getPrice(c)
        if (cached?.prices) hud.updateCard(i, { pricing: cached })
        else toFetch.push({ index: i, card: c })
      })

      if (toFetch.length) {
        const results = await BinderApi.priceCards(
          toFetch.map(({ index, card }) => ({
            slot: index + 1,
            name: card.name,
            set: card.set,
            number: card.number,
          })),
          pcKey(),
        )
        results.forEach((r, j) => {
          const index = toFetch[j]?.index
          if (index == null) return
          if (r.ok === false) {
            hud.updateCard(index, { priceError: r.error || "lookup failed" })
            return
          }
          BinderCache.setPrice(cards[index], r)
          hud.updateCard(index, { pricing: r })
        })
      }

      BinderCache.setPage(
        cards.map((c) => ({ slot: c.slot, name: c.name, set: c.set, number: c.number })),
        { results: hud.getCards().map((c) => c.pricing).filter(Boolean) },
      )

      setStatus(`Done — ${cards.length} card HUD${cards.length === 1 ? "" : "s"} ready`)
    } catch (err) {
      console.error("[BinderHud] scan error", err)
      setStatus(err instanceof Error ? err.message : "Scan failed")
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

  scanBtn.addEventListener("click", () => void runScan("manual"))
  clearBtn.addEventListener("click", () => {
    hud.clear()
    BinderCache.clearAll()
    setStatus("HUD cleared")
  })
  window.addEventListener("resize", layoutViewport)
  window.addEventListener("orientationchange", () => setTimeout(layoutViewport, 250))

  void (async () => {
    try {
      await startCamera()
    } catch (err) {
      console.error(err)
      setStatus("Camera permission denied or unavailable")
    }
  })()
})()
