/**
 * Local binder-page grid detection (Canvas). Optional OpenCV.js upgrade when loaded.
 * Responsibilities: find page quad → lock 3×3 pocket slots → crop pockets.
 * Never calls Gemini.
 */
;(function (global) {
  const SLOT_COUNT = 9
  const POCKET_INSET = 0.06 // shrink each cell to avoid plastic borders

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v))
  }

  function defaultQuad(w, h) {
    const padX = w * 0.08
    const padY = h * 0.1
    return [
      { x: padX, y: padY },
      { x: w - padX, y: padY },
      { x: w - padX, y: h - padY },
      { x: padX, y: h - padY },
    ]
  }

  function orderCorners(pts) {
    const sorted = [...pts].sort((a, b) => a.y - b.y || a.x - b.x)
    const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x)
    const bottom = sorted.slice(2).sort((a, b) => a.x - b.x)
    return [top[0], top[1], bottom[1], bottom[0]] // TL TR BR BL
  }

  function quadArea(q) {
    let area = 0
    for (let i = 0; i < 4; i++) {
      const a = q[i]
      const b = q[(i + 1) % 4]
      area += a.x * b.y - b.x * a.y
    }
    return Math.abs(area) / 2
  }

  function lerp(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }

  /** Bilinear sample inside TL-TR-BR-BL quad. u,v in 0..1 */
  function mapQuad(quad, u, v) {
    const top = lerp(quad[0], quad[1], u)
    const bottom = lerp(quad[3], quad[2], u)
    return lerp(top, bottom, v)
  }

  function slotsFromQuad(quad) {
    const slots = []
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const u0 = col / 3 + POCKET_INSET / 3
        const u1 = (col + 1) / 3 - POCKET_INSET / 3
        const v0 = row / 3 + POCKET_INSET / 3
        const v1 = (row + 1) / 3 - POCKET_INSET / 3
        const corners = [
          mapQuad(quad, u0, v0),
          mapQuad(quad, u1, v0),
          mapQuad(quad, u1, v1),
          mapQuad(quad, u0, v1),
        ]
        slots.push({
          slot: row * 3 + col + 1,
          corners,
          center: mapQuad(quad, (u0 + u1) / 2, (v0 + v1) / 2),
        })
      }
    }
    return slots
  }

  function grayBlurThreshold(src, w, h) {
    const gray = new Uint8ClampedArray(w * h)
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = (src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114) | 0
    }
    // 3×3 box blur
    const blur = new Uint8ClampedArray(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let s = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) s += gray[(y + dy) * w + (x + dx)]
        }
        blur[y * w + x] = (s / 9) | 0
      }
    }
    // Adaptive-ish threshold via local mean of whole frame
    let mean = 0
    for (let i = 0; i < blur.length; i++) mean += blur[i]
    mean /= blur.length
    const thr = clamp(mean * 0.72, 40, 140)
    const bin = new Uint8ClampedArray(w * h)
    for (let i = 0; i < blur.length; i++) bin[i] = blur[i] < thr ? 1 : 0
    return bin
  }

  function largestContourQuad(bin, w, h) {
    const visited = new Uint8ClampedArray(w * h)
    let best = null
    let bestArea = 0

    function flood(sx, sy) {
      const stack = [[sx, sy]]
      visited[sy * w + sx] = 1
      let minX = sx
      let maxX = sx
      let minY = sy
      let maxY = sy
      let count = 0
      const edge = []
      while (stack.length) {
        const [x, y] = stack.pop()
        count++
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
        let isEdge = false
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
              isEdge = true
              continue
            }
            const ni = ny * w + nx
            if (!bin[ni]) {
              isEdge = true
              continue
            }
            if (!visited[ni]) {
              visited[ni] = 1
              stack.push([nx, ny])
            }
          }
        }
        if (isEdge) edge.push({ x, y })
      }
      return { count, minX, maxX, minY, maxY, edge }
    }

    const step = Math.max(2, Math.floor(Math.min(w, h) / 80))
    for (let y = 2; y < h - 2; y += step) {
      for (let x = 2; x < w - 2; x += step) {
        const i = y * w + x
        if (!bin[i] || visited[i]) continue
        const region = flood(x, y)
        const bw = region.maxX - region.minX
        const bh = region.maxY - region.minY
        const area = bw * bh
        const fill = region.count / Math.max(1, area)
        const frameArea = w * h
        if (area < frameArea * 0.18 || area > frameArea * 0.96) continue
        if (fill < 0.35 || fill > 0.98) continue
        const aspect = bw / Math.max(1, bh)
        if (aspect < 0.55 || aspect > 1.85) continue
        if (area <= bestArea) continue

        // Approximate quad from bounding extremes of edge points
        const pts = region.edge
        if (pts.length < 20) continue
        let tl = pts[0]
        let tr = pts[0]
        let br = pts[0]
        let bl = pts[0]
        let tlScore = Infinity
        let trScore = -Infinity
        let brScore = -Infinity
        let blScore = Infinity
        for (const p of pts) {
          const s1 = p.x + p.y
          const s2 = p.x - p.y
          if (s1 < tlScore) {
            tlScore = s1
            tl = p
          }
          if (s2 > trScore) {
            trScore = s2
            tr = p
          }
          if (s1 > brScore) {
            brScore = s1
            br = p
          }
          if (s2 < blScore) {
            blScore = s2
            bl = p
          }
        }
        const quad = orderCorners([tl, tr, br, bl])
        const qArea = quadArea(quad)
        if (qArea < frameArea * 0.15) continue
        bestArea = area
        best = { quad, confidence: clamp(fill * (area / frameArea) * 2.2, 0.2, 0.95) }
      }
    }
    return best
  }

  function detectWithCanvas(imageData) {
    const { width: w, height: h, data } = imageData
    const bin = grayBlurThreshold(data, w, h)
    const found = largestContourQuad(bin, w, h)
    if (!found) {
      const quad = defaultQuad(w, h)
      return { quad, slots: slotsFromQuad(quad), confidence: 0.25, source: "fallback" }
    }
    return {
      quad: found.quad,
      slots: slotsFromQuad(found.quad),
      confidence: found.confidence,
      source: "canvas",
    }
  }

  function detectWithOpenCv(cv, imageData) {
    const src = cv.matFromImageData(imageData)
    const gray = new cv.Mat()
    const blur = new cv.Mat()
    const edges = new cv.Mat()
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)
      cv.Canny(blur, edges, 60, 160)
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

      let best = null
      let bestArea = 0
      const frameArea = imageData.width * imageData.height
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i)
        const peri = cv.arcLength(cnt, true)
        const approx = new cv.Mat()
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true)
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const area = Math.abs(cv.contourArea(approx))
          if (area > bestArea && area > frameArea * 0.18 && area < frameArea * 0.95) {
            const pts = []
            for (let r = 0; r < 4; r++) {
              pts.push({ x: approx.intAt(r, 0), y: approx.intAt(r, 1) })
            }
            bestArea = area
            best = orderCorners(pts)
          }
        }
        approx.delete()
      }

      if (!best) {
        return detectWithCanvas(imageData)
      }
      return {
        quad: best,
        slots: slotsFromQuad(best),
        confidence: clamp((bestArea / frameArea) * 1.4, 0.35, 0.98),
        source: "opencv",
      }
    } finally {
      src.delete()
      gray.delete()
      blur.delete()
      edges.delete()
      contours.delete()
      hierarchy.delete()
    }
  }

  function detectGrid(imageData, opts = {}) {
    const cv = global.cv
    if (opts.preferOpenCv !== false && cv && cv.Mat && typeof cv.matFromImageData === "function") {
      try {
        return detectWithOpenCv(cv, imageData)
      } catch {
        // fall through
      }
    }
    return detectWithCanvas(imageData)
  }

  function smoothQuad(prev, next, alpha = 0.35) {
    if (!prev) return next
    return next.map((p, i) => ({
      x: prev[i].x * (1 - alpha) + p.x * alpha,
      y: prev[i].y * (1 - alpha) + p.y * alpha,
    }))
  }

  function quadMotion(a, b) {
    if (!a || !b) return Infinity
    let max = 0
    for (let i = 0; i < 4; i++) {
      const dx = a[i].x - b[i].x
      const dy = a[i].y - b[i].y
      max = Math.max(max, Math.hypot(dx, dy))
    }
    return max
  }

  /**
   * Crop a pocket to JPEG. Uses inverse-bilinear sampling on a downscaled
   * working buffer so Scan Page stays responsive without WebGL.
   */
  function cropSlot(sourceCanvas, slot, outW = 280, outH = 392) {
    const [tl, tr, br, bl] = slot.corners
    const xs = [tl.x, tr.x, br.x, bl.x]
    const ys = [tl.y, tr.y, br.y, bl.y]
    const minX = Math.floor(Math.min(...xs))
    const maxX = Math.ceil(Math.max(...xs))
    const minY = Math.floor(Math.min(...ys))
    const maxY = Math.ceil(Math.max(...ys))
    const bw = Math.max(8, maxX - minX)
    const bh = Math.max(8, maxY - minY)

    // Fast path: near-rectilinear pocket → AABB scale
    const skew =
      Math.abs(tl.y - tr.y) +
      Math.abs(bl.y - br.y) +
      Math.abs(tl.x - bl.x) +
      Math.abs(tr.x - br.x)
    const out = document.createElement("canvas")
    out.width = outW
    out.height = outH
    const octx = out.getContext("2d")

    if (skew < Math.max(bw, bh) * 0.08) {
      octx.drawImage(sourceCanvas, minX, minY, bw, bh, 0, 0, outW, outH)
      return out.toDataURL("image/jpeg", 0.9)
    }

    // Sparse bilinear warp (sample every pixel but from a smaller source read)
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true })
    const pad = 2
    const sx0 = clamp(minX - pad, 0, sourceCanvas.width - 1)
    const sy0 = clamp(minY - pad, 0, sourceCanvas.height - 1)
    const sw = clamp(bw + pad * 2, 1, sourceCanvas.width - sx0)
    const sh = clamp(bh + pad * 2, 1, sourceCanvas.height - sy0)
    const src = ctx.getImageData(sx0, sy0, sw, sh)
    const dst = octx.createImageData(outW, outH)
    const rel = (p) => ({ x: p.x - sx0, y: p.y - sy0 })
    const rtl = rel(tl)
    const rtr = rel(tr)
    const rbr = rel(br)
    const rbl = rel(bl)

    for (let y = 0; y < outH; y++) {
      const v = (y + 0.5) / outH
      for (let x = 0; x < outW; x++) {
        const u = (x + 0.5) / outW
        const top = lerp(rtl, rtr, u)
        const bottom = lerp(rbl, rbr, u)
        const p = lerp(top, bottom, v)
        const sx = clamp(p.x | 0, 0, sw - 1)
        const sy = clamp(p.y | 0, 0, sh - 1)
        const si = (sy * sw + sx) * 4
        const di = (y * outW + x) * 4
        dst.data[di] = src.data[si]
        dst.data[di + 1] = src.data[si + 1]
        dst.data[di + 2] = src.data[si + 2]
        dst.data[di + 3] = 255
      }
    }
    octx.putImageData(dst, 0, 0)
    return out.toDataURL("image/jpeg", 0.9)
  }

  global.BinderGrid = {
    SLOT_COUNT,
    detectGrid,
    slotsFromQuad,
    smoothQuad,
    quadMotion,
    cropSlot,
    defaultQuad,
    mapQuad,
  }
})(window)
