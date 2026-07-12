(function () {
  if (window.__pcQueueWatchActive) return
  window.__pcQueueWatchActive = true

  var params = new URL(document.currentScript.src).searchParams
  var sessionId = params.get("sid") || "anonymous"
  var watchToken = params.get("tok") || ""
  var reportUrl = new URL("/api/pokemon-center/report", document.currentScript.src).toString()
  var lastLive = false
  var lastReportedLive = null
  var lastReportAt = 0
  var stickySignals = []
  var mutateTimer = null
  var HEARTBEAT_MS = 15000
  var SCAN_MS = 4000
  var MUTATE_DEBOUNCE_MS = 750

  var badge = document.createElement("div")
  badge.textContent = "PokeWatch active"
  badge.style.cssText =
    "position:fixed;bottom:12px;right:12px;z-index:2147483647;padding:8px 12px;border-radius:999px;background:#111827;color:#f9fafb;font:600 12px/1.2 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);"
  document.documentElement.appendChild(badge)

  function pushSignal(bucket, id, label, confidence) {
    if (bucket.some(function (s) { return s.id === id })) return
    bucket.push({ id: id, label: label, confidence: confidence })
  }

  function mergeSignals(domSignals) {
    var merged = []
    stickySignals.forEach(function (s) {
      pushSignal(merged, s.id, s.label, s.confidence)
    })
    domSignals.forEach(function (s) {
      pushSignal(merged, s.id, s.label, s.confidence)
    })
    return merged
  }

  function rememberSticky(id, label, confidence) {
    pushSignal(stickySignals, id, label, confidence)
  }

  function scanDocument() {
    var domSignals = []
    var text = document.documentElement.innerHTML
    var href = location.href

    if (/queue-it\.net/i.test(href) || /waitingroom|waiting-room/i.test(href)) {
      pushSignal(domSignals, "waiting-room-url", "Waiting room URL", 100)
    }
    if (/queue-it\.net|queue-it\.js|queueit/i.test(text)) {
      pushSignal(domSignals, "queue-it", "Queue-it assets", 100)
    }
    if (/virtual queue|waiting room|hi,?\s*trainer/i.test(text)) {
      pushSignal(domSignals, "queue-copy", "Queue page copy", 80)
    }
    if (/"pos"\s*:\s*\d+/.test(text) && /"pending"\s*:\s*1/.test(text)) {
      pushSignal(domSignals, "incapsula-queue", "Incapsula queue payload", 90)
    }

    var nodes = document.querySelectorAll("script[src], iframe[src], link[href]")
    for (var i = 0; i < nodes.length; i++) {
      var src = nodes[i].src || nodes[i].href || ""
      if (/queue-it\.net/i.test(src)) {
        pushSignal(domSignals, "queue-it-asset", "Queue-it page asset", 100)
        break
      }
    }

    var signals = mergeSignals(domSignals)
    var confidence = signals.reduce(function (max, s) { return Math.max(max, s.confidence) }, 0)
    return { live: confidence >= 60, confidence: confidence, signals: signals }
  }

  function notifyLive() {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Pokemon Center queue is LIVE", {
        body: "You are on pokemoncenter.com — join the queue now.",
        tag: "pc-queue-live",
        requireInteraction: true,
      })
    } else {
      console.log("[PokeWatch] Queue is LIVE")
    }
  }

  function report(state, force) {
    var now = Date.now()
    var changed = lastReportedLive === null || lastReportedLive !== state.live
    if (!force && !changed && now - lastReportAt < HEARTBEAT_MS) return

    var payload = {
      type: "pc-queue-watch",
      sessionId: sessionId,
      live: state.live,
      confidence: state.confidence,
      signals: state.signals,
      pageUrl: location.href,
      token: watchToken || undefined,
      source: "bookmarklet",
      checkedAt: new Date().toISOString(),
    }

    // Native app WebView bridge (Imperva-safe path)
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload))
      }
    } catch (e) {}

    var headers = { "Content-Type": "application/json" }
    if (watchToken) headers["X-Queue-Watch-Token"] = watchToken

    fetch(reportUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    }).catch(function () {})

    lastReportAt = now
    lastReportedLive = state.live

    if (state.live && !lastLive) notifyLive()
    lastLive = state.live

    badge.textContent = state.live ? "PC Queue LIVE" : "PokeWatch active"
    badge.style.background = state.live ? "#059669" : "#111827"
  }

  function evaluate(force) {
    report(scanDocument(), Boolean(force))
  }

  function onQueueNetwork(url) {
    if (!/queue-it\.net/i.test(String(url || ""))) return
    rememberSticky("queue-it-net", "Queue-it network request", 100)
    report(
      {
        live: true,
        confidence: 100,
        signals: mergeSignals([{ id: "queue-it-net", label: "Queue-it network request", confidence: 100 }]),
      },
      true,
    )
  }

  var originalFetch = window.fetch
  window.fetch = function () {
    try {
      onQueueNetwork(arguments[0] && arguments[0].url ? arguments[0].url : arguments[0])
    } catch (e) {}
    return originalFetch.apply(this, arguments)
  }

  var originalOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      onQueueNetwork(url)
    } catch (e) {}
    return originalOpen.apply(this, arguments)
  }

  if (typeof PerformanceObserver !== "undefined") {
    try {
      var po = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          onQueueNetwork(entry.name)
        })
      })
      po.observe({ entryTypes: ["resource"] })
    } catch (e) {}
  }

  var observer = new MutationObserver(function () {
    if (mutateTimer) clearTimeout(mutateTimer)
    mutateTimer = setTimeout(function () {
      evaluate(false)
    }, MUTATE_DEBOUNCE_MS)
  })
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })

  window.addEventListener("hashchange", function () { evaluate(true) })
  window.addEventListener("popstate", function () { evaluate(true) })
  setInterval(function () { evaluate(false) }, SCAN_MS)
  evaluate(true)
})()
