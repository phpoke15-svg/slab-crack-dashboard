/**
 * Injected into the Pokemon Center WebView after load.
 * Runs inside a real browser session (cookies + Imperva challenge already solved).
 * Posts heartbeats to React Native via window.ReactNativeWebView.postMessage.
 */
export const WEBVIEW_MONITOR_SCRIPT = `
(function () {
  if (window.__pcQueueWatchActive) return true;
  window.__pcQueueWatchActive = true;

  var lastLive = false;
  var lastReportedLive = null;
  var lastReportAt = 0;
  var stickySignals = [];
  var mutateTimer = null;
  var HEARTBEAT_MS = 12000;
  var SCAN_MS = 4000;
  var MUTATE_DEBOUNCE_MS = 750;

  var badge = document.createElement("div");
  badge.textContent = "PC Queue Watch active";
  badge.style.cssText =
    "position:fixed;bottom:12px;right:12px;z-index:2147483647;padding:8px 12px;border-radius:999px;background:#111827;color:#f9fafb;font:600 12px/1.2 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);";
  document.documentElement.appendChild(badge);

  function pushSignal(bucket, id, label, confidence) {
    if (bucket.some(function (s) { return s.id === id; })) return;
    bucket.push({ id: id, label: label, confidence: confidence });
  }

  function mergeSignals(domSignals) {
    var merged = [];
    stickySignals.forEach(function (s) {
      pushSignal(merged, s.id, s.label, s.confidence);
    });
    domSignals.forEach(function (s) {
      pushSignal(merged, s.id, s.label, s.confidence);
    });
    return merged;
  }

  function rememberSticky(id, label, confidence) {
    pushSignal(stickySignals, id, label, confidence);
  }

  function isBlockedPage() {
    var text = document.documentElement.innerHTML || "";
    return /_Incapsula_Resource|incident_id=|Request unsuccessful|access denied/i.test(text);
  }

  function scanDocument() {
    var domSignals = [];
    var text = document.documentElement.innerHTML;
    var href = location.href;

    if (/queue-it\\.net/i.test(href) || /waitingroom|waiting-room/i.test(href)) {
      pushSignal(domSignals, "waiting-room-url", "Waiting room URL", 100);
    }
    if (/queue-it\\.net|queue-it\\.js|queueit/i.test(text)) {
      pushSignal(domSignals, "queue-it", "Queue-it assets", 100);
    }
    if (/virtual queue|waiting room|hi,?\\s*trainer/i.test(text)) {
      pushSignal(domSignals, "queue-copy", "Queue page copy", 80);
    }
    if (/"pos"\\s*:\\s*\\d+/.test(text) && /"pending"\\s*:\\s*1/.test(text)) {
      pushSignal(domSignals, "incapsula-queue", "Incapsula queue payload", 90);
    }

    var nodes = document.querySelectorAll("script[src], iframe[src], link[href]");
    for (var i = 0; i < nodes.length; i++) {
      var src = nodes[i].src || nodes[i].href || "";
      if (/queue-it\\.net/i.test(src)) {
        pushSignal(domSignals, "queue-it-asset", "Queue-it page asset", 100);
        break;
      }
    }

    var signals = mergeSignals(domSignals);
    var confidence = signals.reduce(function (max, s) {
      return Math.max(max, s.confidence);
    }, 0);
    var blocked = isBlockedPage();
    return {
      live: blocked ? false : confidence >= 60,
      confidence: blocked ? 0 : confidence,
      signals: signals,
      blocked: blocked,
    };
  }

  function postToNative(state) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "pc-queue-watch",
            live: state.live,
            confidence: state.confidence,
            signals: state.signals,
            blocked: Boolean(state.blocked),
            pageUrl: location.href,
            checkedAt: new Date().toISOString(),
          }),
        );
      }
    } catch (e) {}
  }

  function report(state, force) {
    var now = Date.now();
    var changed = lastReportedLive === null || lastReportedLive !== state.live;
    if (!force && !changed && now - lastReportAt < HEARTBEAT_MS) return;

    postToNative(state);
    lastReportAt = now;
    lastReportedLive = state.live;
    lastLive = state.live;

    badge.textContent = state.blocked
      ? "Pass bot check…"
      : state.live
        ? "PC Queue LIVE"
        : "PC Queue Watch active";
    badge.style.background = state.live ? "#059669" : state.blocked ? "#b45309" : "#111827";
  }

  function evaluate(force) {
    report(scanDocument(), Boolean(force));
  }

  function onQueueNetwork(url) {
    if (!/queue-it\\.net/i.test(String(url || ""))) return;
    rememberSticky("queue-it-net", "Queue-it network request", 100);
    report(
      {
        live: true,
        confidence: 100,
        signals: mergeSignals([
          { id: "queue-it-net", label: "Queue-it network request", confidence: 100 },
        ]),
        blocked: false,
      },
      true,
    );
  }

  var originalFetch = window.fetch;
  window.fetch = function () {
    try {
      onQueueNetwork(arguments[0] && arguments[0].url ? arguments[0].url : arguments[0]);
    } catch (e) {}
    return originalFetch.apply(this, arguments);
  };

  var originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      onQueueNetwork(url);
    } catch (e) {}
    return originalOpen.apply(this, arguments);
  };

  if (typeof PerformanceObserver !== "undefined") {
    try {
      var po = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          onQueueNetwork(entry.name);
        });
      });
      po.observe({ entryTypes: ["resource"] });
    } catch (e) {}
  }

  var observer = new MutationObserver(function () {
    if (mutateTimer) clearTimeout(mutateTimer);
    mutateTimer = setTimeout(function () {
      evaluate(false);
    }, MUTATE_DEBOUNCE_MS);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("hashchange", function () {
    evaluate(true);
  });
  window.addEventListener("popstate", function () {
    evaluate(true);
  });
  setInterval(function () {
    evaluate(false);
  }, SCAN_MS);
  evaluate(true);
  true;
})();
`
