;(function (global) {
  /**
   * Map Gemini box_2d [ymin, xmin, ymax, xmax] (0–1000) onto the HUD layer
   * and render clickable absolute-positioned card overlays.
   */
  function boxToStyle(box2d, width, height) {
    const [ymin, xmin, ymax, xmax] = box2d
    const top = (ymin / 1000) * height
    const left = (xmin / 1000) * width
    const h = ((ymax - ymin) / 1000) * height
    const w = ((xmax - xmin) / 1000) * width
    return {
      top: `${Math.max(0, top)}px`,
      left: `${Math.max(0, left)}px`,
      width: `${Math.max(8, w)}px`,
      height: `${Math.max(8, h)}px`,
    }
  }

  function money(n) {
    if (n == null || !Number.isFinite(n) || n <= 0) return "—"
    return `$${n.toFixed(2)}`
  }

  function truncate(s, n) {
    const t = String(s || "")
    return t.length > n ? `${t.slice(0, n - 1)}…` : t
  }

  function createHud(layer) {
    let cards = []
    let activeIndex = -1
    let onSelect = null

    function clear() {
      cards = []
      activeIndex = -1
      layer.innerHTML = ""
    }

    function render(nextCards) {
      cards = Array.isArray(nextCards) ? nextCards : []
      layer.innerHTML = ""
      const w = layer.clientWidth || 1
      const h = layer.clientHeight || 1

      cards.forEach((card, index) => {
        const el = document.createElement("button")
        el.type = "button"
        el.className = "card-hud" + (card.pricing ? "" : " is-loading")
        el.dataset.index = String(index)
        const style = boxToStyle(card.box_2d, w, h)
        Object.assign(el.style, style)

        const meta = [card.set, card.number].filter(Boolean).join(" · ")
        const price = card.pricing?.prices
        const priceHtml = price
          ? `<p class="card-hud__price">NM ${money(price.rawNm)}${
              price.psa10 > 0 ? `<span>PSA10 ${money(price.psa10)}</span>` : ""
            }</p>`
          : `<p class="card-hud__price">${card.priceError ? "No price" : "Pricing…"}</p>`

        el.innerHTML = `
          <span class="card-hud__badge">${index + 1}</span>
          <div class="card-hud__panel">
            <p class="card-hud__name">${truncate(card.name, 28)}</p>
            <p class="card-hud__meta">${truncate(meta || "Unknown set", 32)}</p>
            ${priceHtml}
          </div>
        `

        el.addEventListener("click", (e) => {
          e.preventDefault()
          activeIndex = index
          layer.querySelectorAll(".card-hud").forEach((node) => node.classList.remove("is-active"))
          el.classList.add("is-active")
          if (typeof onSelect === "function") onSelect(card, index)
        })

        layer.appendChild(el)
      })
    }

    /** Relayout after viewport resize using the same card data. */
    function relayout() {
      if (!cards.length) return
      render(cards)
      if (activeIndex >= 0) {
        const el = layer.querySelector(`.card-hud[data-index="${activeIndex}"]`)
        el?.classList.add("is-active")
      }
    }

    function updateCard(index, patch) {
      if (!cards[index]) return
      cards[index] = { ...cards[index], ...patch }
      render(cards)
      if (activeIndex >= 0) {
        const el = layer.querySelector(`.card-hud[data-index="${activeIndex}"]`)
        el?.classList.add("is-active")
      }
    }

    function setOnSelect(fn) {
      onSelect = fn
    }

    function getCards() {
      return cards
    }

    return { clear, render, relayout, updateCard, setOnSelect, getCards, boxToStyle }
  }

  global.BinderHud = { createHud, boxToStyle }
})(window)
