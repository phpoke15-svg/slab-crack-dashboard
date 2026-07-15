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
  const detectCanvas = document.createElement("canvas")
  const detectCtx = detectCanvas.getContext("2d", { willReadFrequently: true })

  const STABLE_MS = 2000
  const MOTION_PX = 16
  const DETECT_EVERY_N = 2
  const DETECT_WIDTH = 560

  let running = false
  let scanning = false
  let frameCount = 0
  let smoothQuad = null
  let prevSlots = []
  let slots = []
  let cardCount = 0
  let stableSince = null
  let lastAutoScanAt = 0
  let lastStableCount = 0
  let identifiedBySlot = {}
  let pricedBySlot = {}
  let locked = false

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
    setStatus("Point at cards — detecting how many are in frame (up to 9)")
    requestAnimationFrame(tick)
  }

  function scaleSlots(rawSlots, sx, sy) {
    return rawSlots.map((s) => ({
      slot: s.slot,
      trackId: s.trackId,
      confidence: s.confidence,
      corners: s.corners.map((p) => ({ x: p.x * sx, y: p.y * sy })),
      center: { x: s.center.x * sx, y: s.center.y * sy },
      box: s.box
        ? { x: s.box.x * sx, y: s.box.y * sy, w: s.box.w * sx, h: s.box.h * sy }
        : null,
    }))
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
      const detected = BinderGrid.detectCards(imageData)

      const sx = frame.width / dw
      const sy = frame.height / dh
      const mappedSlots = scaleSlots(detected.slots, sx, sy)
      const mappedQuad = detected.quad
        ? detected.quad.map((p) => ({ x: p.x * sx, y: p.y * sy }))
        : null

      const motion = BinderGrid.slotsMotion(prevSlots, mappedSlots)
      prevSlots = mappedSlots
      slots = mappedSlots
      cardCount = detected.count
      smoothQuad = mappedQuad
      locked = detected.locked && detected.count > 0

      cvSourceEl.textContent = `${detected.source} · ${cardCount} card${cardCount === 1 ? "" : "s"}`

      const countChanged = cardCount !== lastStableCount
      if (locked && motion < MOTION_PX && !countChanged) {
        if (!stableSince) stableSince = performance.now()
      } else {
        stableSince = null
        lastStableCount = cardCount
      }
      if (locked && motion < MOTION_PX) lastStableCount = cardCount

      if (!scanning) {
        if (!cardCount) {
          setStatus("No cards detected — show 1–9 cards in frame")
        } else if (locked && stableSince && performance.now() - stableSince >= STABLE_MS) {
          setStatus(`${cardCount} card${cardCount === 1 ? "" : "s"} locked — ready to scan`)
        } else {
          const stableMs = stableSince ? Math.round(performance.now() - stableSince) : 0
          setStatus(`Tracking ${cardCount} card${cardCount === 1 ? "" : "s"}… ${stableMs}ms stable`)
        }
      }

      maybeAutoScan()
    }

    BinderOverlay.draw(overlayCtx, {
      quad: smoothQuad,
      slots,
      locked,
      cardCount,
      identifiedBySlot,
      pricedBySlot,
      statusText: scanning ? `Scanning ${cardCount} card${cardCount === 1 ? "" : "s"}…` : null,
    })
  }

  function maybeAutoScan() {
    if (!autoToggle.checked || scanning || !stableSince || cardCount < 1) return
    if (performance.now() - stableSince < STABLE_MS) return
    if (performance.now() - lastAutoScanAt < 8000) return
    lastAutoScanAt = performance.now()
    void runScan("auto")
  }

  async function runScan(reason) {
    if (scanning) return
    if (!slots.length) {
      setStatus("No cards detected yet — hold cards in frame")
      return
    }
    scanning = true
    scanBtn.disabled = true
    const n = slots.length
    setStatus(reason === "auto" ? `Stable — scanning ${n} card${n === 1 ? "" : "s"}…` : `Scanning ${n} card${n === 1 ? "" : "s"}…`)

    try {
      const pockets = slots.map((slot) => ({
        slot: slot.slot,
        image: BinderGrid.cropSlot(frame, slot, 320, 448),
      }))

      const scan = await BinderApi.scanPockets(pockets)
      const cards = scan.cards || []
      identifiedBySlot = {}
      for (const c of cards) identifiedBySlot[c.slot] = c
      setStatus(`Identified ${cards.length}/${n} — pricing…`)

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
      const ok = await loadOpenCv()
      cvSourceEl.textContent = ok ? "OpenCV.js + Canvas" : "Canvas CV"
      if (ok) setStatus("CV ready — show 1–9 cards to outline them")
    } catch (err) {
      console.error(err)
      setStatus("Camera permission denied or unavailable")
    }
  })()
})()
