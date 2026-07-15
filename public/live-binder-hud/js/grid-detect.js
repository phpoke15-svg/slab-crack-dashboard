/**
 * Local card detection (browser only — never calls Gemini).
 * Finds however many card-shaped rectangles are in frame (1–9), not a fixed 3×3.
 */
;(function (global) {
  const MAX_CARDS = 9
  const CARD_ASPECT = 63 / 88 // ≈ 0.716
  const TRACK_DIST = 0.12 // fraction of frame diagonal to match tracks
  const LOST_FRAMES = 8

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v))
  }

  function orderCorners(pts) {
    const sorted = [...pts].sort((a, b) => a.y - b.y || a.x - b.x)
    const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x)
    const bottom = sorted.slice(2).sort((a, b) => a.x - b.x)
    return [top[0], top[1], bottom[1], bottom[0]]
  }

  function boxCorners(x, y, w, h) {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ]
  }

  function boxCenter(b) {
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  }

  function sortReadingOrder(boxes) {
    if (!boxes.length) return []
    const heights = boxes.map((b) => b.h).sort((a, b) => a - b)
    const medH = heights[(heights.length / 2) | 0] || 1
    const rowTol = medH * 0.45
    const rows = []
    const byY = [...boxes].sort((a, b) => a.cy - b.cy || a.cx - b.cx)
    for (const b of byY) {
      const row = rows.find((r) => Math.abs(r.y - b.cy) < rowTol)
      if (row) {
        row.items.push(b)
        row.y = (row.y * (row.items.length - 1) + b.cy) / row.items.length
      } else {
        rows.push({ y: b.cy, items: [b] })
      }
    }
    rows.sort((a, b) => a.y - b.y)
    const ordered = []
    for (const row of rows) {
      row.items.sort((a, b) => a.cx - b.cx)
      ordered.push(...row.items)
    }
    return ordered
  }

  function toSlots(boxes) {
    return boxes.slice(0, MAX_CARDS).map((b, i) => ({
      slot: i + 1,
      corners: boxCorners(b.x, b.y, b.w, b.h),
      center: { x: b.cx, y: b.cy },
      box: { x: b.x, y: b.y, w: b.w, h: b.h },
      confidence: b.confidence ?? 0.6,
      trackId: b.trackId,
    }))
  }

  function envelopeQuad(boxes, w, h) {
    if (!boxes.length) return null
    const pad = Math.max(6, Math.min(w, h) * 0.02)
    const minX = clamp(Math.min(...boxes.map((b) => b.x)) - pad, 0, w - 1)
    const minY = clamp(Math.min(...boxes.map((b) => b.y)) - pad, 0, h - 1)
    const maxX = clamp(Math.max(...boxes.map((b) => b.x + b.w)) + pad, minX + 1, w)
    const maxY = clamp(Math.max(...boxes.map((b) => b.y + b.h)) + pad, minY + 1, h)
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ]
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
        sum += gray[y * w + clamp(x + r + 1, 0, w - 1)] - gray[y * w + clamp(x - r, 0, w - 1)]
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let y = -r; y <= r; y++) sum += tmp[clamp(y, 0, h - 1) * w + x]
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / span
        sum += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x]
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

  function isCardLike(bw, bh, frameArea, area) {
    if (area < frameArea * 0.01 || area > frameArea * 0.45) return false
    const aspect = bw / Math.max(1, bh)
    // Allow perspective / sleeves
    if (aspect < 0.48 || aspect > 0.95) return false
    // Prefer near Pokémon card ratio
    const ratioErr = Math.abs(aspect - CARD_ASPECT)
    return ratioErr < 0.28
  }

  function findCardBoxes(mag, w, h) {
    let max = 0
    for (let i = 0; i < mag.length; i++) if (mag[i] > max) max = mag[i]
    if (max < 1) return []

    // Multi-threshold to catch faint + strong borders
    const thresholds = [0.18, 0.28, 0.38].map((t) => max * t)
    const all = []

    for (const thr of thresholds) {
      const bin = new Uint8ClampedArray(w * h)
      for (let i = 0; i < mag.length; i++) bin[i] = mag[i] >= thr ? 1 : 0

      // Dilate to close card borders
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
      const frameArea = w * h
      for (let y = 2; y < h - 2; y += 2) {
        for (let x = 2; x < w - 2; x += 2) {
          const i = y * w + x
          if (!dil[i] || visited[i]) continue
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
          if (!isCardLike(bw, bh, frameArea, area)) continue
          const fill = count / area
          // Card borders are hollow rings; interior cards can be denser
          if (fill < 0.04 || fill > 0.9) continue
          const aspect = bw / bh
          const conf = clamp(0.35 + (1 - Math.abs(aspect - CARD_ASPECT)) * 0.4 + fill * 0.15, 0.3, 0.95)
          all.push({
            x: minX,
            y: minY,
            w: bw,
            h: bh,
            cx: minX + bw / 2,
            cy: minY + bh / 2,
            area,
            confidence: conf,
          })
        }
      }
    }

    // NMS — keep distinct cards
    all.sort((a, b) => b.confidence - a.confidence || b.area - a.area)
    const kept = []
    for (const b of all) {
      const overlaps = kept.some((k) => {
        const ix = Math.max(0, Math.min(b.x + b.w, k.x + k.w) - Math.max(b.x, k.x))
        const iy = Math.max(0, Math.min(b.y + b.h, k.y + k.h) - Math.max(b.y, k.y))
        const inter = ix * iy
        const uni = b.area + k.area - inter
        return uni > 0 && inter / uni > 0.35
      })
      if (!overlaps) kept.push(b)
      if (kept.length >= MAX_CARDS) break
    }
    return kept
  }

  function detectWithOpenCv(cv, imageData) {
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
      cv.Canny(blur, edges, 45, 130)
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

      const cards = []
      const frameArea = imageData.width * imageData.height
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i)
        const peri = cv.arcLength(cnt, true)
        const approx = new cv.Mat()
        cv.approxPolyDP(cnt, approx, 0.03 * peri, true)
        let box = null
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const area = Math.abs(cv.contourArea(approx))
          const pts = []
          for (let r = 0; r < 4; r++) {
            pts.push({ x: approx.data32S[r * 2], y: approx.data32S[r * 2 + 1] })
          }
          const ordered = orderCorners(pts)
          const bw = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y)
          const bh = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y)
          if (isCardLike(bw, bh, frameArea, area)) {
            const xs = ordered.map((p) => p.x)
            const ys = ordered.map((p) => p.y)
            const x = Math.min(...xs)
            const y = Math.min(...ys)
            const w = Math.max(...xs) - x
            const h = Math.max(...ys) - y
            box = {
              x,
              y,
              w,
              h,
              cx: x + w / 2,
              cy: y + h / 2,
              area: w * h,
              confidence: clamp(0.5 + area / frameArea, 0.45, 0.96),
            }
          }
        } else {
          // Rotated rect fallback
          const rect = cv.boundingRect(cnt)
          const area = rect.width * rect.height
          if (isCardLike(rect.width, rect.height, frameArea, area)) {
            box = {
              x: rect.x,
              y: rect.y,
              w: rect.width,
              h: rect.height,
              cx: rect.x + rect.width / 2,
              cy: rect.y + rect.height / 2,
              area,
              confidence: 0.42,
            }
          }
        }
        approx.delete()
        if (box) cards.push(box)
      }

      cards.sort((a, b) => b.confidence - a.confidence || b.area - a.area)
      const kept = []
      for (const b of cards) {
        const overlaps = kept.some((k) => {
          const ix = Math.max(0, Math.min(b.x + b.w, k.x + k.w) - Math.max(b.x, k.x))
          const iy = Math.max(0, Math.min(b.y + b.h, k.y + k.h) - Math.max(b.y, k.y))
          const inter = ix * iy
          const uni = b.area + k.area - inter
          return uni > 0 && inter / uni > 0.35
        })
        if (!overlaps) kept.push(b)
        if (kept.length >= MAX_CARDS) break
      }
      return kept
    } finally {
      src.delete()
      gray.delete()
      blur.delete()
      edges.delete()
      contours.delete()
      hierarchy.delete()
    }
  }

  /** Persistent tracker across frames. */
  const tracker = {
    nextId: 1,
    tracks: [], // { id, x, y, w, h, cx, cy, missing, confidence }
  }

  function updateTracks(detections, w, h) {
    const diag = Math.hypot(w, h)
    const maxDist = diag * TRACK_DIST
    const used = new Set()

    for (const t of tracker.tracks) t.missing += 1

    // Greedy match by nearest center
    const pairs = []
    for (let ti = 0; ti < tracker.tracks.length; ti++) {
      const t = tracker.tracks[ti]
      for (let di = 0; di < detections.length; di++) {
        const d = detections[di]
        const dist = Math.hypot(t.cx - d.cx, t.cy - d.cy)
        if (dist <= maxDist) pairs.push({ ti, di, dist })
      }
    }
    pairs.sort((a, b) => a.dist - b.dist)
    const matchedT = new Set()
    const matchedD = new Set()
    for (const p of pairs) {
      if (matchedT.has(p.ti) || matchedD.has(p.di)) continue
      matchedT.add(p.ti)
      matchedD.add(p.di)
      used.add(p.di)
      const t = tracker.tracks[p.ti]
      const d = detections[p.di]
      const a = 0.35
      t.x = t.x * (1 - a) + d.x * a
      t.y = t.y * (1 - a) + d.y * a
      t.w = t.w * (1 - a) + d.w * a
      t.h = t.h * (1 - a) + d.h * a
      t.cx = t.x + t.w / 2
      t.cy = t.y + t.h / 2
      t.confidence = d.confidence
      t.missing = 0
    }

    for (let di = 0; di < detections.length; di++) {
      if (used.has(di)) continue
      if (tracker.tracks.length >= MAX_CARDS) break
      const d = detections[di]
      tracker.tracks.push({
        id: tracker.nextId++,
        x: d.x,
        y: d.y,
        w: d.w,
        h: d.h,
        cx: d.cx,
        cy: d.cy,
        confidence: d.confidence,
        missing: 0,
      })
    }

    tracker.tracks = tracker.tracks.filter((t) => t.missing <= LOST_FRAMES)
    // Cap to 9 strongest / most recent
    if (tracker.tracks.length > MAX_CARDS) {
      tracker.tracks.sort((a, b) => a.missing - b.missing || b.confidence - a.confidence)
      tracker.tracks = tracker.tracks.slice(0, MAX_CARDS)
    }

    return tracker.tracks
      .filter((t) => t.missing <= 2)
      .map((t) => ({
        x: t.x,
        y: t.y,
        w: t.w,
        h: t.h,
        cx: t.cx,
        cy: t.cy,
        area: t.w * t.h,
        confidence: t.confidence,
        trackId: t.id,
      }))
  }

  function mergeDetections(a, b) {
    const all = [...a, ...b]
    all.sort((x, y) => y.confidence - x.confidence || y.area - x.area)
    const kept = []
    for (const box of all) {
      const overlaps = kept.some((k) => {
        const ix = Math.max(0, Math.min(box.x + box.w, k.x + k.w) - Math.max(box.x, k.x))
        const iy = Math.max(0, Math.min(box.y + box.h, k.y + k.h) - Math.max(box.y, k.y))
        const inter = ix * iy
        const uni = box.area + k.area - inter
        return uni > 0 && inter / uni > 0.35
      })
      if (!overlaps) kept.push(box)
      if (kept.length >= MAX_CARDS) break
    }
    return kept
  }

  /**
   * @returns {{
   *   cards: Array,
   *   slots: Array,
   *   quad: Array|null,
   *   count: number,
   *   confidence: number,
   *   source: string,
   *   locked: boolean
   * }}
   */
  function detectCards(imageData, opts = {}) {
    const { width: w, height: h, data } = imageData
    const gray = boxBlur(toGray(data, w, h), w, h, 1)
    const mag = sobelMag(gray, w, h)

    let detections = findCardBoxes(mag, w, h)
    let source = "canvas"

    const cv = global.cv
    if (opts.preferOpenCv !== false && cv && cv.Mat) {
      try {
        const ocv = detectWithOpenCv(cv, imageData)
        if (ocv.length) {
          detections = mergeDetections(detections, ocv)
          source = detections.length === ocv.length ? "opencv" : "hybrid"
        }
      } catch {
        // keep canvas detections
      }
    }

    const tracked = updateTracks(detections, w, h)
    const ordered = sortReadingOrder(tracked)
    const slots = toSlots(ordered)
    const avgConf = ordered.length
      ? ordered.reduce((s, b) => s + (b.confidence || 0.5), 0) / ordered.length
      : 0

    return {
      cards: ordered,
      slots,
      quad: envelopeQuad(ordered, w, h),
      count: ordered.length,
      confidence: ordered.length ? avgConf : 0,
      source: ordered.length ? source : "none",
      locked: ordered.length > 0 && avgConf >= 0.4,
    }
  }

  /** @deprecated use detectCards — kept for callers expecting a page grid */
  function detectGrid(imageData, opts) {
    return detectCards(imageData, opts)
  }

  function slotsFromQuad() {
    return []
  }

  function smoothQuad(prev, next, alpha = 0.35) {
    if (!next) return prev
    if (!prev) return next
    return next.map((p, i) => ({
      x: (prev[i]?.x ?? p.x) * (1 - alpha) + p.x * alpha,
      y: (prev[i]?.y ?? p.y) * (1 - alpha) + p.y * alpha,
    }))
  }

  function quadMotion(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity
    let max = 0
    for (let i = 0; i < a.length; i++) {
      max = Math.max(max, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y))
    }
    return max
  }

  /** Average center motion between two slot lists (matched by slot index). */
  function slotsMotion(prev, next) {
    if (!prev?.length || !next?.length) return Infinity
    if (prev.length !== next.length) return Infinity
    let max = 0
    for (let i = 0; i < next.length; i++) {
      max = Math.max(
        max,
        Math.hypot(prev[i].center.x - next[i].center.x, prev[i].center.y - next[i].center.y),
      )
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

  function resetTracker() {
    tracker.tracks = []
    tracker.nextId = 1
  }

  function mapQuad(quad, u, v) {
    if (!quad) return { x: 0, y: 0 }
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    const top = lerp(quad[0], quad[1], u)
    const bottom = lerp(quad[3], quad[2], u)
    return lerp(top, bottom, v)
  }

  function defaultQuad() {
    return null
  }

  global.BinderGrid = {
    MAX_CARDS,
    SLOT_COUNT: MAX_CARDS,
    detectCards,
    detectGrid,
    slotsFromQuad,
    smoothQuad,
    quadMotion,
    slotsMotion,
    cropSlot,
    resetTracker,
    defaultQuad,
    mapQuad,
  }
})(window)
