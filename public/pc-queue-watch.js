(function () {
  if (window.__pcQueueWatchActive) return
  window.__pcQueueWatchActive = true

  var params = new URL(document.currentScript.src).searchParams
  var sessionId = params.get("sid") || "anonymous"
  var reportUrl = new URL("/api/pokemon-center/report", document.currentScript.src).toString()
  var lastLive = false
  var signals = []

  function pushSignal(id, label, confidence) {
    if (signals.some(function (s) { return s.id === id })) return
    signals.push({ id: id, label: label, confidence: confidence })
  }

  function scanDocument() {
    signals = []
    var text = document.documentElement.innerHTML
    var href = location.href

    if (/queue-it\.net/i.test(href) || /waitingroom/i.test(href)) {
      pushSignal("waiting-room-url", "Waiting room URL", 100)
    }
    if (/queue-it\.net|queue-it\.js|queueit/i.test(text)) {
      pushSignal("queue-it", "Queue-it assets", 100)
    }
    if (/virtual queue|waiting room|hi,?\s*trainer/i.test(text)) {
      pushSignal("queue-copy", "Queue page copy", 80)
    }
    if (/"pos"\s*:\s*\d+/.test(text) && /"pending"\s*:\s*1/.test(text)) {
      pushSignal("incapsula-queue", "Incapsula queue payload", 90)
    }

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
      console.log("[PC Queue Watch] Queue is LIVE")
    }
  }

  function report(state) {
    fetch(reportUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        live: state.live,
        confidence: state.confidence,
        signals: state.signals,
        pageUrl: location.href,
      }),
      keepalive: true,
    }).catch(function () {})

    if (state.live && !lastLive) notifyLive()
    lastLive = state.live
  }

  function evaluate() {
    report(scanDocument())
  }

  var originalFetch = window.fetch
  window.fetch = function () {
    var url = String(arguments[0] || "")
    if (/queue-it\.net/i.test(url)) {
      pushSignal("queue-it-fetch", "Queue-it fetch", 100)
      report({ live: true, confidence: 100, signals: signals.slice() })
    }
    return originalFetch.apply(this, arguments)
  }

  var originalOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    if (/queue-it\.net/i.test(String(url))) {
      pushSignal("queue-it-xhr", "Queue-it XHR", 100)
      report({ live: true, confidence: 100, signals: signals.slice() })
    }
    return originalOpen.apply(this, arguments)
  }

  var observer = new MutationObserver(function () {
    evaluate()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })

  window.addEventListener("hashchange", evaluate)
  window.addEventListener("popstate", evaluate)
  setInterval(evaluate, 3000)
  evaluate()

  var badge = document.createElement("div")
  badge.textContent = "PC Queue Watch active"
  badge.style.cssText =
    "position:fixed;bottom:12px;right:12px;z-index:2147483647;padding:8px 12px;border-radius:999px;background:#111827;color:#f9fafb;font:600 12px/1.2 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);"
  document.documentElement.appendChild(badge)
})()
