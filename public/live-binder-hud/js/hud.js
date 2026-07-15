;(function (global) {
  /**
   * Gemini official box_2d: [ymin, xmin, ymax, xmax] normalized 0–1000
   * → absolute pixels on the video container.
   */
  function boxToPixels(box2d, canvasWidth, canvasHeight) {
    const [ymin, xmin, ymax, xmax] = box2d
    const left = (xmin / 1000) * canvasWidth
    const top = (ymin / 1000) * canvasHeight
    const width = ((xmax - xmin) / 1000) * canvasWidth
    const height = ((ymax - ymin) / 1000) * canvasHeight
    return { left, top, width, height, ymin, xmin, ymax, xmax }
  }

  function boxToStyle(box2d, canvasWidth, canvasHeight) {
    const { left, top, width, height } = boxToPixels(box2d, canvasWidth, canvasHeight)
    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${Math.max(1, width)}px`,
      height: `${Math.max(1, height)}px`,
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

      const canvasWidth = layer.clientWidth || 1
      const canvasHeight = layer.clientHeight || 1
      console.log("[BinderHud] videoContainer size", { canvasWidth, canvasHeight })

      cards.forEach((card, index) => {
        const mapped = boxToPixels(card.box_2d, canvasWidth, canvasHeight)
        console.log("[BinderHud] mapped pixel coords", {
          index,
          name: card.name,
          box_2d: card.box_2d,
          left: mapped.left,
          top: mapped.top,
          width: mapped.width,
          height: mapped.height,
        })

        const el = document.createElement("button")
        el.type = "button"
        el.className = "card-hud" + (card.pricing ? "" : " is-loading")
        el.dataset.index = String(index)
        Object.assign(el.style, boxToStyle(card.box_2d, canvasWidth, canvasHeight))

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

    function relayout() {
      if (!cards.length) return
      render(cards)
      if (activeIndex >= 0) {
        layer.querySelector(`.card-hud[data-index="${activeIndex}"]`)?.classList.add("is-active")
      }
    }

    function updateCard(index, patch) {
      if (!cards[index]) return
      cards[index] = { ...cards[index], ...patch }
      render(cards)
      if (activeIndex >= 0) {
        layer.querySelector(`.card-hud[data-index="${activeIndex}"]`)?.classList.add("is-active")
      }
    }

    function setOnSelect(fn) {
      onSelect = fn
    }

    function getCards() {
      return cards
    }

    return { clear, render, relayout, updateCard, setOnSelect, getCards, boxToStyle, boxToPixels }
  }

  global.BinderHud = { createHud, boxToStyle, boxToPixels }
})(window)
