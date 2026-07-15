/**
 * Local binder-page grid detection (browser only — never calls Gemini).
 *
 * Strategy:
 *  1) Sobel edges → search for a 3×3 grid that sits on strong edge energy
 *  2) Card-aspect contour boxes → fit a 3×3 lattice from pocket centers
 *  3) Fallback centered page quad so outlines always appear
 */
;(function (global) {
  const SLOT_COUNT = 9
  const POCKET_INSET = 0.05
  const CARD_ASPECT = 63 / 88 // Pokémon card width/height ≈ 0.716

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v))
  }

  function defaultQuad(w, h) {
    // Binder page is usually taller than wide; bias toward a page-shaped region.
    const pageAspect = (3 * CARD_ASPECT) / 3 // ~0.72 for full page of cards… use ~0.78
    const targetAspect = 0.78
    let pw = w * 0.86
    let ph = pw / targetAspect
    if (ph > h * 0.86) {
      ph = h * 0.86
      pw = ph * targetAspect
    }
    const x0 = (w - pw) / 2
    const y0 = (h - ph) / 2
    return [
      { x: x0, y: y0 },
      { x: x0 + pw, y: y0 },
      { x: x0 + pw, y: y0 + ph },
      { x: x0, y: y0 + ph },
    ]
  }

  function orderCorners(pts) {
    const sorted = [...pts].sort((a, b) => a.y - b.y || a.x - b.x)
    const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x)
    const bottom = sorted.slice(2).sort((a, b) => a.x - b.x)
    return [top[0], top[1], bottom[1], bottom[0]]
  }

  function lerp(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }

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

  function toGray(data, w, h) {
    const gray = new Float32Array(w * h)
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114
    }
    return gray
  }

  function boxBlur(gray, w, h, r = 1) {
    const tmp = new Float32Array(w * h)
    const out = new Float32Array(w * h)
    const span = r * 2 + 1
    for (let y = 0; y < h; y++) {
      let sum = 0
      for (let x = -r; x <= r; x++) sum += gray[y * w + clamp(x, 0, w - 1)]
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / span
        const leave = gray[y * w + clamp(x - r, 0, w - 1)]
        const enter = gray[y * w + clamp(x + r + 1, 0, w - 1)]
        sum += enter - leave
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let y = -r; y <= r; y++) sum += tmp[clamp(y, 0, h - 1) * w + x]
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / span
        const leave = tmp[clamp(y - r, 0, h - 1) * w + x]
        const enter = tmp[clamp(y + r + 1, 0, h - 1) * w + x]
        sum += enter - leave
      }
    }
    return out
  }

  function sobelMag(gray, w, h) {
    const mag = new Float32Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        const gx =
          -gray[i - w - 1] +
          gray[i - w + 1] -
          2 * gray[i - 1] +
          2 * gray[i + 1] -
          gray[i + w - 1] +
          gray[i + w + 1]
        const gy =
          -gray[i - w - 1] -
          2 * gray[i - w] -
          gray[i - w + 1] +
          gray[i + w - 1] +
          2 * gray[i + w] +
          gray[i + w + 1]
        mag[i] = Math.hypot(gx, gy)
      }
    }
    return mag
  }

  function sampleEdge(mag, w, h, x0, y0, x1, y1, steps) {
    let sum = 0
    let n = 0
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = (x0 + (x1 - x0) * t) | 0
      const y = (y0 + (y1 - y0) * t) | 0
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue
      sum += mag[y * w + x]
      n++
    }
    return n ? sum / n : 0
  }

  /** Score an axis-aligned page rectangle as a 3×3 pocket grid using edge energy. */
  function scoreGrid(mag, w, h, x, y, pw, ph) {
    if (pw < 40 || ph < 40) return 0
    if (x < 1 || y < 1 || x + pw >= w - 1 || y + ph >= h - 1) return 0

    let score = 0
    // Outer border (strong weight)
    score += sampleEdge(mag, w, h, x, y, x + pw, y, 28) * 1.4
    score += sampleEdge(mag, w, h, x, y + ph, x + pw, y + ph, 28) * 1.4
    score += sampleEdge(mag, w, h, x, y, x, y + ph, 28) * 1.4
    score += sampleEdge(mag, w, h, x + pw, y, x + pw, y + ph, 28) * 1.4

    // Inner 3×3 dividers
    for (let i = 1; i < 3; i++) {
      const gx = x + (pw * i) / 3
      const gy = y + (ph * i) / 3
      score += sampleEdge(mag, w, h, gx, y, gx, y + ph, 24) * 1.8
      score += sampleEdge(mag, w, h, x, gy, x + pw, gy, 24) * 1.8
    }

    // Prefer page-like aspect (binder page of 3×3 cards ≈ 0.72–0.95 depending on margins)
    const aspect = pw / ph
    const aspectPenalty = Math.abs(aspect - 0.78)
    score *= 1 / (1 + aspectPenalty * 2.5)

    // Prefer larger grids that still fit
    score *= 0.65 + 0.35 * (pw * ph) / (w * h)
    return score
  }

  function searchEdgeGrid(mag, w, h) {
    let best = null
    let bestScore = 0

    // Coarse search over scale + position
    const scales = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52]
    for (const s of scales) {
      const ph = h * s
      const pw = ph * 0.78
      if (pw > w * 0.96) continue
      const stepX = Math.max(6, (w - pw) / 8)
      const stepY = Math.max(6, (h - ph) / 8)
      for (let y = h * 0.02; y + ph < h * 0.98; y += stepY) {
        for (let x = w * 0.02; x + pw < w * 0.98; x += stepX) {
          const score = scoreGrid(mag, w, h, x, y, pw, ph)
          if (score > bestScore) {
            bestScore = score
            best = { x, y, pw, ph, score }
          }
        }
      }
      // Also try slightly wider pages
      const pw2 = Math.min(w * 0.94, ph * 0.9)
      const stepX2 = Math.max(6, (w - pw2) / 8)
      for (let y = h * 0.02; y + ph < h * 0.98; y += stepY) {
        for (let x = w * 0.02; x + pw2 < w * 0.98; x += stepX2) {
          const score = scoreGrid(mag, w, h, x, y, pw2, ph)
          if (score > bestScore) {
            bestScore = score
            best = { x, y, pw: pw2, ph, score }
          }
        }
      }
    }

    if (!best) return null

    // Local refine
    let { x, y, pw, ph } = best
    for (let iter = 0; iter < 6; iter++) {
      let improved = false
      for (const [dx, dy, dpw, dph] of [
        [2, 0, 0, 0],
        [-2, 0, 0, 0],
        [0, 2, 0, 0],
        [0, -2, 0, 0],
        [0, 0, 4, 0],
        [0, 0, -4, 0],
        [0, 0, 0, 4],
        [0, 0, 0, -4],
        [1, 1, 0, 0],
        [-1, -1, 0, 0],
      ]) {
        const nx = x + dx
        const ny = y + dy
        const npw = pw + dpw
        const nph = ph + dph
        const score = scoreGrid(mag, w, h, nx, ny, npw, nph)
        if (score > bestScore) {
          bestScore = score
          x = nx
          y = ny
          pw = npw
          ph = nph
          improved = true
        }
      }
      if (!improved) break
    }

    // Normalize score roughly into 0..1 using a soft reference
    const conf = clamp(bestScore / 180, 0.2, 0.98)
    const quad = [
      { x, y },
      { x: x + pw, y },
      { x: x + pw, y: y + ph },
      { x, y: y + ph },
    ]
    return { quad, confidence: conf, source: "edge-grid", score: bestScore }
  }

  /** Find card-like rectangles from strong edge blobs / bounding boxes of high-edge cells. */
  function findCardBoxes(mag, w, h) {
    // Threshold top edges
    let max = 0
    for (let i = 0; i < mag.length; i++) if (mag[i] > max) max = mag[i]
    const thr = max * 0.22
    const bin = new Uint8ClampedArray(w * h)
    for (let i = 0; i < mag.length; i++) bin[i] = mag[i] >= thr ? 1 : 0

    // Dilate lightly to connect card borders
    const dil = new Uint8ClampedArray(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let v = 0
        for (let dy = -1; dy <= 1 && !v; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (bin[(y + dy) * w + (x + dx)]) {
              v = 1
              break
            }
          }
        }
        dil[y * w + x] = v
      }
    }

    const visited = new Uint8ClampedArray(w * h)
    const boxes = []
    const frameArea = w * h

    for (let y = 2; y < h - 2; y += 2) {
      for (let x = 2; x < w - 2; x += 2) {
        const i = y * w + x
        if (!dil[i] || visited[i]) continue
        // flood
        const stack = [[x, y]]
        visited[i] = 1
        let minX = x
        let maxX = x
        let minY = y
        let maxY = y
        let count = 0
        while (stack.length) {
          const [cx, cy] = stack.pop()
          count++
          minX = Math.min(minX, cx)
          maxX = Math.max(maxX, cx)
          minY = Math.min(minY, cy)
          maxY = Math.max(maxY, cy)
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue
              const nx = cx + dx
              const ny = cy + dy
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
              const ni = ny * w + nx
              if (!dil[ni] || visited[ni]) continue
              visited[ni] = 1
              stack.push([nx, ny])
            }
          }
        }
        const bw = maxX - minX + 1
        const bh = maxY - minY + 1
        const area = bw * bh
        if (area < frameArea * 0.012 || area > frameArea * 0.28) continue
        const aspect = bw / Math.max(1, bh)
        // Card aspect ~0.72, allow perspective
        if (aspect < 0.5 || aspect > 0.95) continue
        const fill = count / area
        // Borders are hollow-ish; accept low fill
        if (fill < 0.05 || fill > 0.85) continue
        boxes.push({
          x: minX,
          y: minY,
          w: bw,
          h: bh,
          cx: minX + bw / 2,
          cy: minY + bh / 2,
          area,
        })
      }
    }

    // Prefer medium boxes; suppress nested duplicates
    boxes.sort((a, b) => b.area - a.area)
    const kept = []
    for (const b of boxes) {
      const inside = kept.some((k) => {
        const ix = Math.max(0, Math.min(b.x + b.w, k.x + k.w) - Math.max(b.x, k.x))
        const iy = Math.max(0, Math.min(b.y + b.h, k.y + k.h) - Math.max(b.y, k.y))
        const inter = ix * iy
        return inter > b.area * 0.55
      })
      if (!inside) kept.push(b)
      if (kept.length >= 12) break
    }
    return kept
  }

  function gridFromCardBoxes(boxes, w, h) {
    if (boxes.length < 3) return null
    // Use median card size
    const widths = boxes.map((b) => b.w).sort((a, b) => a - b)
    const heights = boxes.map((b) => b.h).sort((a, b) => a - b)
    const mw = widths[(widths.length / 2) | 0]
    const mh = heights[(heights.length / 2) | 0]

    // Cluster centers into rows by y
    const sorted = [...boxes].sort((a, b) => a.cy - b.cy || a.cx - b.cx)
    const rows = []
    const rowTol = mh * 0.45
    for (const b of sorted) {
      const row = rows.find((r) => Math.abs(r.y - b.cy) < rowTol)
      if (row) {
        row.items.push(b)
        row.y = (row.y * (row.items.length - 1) + b.cy) / row.items.length
      } else {
        rows.push({ y: b.cy, items: [b] })
      }
    }
    rows.sort((a, b) => a.y - b.y)
    if (rows.length < 2) return null

    // Take up to 3 densest / most evenly spaced rows
    const topRows = rows.slice(0, 3)
    while (topRows.length < 3 && rows.length > topRows.length) {
      topRows.push(rows[topRows.length])
    }

    for (const row of topRows) row.items.sort((a, b) => a.cx - b.cx)

    const xs = topRows.flatMap((r) => r.items.map((i) => i.cx))
    const ys = topRows.map((r) => r.y)
    if (!xs.length) return null

    const minCX = Math.min(...xs)
    const maxCX = Math.max(...xs)
    const minCY = Math.min(...ys)
    const maxCY = Math.max(...ys)

    // Expand from centers to page bounds using median card size
    const x0 = clamp(minCX - mw * 0.55, 2, w - 4)
    const x1 = clamp(maxCX + mw * 0.55, x0 + 20, w - 2)
    const y0 = clamp(minCY - mh * 0.55, 2, h - 4)
    const y1 = clamp(maxCY + mh * 0.55, y0 + 20, h - 2)

    // If we only saw a partial page, expand to a full 3×3 using card pitch
    let pw = x1 - x0
    let ph = y1 - y0
    const pitchX = mw * 1.08
    const pitchY = mh * 1.08
    if (boxes.length <= 6) {
      pw = Math.max(pw, pitchX * 3)
      ph = Math.max(ph, pitchY * 3)
    }
    // Recenter
    let cx = (x0 + x1) / 2
    let cy = (y0 + y1) / 2
    let nx0 = clamp(cx - pw / 2, 2, w - pw - 2)
    let ny0 = clamp(cy - ph / 2, 2, h - ph - 2)

    const conf = clamp(0.35 + boxes.length * 0.07, 0.35, 0.95)
    const quad = [
      { x: nx0, y: ny0 },
      { x: nx0 + pw, y: ny0 },
      { x: nx0 + pw, y: ny0 + ph },
      { x: nx0, y: ny0 + ph },
    ]
    return { quad, confidence: conf, source: "card-boxes", boxCount: boxes.length }
  }

  function detectWithOpenCv(cv, imageData) {
    // Build ImageData Mat manually — matFromImageData is missing in some builds.
    const src = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4)
    src.data.set(imageData.data)
    const gray = new cv.Mat()
    const blur = new cv.Mat()
    const edges = new cv.Mat()
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)
      cv.Canny(blur, edges, 50, 140)
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

      const cards = []
      const pages = []
      const frameArea = imageData.width * imageData.height

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i)
        const peri = cv.arcLength(cnt, true)
        const approx = new cv.Mat()
        cv.approxPolyDP(cnt, approx, 0.03 * peri, true)
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const area = Math.abs(cv.contourArea(approx))
          const pts = []
          for (let r = 0; r < 4; r++) {
            const ix = r * 2
            pts.push({ x: approx.data32S[ix], y: approx.data32S[ix + 1] })
          }
          const ordered = orderCorners(pts)
          const bw = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y)
          const bh = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y)
          const aspect = bw / Math.max(1, bh)
          if (area > frameArea * 0.2 && area < frameArea * 0.95 && aspect > 0.55 && aspect < 1.2) {
            pages.push({ quad: ordered, area })
          } else if (area > frameArea * 0.012 && area < frameArea * 0.22 && aspect > 0.5 && aspect < 0.95) {
            cards.push({
              cx: (ordered[0].x + ordered[2].x) / 2,
              cy: (ordered[0].y + ordered[2].y) / 2,
              w: bw,
              h: bh,
              area,
            })
          }
        }
        approx.delete()
      }

      pages.sort((a, b) => b.area - a.area)
      if (pages[0]) {
        return {
          quad: pages[0].quad,
          confidence: clamp(pages[0].area / frameArea + 0.2, 0.45, 0.98),
          source: "opencv-page",
        }
      }
      if (cards.length >= 3) {
        const fitted = gridFromCardBoxes(cards, imageData.width, imageData.height)
        if (fitted) return { ...fitted, source: "opencv-cards" }
      }
      return null
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
    const { width: w, height: h, data } = imageData
    const gray = boxBlur(toGray(data, w, h), w, h, 1)
    const mag = sobelMag(gray, w, h)

    const candidates = []

    // OpenCV first if available
    const cv = global.cv
    if (opts.preferOpenCv !== false && cv && cv.Mat) {
      try {
        const ocv = detectWithOpenCv(cv, imageData)
        if (ocv) candidates.push(ocv)
      } catch {
        // ignore
      }
    }

    const edge = searchEdgeGrid(mag, w, h)
    if (edge) candidates.push(edge)

    const boxes = findCardBoxes(mag, w, h)
    const fromBoxes = gridFromCardBoxes(boxes, w, h)
    if (fromBoxes) candidates.push(fromBoxes)

    candidates.sort((a, b) => b.confidence - a.confidence)
    const best = candidates[0]
    if (best) {
      return {
        quad: best.quad,
        slots: slotsFromQuad(best.quad),
        confidence: best.confidence,
        source: best.source,
        debug: { boxes: boxes.length, candidates: candidates.map((c) => c.source) },
      }
    }

    const quad = defaultQuad(w, h)
    return {
      quad,
      slots: slotsFromQuad(quad),
      confidence: 0.3,
      source: "fallback",
      debug: { boxes: boxes.length, candidates: [] },
    }
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
      max = Math.max(max, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y))
    }
    return max
  }

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
    const out = document.createElement("canvas")
    out.width = outW
    out.height = outH
    const octx = out.getContext("2d")
    octx.drawImage(sourceCanvas, minX, minY, bw, bh, 0, 0, outW, outH)
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
