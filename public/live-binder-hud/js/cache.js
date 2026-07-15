;(function (global) {
  const PREFIX = "lbhud:v2:"

  function cardKey(card) {
    const name = String(card.name || "")
      .toLowerCase()
      .trim()
    const set = String(card.set || "")
      .toLowerCase()
      .trim()
    const number = String(card.number || "")
      .toLowerCase()
      .trim()
    return `${PREFIX}price:${name}|${set}|${number}`
  }

  function pageKey(cards) {
    const sig = cards
      .map((c) => `${c.slot}:${c.name}:${c.set}:${c.number}`)
      .join(";")
    return `${PREFIX}page:${sig}`
  }

  function read(key) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify({ ...value, cachedAt: Date.now() }))
    } catch {
      // quota / private mode
    }
  }

  function getPrice(card) {
    return read(cardKey(card))
  }

  function setPrice(card, payload) {
    write(cardKey(card), payload)
  }

  function getPage(cards) {
    return read(pageKey(cards))
  }

  function setPage(cards, payload) {
    write(pageKey(cards), payload)
  }

  function clearAll() {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  }

  global.BinderCache = { getPrice, setPrice, getPage, setPage, clearAll, cardKey }
})(window)
