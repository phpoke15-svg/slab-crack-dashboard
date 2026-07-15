;(function () {
  const stage = document.getElementById("stage")
  const video = document.getElementById("video")
  const frame = document.getElementById("frame")
  const overlay = document.getElementById("overlay")
  const statusEl = document.getElementById("status")
  const scanBtn = document.getElementById("scanBtn")
  const autoToggle = document.getElementById("autoScan")
  const clearCacheBtn = document.getElementById("clearCache")
  const pcKeyInput = document.getElementById("pcKey")
  const cvSourceEl = document.getElementById("cvSource")

  const frameCtx = frame.getContext("2d", { willReadFrequently: true })
  const overlayCtx = overlay.getContext("2d")

  // Reused detection buffer
  const detectCanvas = document.createElement("canvas")
  const detectCtx = detectCanvas.getContext("2d", { willReadFrequently: true })

  const STABLE_MS = 2000
  const MOTION_PX = 14
  const DETECT_EVERY_N = 2
  const DETECT_WIDTH = 560

  let running = false
  let scanning = false
  let frameCount = 0
  let smoothQuad = null
  let lastRawQuad = null
  let stableSince = null
  let lastAutoScanAt = 0
  let slots = []
  let identifiedBySlot = {}
  let pricedBySlot = {}
  let locked = false
  let lastSource = "…"
  let lastConfidence = 0

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

  /**
   * Letterbox video + canvases to the same CSS box so outline coords match pixels.
   * Avoids object-fit drift between <video> and <canvas>.
   */
  function layoutStage() {
    const vw = video.videoWidth || 1280
    const vh = video.videoHeight || 720
    const sw = stage.clientWidth || window.innerWidth
    const sh = stage.clientHeight || window.innerHeight
    const scale = Math.min(sw / vw, sh / vh)
    const dw = Math.max(1, Math.round(vw * scale))
    const dh = Math.max(1, Math.round(vh * scale))
    const left = Math.round((sw - dw) / 2)
    const top = Math.round((sh - dh) / 2)

    for (const el of [video, frame, overlay]) {
      el.style.position = "absolute"
      el.style.left = `${left}px`
      el.style.top = `${top}px`
      el.style.width = `${dw}px`
      el.style.height = `${dh}px`
      el.style.right = "auto"
      el.style.bottom = "auto"
      el.style.objectFit = "fill"
      el.style.maxWidth = "none"
      el.style.maxHeight = "none"
    }

    if (frame.width !== vw || frame.height !== vh) {
      frame.width = vw
      frame.height = vh
      overlay.width = vw
      overlay.height = vh
    }
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
    layoutStage()
    running = true
    setStatus("Align the binder page — 9 pocket outlines lock locally")
    requestAnimationFrame(tick)
  }

  function tick() {
    if (!running) return
    requestAnimationFrame(tick)
    if (!video.videoWidth) return

    layoutStage()
    frameCtx.drawImage(video, 0, 0, frame.width, frame.height)
    frameCount++

    if (!scanning && frameCount % DETECT_EVERY_N === 0) {
      const scale = Math.min(1, DETECT_WIDTH / frame.width)
      const dw = Math.max(180, Math.round(frame.width * scale))
      const dh = Math.max(140, Math.round(frame.height * scale))
      if (detectCanvas.width !== dw || detectCanvas.height !== dh) {
        detectCanvas.width = dw
        detectCanvas.height = dh
      }
      detectCtx.drawImage(frame, 0, 0, dw, dh)
      const imageData = detectCtx.getImageData(0, 0, dw, dh)
      const detected = BinderGrid.detectGrid(imageData)
      lastSource = detected.source
      lastConfidence = detected.confidence
      cvSourceEl.textContent = `${detected.source} · ${Math.round(detected.confidence * 100)}%`

      const sx = frame.width / dw
      const sy = frame.height / dh
      const mapped = detected.quad.map((p) => ({ x: p.x * sx, y: p.y * sy }))
      const motion = BinderGrid.quadMotion(lastRawQuad, mapped)
      lastRawQuad = mapped

      // Hold lock when motion is tiny; otherwise ease toward new estimate
      const alpha = locked && motion < MOTION_PX ? 0.18 : motion < MOTION_PX * 2 ? 0.35 : 0.6
      smoothQuad = BinderGrid.smoothQuad(smoothQuad, mapped, alpha)
      slots = BinderGrid.slotsFromQuad(smoothQuad)

      locked = detected.confidence >= 0.4 && (motion < MOTION_PX * 1.8 || detected.source !== "fallback")

      if (locked && motion < MOTION_PX) {
        if (!stableSince) stableSince = performance.now()
      } else if (motion > MOTION_PX * 2.5) {
        stableSince = null
      }

      if (!scanning) {
        if (locked) {
          const stableMs = stableSince ? Math.round(performance.now() - stableSince) : 0
          setStatus(
            stableMs >= STABLE_MS
              ? "Grid locked — ready to scan"
              : `Tracking pockets… ${Math.min(STABLE_MS, stableMs)}ms stable`,
          )
        } else {
          setStatus("Looking for 9-pocket page… keep the binder flat in frame")
        }
      }

      maybeAutoScan()
    }

    BinderOverlay.draw(overlayCtx, {
      quad: smoothQuad,
      slots,
      locked,
      identifiedBySlot,
      pricedBySlot,
      statusText: scanning ? "Scanning page with Gemini…" : null,
    })
  }

  function maybeAutoScan() {
    if (!autoToggle.checked || scanning || !stableSince) return
    if (performance.now() - stableSince < STABLE_MS) return
    if (performance.now() - lastAutoScanAt < 8000) return
    lastAutoScanAt = performance.now()
    void runScan("auto")
  }

  async function runScan(reason) {
    if (scanning) return
    if (!smoothQuad || !slots.length) {
      setStatus("No grid yet — hold the binder page in frame")
      return
    }
    scanning = true
    scanBtn.disabled = true
    setStatus(reason === "auto" ? "Stable — scanning page…" : "Scanning page…")

    try {
      const pockets = []
      for (const slot of slots) {
        const image = BinderGrid.cropSlot(frame, slot, 320, 448)
        pockets.push({ slot: slot.slot, image })
      }

      const scan = await BinderApi.scanPockets(pockets)
      const cards = scan.cards || []
      identifiedBySlot = {}
      for (const c of cards) identifiedBySlot[c.slot] = c
      setStatus(`Identified ${cards.length} card(s) — pricing…`)

      const pageCached = BinderCache.getPage(cards)
      if (pageCached?.results?.length) {
        pricedBySlot = {}
        for (const r of pageCached.results) {
          if (r.ok !== false) pricedBySlot[r.slot] = r
        }
        setStatus(`Loaded ${Object.keys(pricedBySlot).length} prices from cache`)
        return
      }

      const toFetch = []
      pricedBySlot = {}
      for (const c of cards) {
        const cached = BinderCache.getPrice(c)
        if (cached?.prices) pricedBySlot[c.slot] = { ...c, ...cached }
        else toFetch.push(c)
      }

      if (toFetch.length) {
        const results = await BinderApi.priceCards(toFetch, pcKey())
        for (const r of results) {
          if (r.ok === false) continue
          pricedBySlot[r.slot] = r
          BinderCache.setPrice(r, r)
        }
        BinderCache.setPage(cards, { results: Object.values(pricedBySlot) })
      }

      setStatus(`Done — ${Object.keys(pricedBySlot).length} priced · ${scan.model || "gemini"}`)
    } catch (err) {
      console.error(err)
      setStatus(err instanceof Error ? err.message : "Scan failed")
    } finally {
      scanning = false
      scanBtn.disabled = false
      stableSince = null
    }
  }

  scanBtn.addEventListener("click", () => void runScan("manual"))
  clearCacheBtn.addEventListener("click", () => {
    BinderCache.clearAll()
    pricedBySlot = {}
    identifiedBySlot = {}
    setStatus("Cache cleared")
  })
  window.addEventListener("resize", layoutStage)
  window.addEventListener("orientationchange", () => setTimeout(layoutStage, 250))

  function loadOpenCv() {
    return new Promise((resolve) => {
      if (window.cv && window.cv.Mat) {
        resolve(true)
        return
      }
      const script = document.createElement("script")
      script.src = "https://docs.opencv.org/4.10.0/opencv.js"
      script.async = true
      let settled = false
      const done = (ok) => {
        if (settled) return
        settled = true
        resolve(ok)
      }
      script.onload = () => {
        if (window.cv?.onRuntimeInitialized) {
          const prev = window.cv.onRuntimeInitialized
          window.cv.onRuntimeInitialized = () => {
            try {
              prev?.()
            } catch {
              /* ignore */
            }
            done(true)
          }
        } else {
          setTimeout(() => done(Boolean(window.cv?.Mat)), 400)
        }
      }
      script.onerror = () => done(false)
      document.head.appendChild(script)
      setTimeout(() => done(Boolean(window.cv?.Mat)), 10000)
    })
  }

  void (async () => {
    try {
      await startCamera()
      // Seed an immediate fallback grid so outlines are visible right away
      const q = BinderGrid.defaultQuad(frame.width, frame.height)
      smoothQuad = q
      slots = BinderGrid.slotsFromQuad(q)
      const ok = await loadOpenCv()
      cvSourceEl.textContent = ok ? "OpenCV.js + Canvas" : "Canvas CV"
      if (ok) setStatus("CV ready — align binder to the 9 pocket outlines")
    } catch (err) {
      console.error(err)
      setStatus("Camera permission denied or unavailable")
    }
  })()
})()
