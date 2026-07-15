;(function (global) {
  function money(n) {
    if (n == null || !Number.isFinite(n) || n <= 0) return "—"
    return `$${n.toFixed(2)}`
  }

  function draw(ctx, state) {
    const { width, height } = ctx.canvas
    ctx.clearRect(0, 0, width, height)

    const quad = state.quad
    const slots = state.slots || []
    const priced = state.pricedBySlot || {}
    const identified = state.identifiedBySlot || {}

    if (quad && quad.length === 4) {
      ctx.save()
      ctx.strokeStyle = state.locked ? "rgba(80, 220, 140, 0.95)" : "rgba(255, 210, 80, 0.85)"
      ctx.lineWidth = Math.max(2, width * 0.003)
      ctx.beginPath()
      ctx.moveTo(quad[0].x, quad[0].y)
      for (let i = 1; i < 4; i++) ctx.lineTo(quad[i].x, quad[i].y)
      ctx.closePath()
      ctx.stroke()

      // Inner 3×3 guides
      ctx.strokeStyle = state.locked ? "rgba(80, 220, 140, 0.35)" : "rgba(255, 210, 80, 0.3)"
      ctx.lineWidth = Math.max(1, width * 0.0015)
      for (let i = 1; i < 3; i++) {
        const a = BinderGrid.mapQuad(quad, i / 3, 0)
        const b = BinderGrid.mapQuad(quad, i / 3, 1)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        const c = BinderGrid.mapQuad(quad, 0, i / 3)
        const d = BinderGrid.mapQuad(quad, 1, i / 3)
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(d.x, d.y)
        ctx.stroke()
      }
      ctx.restore()
    }

    for (const slot of slots) {
      const info = priced[slot.slot] || identified[slot.slot]
      if (!info) continue
      const c = slot.center
      const boxW = Math.min(width * 0.22, 168)
      const boxH = info.prices ? 70 : 44
      const x = c.x - boxW / 2
      const y = c.y - boxH / 2

      ctx.save()
      ctx.fillStyle = "rgba(8, 12, 18, 0.78)"
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
      ctx.lineWidth = 1
      roundRect(ctx, x, y, boxW, boxH, 8)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = "#f4f7fb"
      ctx.font = `600 ${Math.max(11, width * 0.014)}px "IBM Plex Sans", system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      const title = truncate(info.name || info.productName || "Card", 22)
      ctx.fillText(title, c.x, y + 8)

      ctx.fillStyle = "rgba(200, 210, 220, 0.9)"
      ctx.font = `500 ${Math.max(10, width * 0.011)}px "IBM Plex Sans", system-ui, sans-serif`
      const sub = [info.set, info.number].filter(Boolean).join(" · ")
      if (sub) ctx.fillText(truncate(sub, 26), c.x, y + 26)

      if (info.prices) {
        ctx.fillStyle = "#7dffa8"
        ctx.font = `700 ${Math.max(12, width * 0.015)}px "IBM Plex Sans", system-ui, sans-serif`
        ctx.fillText(`NM ${money(info.prices.rawNm)}`, c.x, y + 44)
        if (info.prices.psa10 > 0) {
          ctx.fillStyle = "rgba(180, 220, 255, 0.95)"
          ctx.font = `600 ${Math.max(10, width * 0.011)}px "IBM Plex Sans", system-ui, sans-serif`
          ctx.fillText(`PSA10 ${money(info.prices.psa10)}`, c.x, y + 58)
        }
      }
      ctx.restore()
    }

    if (state.statusText) {
      ctx.save()
      ctx.fillStyle = "rgba(0,0,0,0.55)"
      ctx.fillRect(12, 12, Math.min(width - 24, 420), 36)
      ctx.fillStyle = "#fff"
      ctx.font = `600 ${Math.max(12, width * 0.016)}px "IBM Plex Sans", system-ui, sans-serif`
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      ctx.fillText(state.statusText, 24, 30)
      ctx.restore()
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  function truncate(s, n) {
    const t = String(s || "")
    return t.length > n ? `${t.slice(0, n - 1)}…` : t
  }

  global.BinderOverlay = { draw }
})(window)
