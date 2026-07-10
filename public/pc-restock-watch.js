/**
 * Optional inject for Pokémon Center product pages (bookmarklet / WebView).
 * Reports Add-to-Cart vs OOS to CollecTools /api/restocks/report.
 *
 * Usage (bookmarklet-style):
 *   Load with ?base=https://your-host&id=pc-external-id&secret=optional
 */
;(function () {
  var params = new URL(document.currentScript.src).searchParams
  var base = (params.get("base") || "").replace(/\/$/, "")
  var externalId = params.get("id") || ""
  var secret = params.get("secret") || ""
  if (!base) {
    console.warn("[PC Restock] missing base=")
    return
  }

  function detectInStock() {
    var text = (document.body && document.body.innerText) || ""
    if (/out of stock|sold out|unavailable/i.test(text) && !/add to (bag|cart)/i.test(text)) {
      return false
    }
    if (/add to (bag|cart)/i.test(text)) return true
    var btn = document.querySelector(
      'button[data-test*="add"], button[aria-label*="Add"], button[class*="add-to"]',
    )
    if (btn && !btn.disabled) return true
    return null
  }

  function report() {
    var inStock = detectInStock()
    if (inStock === null) return

    var headers = { "Content-Type": "application/json" }
    if (secret) headers["X-Restock-Secret"] = secret

    fetch(base + "/api/restocks/report", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        retailer: "pokemon_center",
        externalId: externalId || undefined,
        productUrl: location.href,
        inStock: inStock,
        source: "pc_page_script",
      }),
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    }).catch(function () {})
  }

  report()
  setInterval(report, 20000)
})()
