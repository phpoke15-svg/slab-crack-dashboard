;(function (global) {
  function money(n) {
    if (n == null || !Number.isFinite(n) || n <= 0) return "—"
    return `$${n.toFixed(2)}`
  }

  function drawQuad(ctx, corners, stroke, width) {
    if (!corners || corners.length < 4) return
    ctx.beginPath()
    ctx.moveTo(corners[0].x, corners[0].y)
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y)
    ctx.closePath()
    ctx.strokeStyle = stroke
    ctx.lineWidth = width
    ctx.stroke()
  }

  function draw(ctx, state) {
    const { width, height } = ctx.canvas
    ctx.clearRect(0, 0, width, height)

    const quad = state.quad
    const slots = state.slots || []
    const priced = state.pricedBySlot || {}
    const identified = state.identifiedBySlot || {}
    const locked = Boolean(state.locked)

    // Page outline
    if (quad && quad.length === 4) {
      ctx.save()
      ctx.shadowColor = locked ? "rgba(61, 214, 140, 0.45)" : "rgba(240, 195, 90, 0.35)"
      ctx.shadowBlur = 10
      drawQuad(
        ctx,
        quad,
        locked ? "rgba(80, 220, 140, 0.95)" : "rgba(255, 210, 80, 0.9)",
        Math.max(2.5, width * 0.0035),
      )
      ctx.restore()
    }

    // Always draw the 9 pocket / card outlines
    for (const slot of slots) {
      const hasId = Boolean(priced[slot.slot] || identified[slot.slot])
      const stroke = hasId
        ? "rgba(125, 255, 168, 0.95)"
        : locked
          ? "rgba(120, 230, 170, 0.85)"
          : "rgba(255, 220, 120, 0.8)"
      drawQuad(ctx, slot.corners, stroke, Math.max(2, width * 0.0024))

      // Slot index chip
      const c = slot.center
      ctx.save()
      ctx.fillStyle = locked ? "rgba(61, 214, 140, 0.9)" : "rgba(240, 195, 90, 0.9)"
      ctx.beginPath()
      ctx.arc(slot.corners[0].x + 12, slot.corners[0].y + 12, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#0b0f14"
      ctx.font = `700 ${Math.max(10, width * 0.012)}px "IBM Plex Sans", system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(slot.slot), slot.corners[0].x + 12, slot.corners[0].y + 12)
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
      ctx.fillStyle = "rgba(8, 12, 18, 0.82)"
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)"
      ctx.lineWidth = 1
      roundRect(ctx, x, y, boxW, boxH, 8)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = "#f4f7fb"
      ctx.font = `600 ${Math.max(11, width * 0.014)}px "IBM Plex Sans", system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      ctx.fillText(truncate(info.name || info.productName || "Card", 22), c.x, y + 8)

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
      ctx.fillRect(12, 12, Math.min(width - 24, 460), 36)
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
