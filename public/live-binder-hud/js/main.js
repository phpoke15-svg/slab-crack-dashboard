;(function () {
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

  const STABLE_MS = 2000
  const MOTION_PX = 10
  const DETECT_EVERY_N = 2

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
  let cvSource = "…"

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
    resizeCanvases()
    running = true
    setStatus("Point at a 9-pocket page — grid locks locally")
    requestAnimationFrame(tick)
  }

  function resizeCanvases() {
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    frame.width = w
    frame.height = h
    overlay.width = w
    overlay.height = h
  }

  function tick() {
    if (!running) return
    requestAnimationFrame(tick)
    if (!video.videoWidth) return

    if (frame.width !== video.videoWidth) resizeCanvases()

    frameCtx.drawImage(video, 0, 0, frame.width, frame.height)
    frameCount++

    if (!scanning && frameCount % DETECT_EVERY_N === 0) {
      // Downscale for CV speed
      const scale = Math.min(1, 480 / frame.width)
      const dw = Math.max(160, Math.round(frame.width * scale))
      const dh = Math.max(120, Math.round(frame.height * scale))
      const tmp = document.createElement("canvas")
      tmp.width = dw
      tmp.height = dh
      const tctx = tmp.getContext("2d", { willReadFrequently: true })
      tctx.drawImage(frame, 0, 0, dw, dh)
      const imageData = tctx.getImageData(0, 0, dw, dh)
      const detected = BinderGrid.detectGrid(imageData)
      cvSource = detected.source
      cvSourceEl.textContent = detected.source === "opencv" ? "OpenCV.js" : "Canvas CV"

      // Map quad back to full-res
      const sx = frame.width / dw
      const sy = frame.height / dh
      const mapped = detected.quad.map((p) => ({ x: p.x * sx, y: p.y * sy }))
      const motion = BinderGrid.quadMotion(lastRawQuad, mapped)
      lastRawQuad = mapped
      smoothQuad = BinderGrid.smoothQuad(smoothQuad, mapped, motion < MOTION_PX ? 0.25 : 0.55)
      slots = BinderGrid.slotsFromQuad(smoothQuad)
      locked = detected.confidence >= 0.45 && motion < MOTION_PX * 1.5

      if (locked && motion < MOTION_PX) {
        if (!stableSince) stableSince = performance.now()
      } else {
        stableSince = null
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
      // High-res still from current frame canvas
      const pockets = []
      for (const slot of slots) {
        const image = BinderGrid.cropSlot(frame, slot, 320, 448)
        pockets.push({ slot: slot.slot, image })
      }

      const scan = await BinderApi.scanPockets(pockets)
      const cards = scan.cards || []
      identifiedBySlot = {}
      for (const c of cards) {
        identifiedBySlot[c.slot] = c
      }
      setStatus(`Identified ${cards.length} card(s) — pricing…`)

      // Cache page identity
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
        if (cached?.prices) {
          pricedBySlot[c.slot] = { ...c, ...cached }
        } else {
          toFetch.push(c)
        }
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

      setStatus(`Done — ${Object.keys(pricedBySlot).length} priced · model ${scan.model || "gemini"}`)
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

  // Optional OpenCV.js — Canvas fallback works immediately
  function loadOpenCv() {
    return new Promise((resolve) => {
      if (window.cv && window.cv.Mat) {
        resolve(true)
        return
      }
      const script = document.createElement("script")
      script.src = "https://docs.opencv.org/4.10.0/opencv.js"
      script.async = true
      script.onload = () => {
        if (window.cv?.onRuntimeInitialized) {
          window.cv.onRuntimeInitialized = () => resolve(true)
        } else {
          // some builds are sync
          setTimeout(() => resolve(Boolean(window.cv?.Mat)), 300)
        }
      }
      script.onerror = () => resolve(false)
      document.head.appendChild(script)
      // Safety timeout — don't block UI
      setTimeout(() => resolve(Boolean(window.cv?.Mat)), 8000)
    })
  }

  void (async () => {
    try {
      await startCamera()
      const ok = await loadOpenCv()
      cvSourceEl.textContent = ok ? "OpenCV.js ready" : "Canvas CV"
      if (ok) setStatus("OpenCV.js ready — grid lock is local")
    } catch (err) {
      console.error(err)
      setStatus("Camera permission denied or unavailable")
    }
  })()
})()
