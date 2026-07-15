/**
 * In-page Pokemon Center queue monitor.
 * Pokemon Center uses a client-side Queue-it connector — the URL often stays
 * pokemoncenter.com while queue-it.net assets load in the background. Network
 * hooks must install before page scripts run (see EARLY_SCRIPT).
 */

/** Install fetch/XHR/PerformanceObserver hooks before page scripts execute. */
export const QUEUE_MONITOR_EARLY_SCRIPT = `
(function () {
  if (window.__pcQueueWatchEarly) return true;
  window.__pcQueueWatchEarly = true;
  window.__pcQueueSticky = window.__pcQueueSticky || [];

  function isQueueUrl(url) {
    var s = String(url || "");
    return /queue-it\\.(?:net|com)|queueit\\.net|\\/waitingroom|\\/waiting-room/i.test(s);
  }

  function remember(id, label, confidence) {
    var bucket = window.__pcQueueSticky;
    if (bucket.some(function (x) { return x.id === id; })) return;
    bucket.push({ id: id, label: label, confidence: confidence });
    window.__pcQueuePendingLive = true;
  }

  function onQueueNetwork(url) {
    if (!isQueueUrl(url)) return;
    remember("queue-it-net", "Queue-it network request", 100);
  }

  var originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function () {
      try {
        var req = arguments[0];
        onQueueNetwork(req && req.url ? req.url : req);
      } catch (e) {}
      return originalFetch.apply(this, arguments);
    };
  }

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

  true;
})();
`

export type QueueMonitorBridge = "native" | "none"

/** Full monitor — DOM scan, badge, heartbeats. */
export function buildQueueMonitorMainScript(bridge: QueueMonitorBridge = "native"): string {
  const postNative =
    bridge === "native"
      ? `
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
            challenge: Boolean(state.challenge),
            pageUrl: location.href,
            checkedAt: new Date().toISOString(),
          }),
        );
      }
    } catch (e) {}
  }`
      : `function postToNative() {}`

  return `
(function () {
  if (window.__pcQueueWatchActive) return true;
  window.__pcQueueWatchActive = true;

  var lastLive = false;
  var lastChallenge = false;
  var lastReportedLive = null;
  var lastReportedChallenge = null;
  var lastReportAt = 0;
  var stickySignals = window.__pcQueueSticky || [];
  window.__pcQueueSticky = stickySignals;
  var mutateTimer = null;
  var HEARTBEAT_MS = 8000;
  var SCAN_MS = 2000;
  var MUTATE_DEBOUNCE_MS = 400;

  var badge = document.createElement("div");
  badge.textContent = "PokeWatch active";
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

  function isQueueUrl(url) {
    var s = String(url || "");
    return /queue-it\\.(?:net|com)|queueit\\.net|\\/waitingroom|\\/waiting-room/i.test(s);
  }

  /** Imperva hard block (access denied). */
  function isBlockedPage() {
    var text = document.documentElement.innerHTML || "";
    if (/Request unsuccessful|access denied/i.test(text)) return true;
    var title = (document.title || "").toLowerCase();
    if (title.indexOf("access denied") >= 0 || title.indexOf("request unsuccessful") >= 0) return true;
    return false;
  }

  /** Human checkbox / image CAPTCHA — earliest drop signal. */
  function isImpervaChallengePage(haystack) {
    if (/are you human|verify you are human|confirm you are human|please verify you(?:'|')?re a human/i.test(haystack)) {
      return true;
    }
    if (/g-recaptcha|recaptcha-anchor|hcaptcha|h-captcha|cf-turnstile/i.test(haystack)) return true;
    if (/geo\\.captcha-delivery\\.com|distil_captcha|incapsula.*challenge/i.test(haystack)) return true;
    if (/select all (?:images|squares|tiles)|pick (?:all )?(?:images|squares)|tap the matching/i.test(haystack)) {
      return true;
    }
    if (/_Incapsula_Resource[\\s\\S]{0,600}(?:captcha|human|verify)/i.test(haystack)) return true;
    if (/iframe[\\s\\S]{0,300}(?:captcha|incapsula|imperva)/i.test(haystack)) return true;
    return false;
  }

  function addChallengeSignals(domSignals, haystack) {
    if (/are you human|verify you are human|confirm you are human|please verify you(?:'|')?re a human/i.test(haystack)) {
      pushSignal(domSignals, "imperva-human-verify", "Imperva human verification", 95);
    }
    if (/g-recaptcha|recaptcha-anchor|hcaptcha|h-captcha|cf-turnstile/i.test(haystack)) {
      pushSignal(domSignals, "captcha-widget", "CAPTCHA widget", 90);
    }
    if (/geo\\.captcha-delivery\\.com|distil_captcha|incapsula.*challenge/i.test(haystack)) {
      pushSignal(domSignals, "imperva-captcha-host", "Imperva CAPTCHA host", 90);
    }
    if (/select all (?:images|squares|tiles)|pick (?:all )?(?:images|squares)|tap the matching/i.test(haystack)) {
      pushSignal(domSignals, "image-captcha", "Image matching CAPTCHA", 88);
    }
    if (/_Incapsula_Resource[\\s\\S]{0,600}(?:captcha|human|verify)/i.test(haystack)) {
      pushSignal(domSignals, "imperva-challenge-shell", "Imperva challenge shell", 85);
    }
  }

  function scanDocument() {
    var domSignals = [];
    var html = document.documentElement.innerHTML || "";
    var text = "";
    try {
      text = (document.body && document.body.innerText) || "";
    } catch (e) {
      text = "";
    }
    var haystack = location.href + "\\n" + (document.title || "") + "\\n" + text + "\\n" + html;
    var href = location.href;

    if (isQueueUrl(href)) {
      pushSignal(domSignals, "waiting-room-url", "Waiting room URL", 100);
    }
    if (/queue-it\\.(?:net|com)|queue-it\\.js|queueit/i.test(haystack)) {
      pushSignal(domSignals, "queue-it", "Queue-it assets", 100);
    }
    if (/virtual queue|waiting room|hi,?\\s*trainer|you are now in line|your place in line/i.test(haystack)) {
      pushSignal(domSignals, "queue-copy", "Queue page copy", 85);
    }
    if (/"pos"\\s*:\\s*\\d+/.test(haystack) && /"pending"\\s*:\\s*1/.test(haystack)) {
      pushSignal(domSignals, "incapsula-queue", "Incapsula queue payload", 90);
    }
    try {
      if (/QueueIT/i.test(document.cookie || "")) {
        pushSignal(domSignals, "queue-it-cookie", "Queue-it cookie", 95);
      }
    } catch (e) {}

    addChallengeSignals(domSignals, haystack);

    var nodes = document.querySelectorAll(
      "script[src], iframe[src], link[href], [class*='queue-it'], [id*='queue-it'], .queue-it-countdown, [class*='captcha'], [id*='captcha']",
    );
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var src = el.src || el.href || el.className || el.id || "";
      if (/queue-it|queueit/i.test(String(src))) {
        pushSignal(domSignals, "queue-it-dom", "Queue-it DOM element", 100);
        break;
      }
    }

    var signals = mergeSignals(domSignals);
    var confidence = signals.reduce(function (max, s) {
      return Math.max(max, s.confidence);
    }, 0);
    var blocked = isBlockedPage();
    var challenge = isImpervaChallengePage(haystack);
    var live = confidence >= 60;
    if (blocked && live) blocked = false;
    return {
      live: blocked ? false : live,
      confidence: blocked ? 0 : confidence,
      signals: signals,
      blocked: blocked || challenge,
      challenge: challenge,
    };
  }

  ${postNative}

  function report(state, force) {
    var now = Date.now();
    var changed = lastReportedLive === null || lastReportedLive !== state.live;
    var challengeChanged =
      lastReportedChallenge === null || lastReportedChallenge !== Boolean(state.challenge);
    if (!force && !changed && !challengeChanged && now - lastReportAt < HEARTBEAT_MS) return;

    postToNative(state);
    lastReportAt = now;
    lastReportedLive = state.live;
    lastReportedChallenge = Boolean(state.challenge);
    lastLive = state.live;
    lastChallenge = Boolean(state.challenge);

    badge.textContent = state.live
      ? "PC Queue LIVE"
      : state.challenge
        ? "Drop guard UP"
        : state.blocked
          ? "Pass bot check…"
          : "PokeWatch active";
    badge.style.background = state.live
      ? "#059669"
      : state.challenge
        ? "#d97706"
        : state.blocked
          ? "#b45309"
          : "#111827";
  }

  function evaluate(force) {
    if (window.__pcQueuePendingLive) {
      window.__pcQueuePendingLive = false;
      report(
        {
          live: true,
          confidence: 100,
          signals: mergeSignals([{ id: "queue-it-net", label: "Queue-it network request", confidence: 100 }]),
          blocked: false,
          challenge: false,
        },
        true,
      );
      return;
    }
    var scanned = scanDocument();
    var challengeEdge = scanned.challenge && !lastChallenge;
    report(scanned, Boolean(force) || challengeEdge);
  }

  function onQueueNetwork(url) {
    if (!isQueueUrl(url)) return;
    rememberSticky("queue-it-net", "Queue-it network request", 100);
    report(
      {
        live: true,
        confidence: 100,
        signals: mergeSignals([{ id: "queue-it-net", label: "Queue-it network request", confidence: 100 }]),
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

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === "childList") {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          if (node && node.tagName === "SCRIPT" && node.src && isQueueUrl(node.src)) {
            onQueueNetwork(node.src);
          }
        }
      }
    }
    if (mutateTimer) clearTimeout(mutateTimer);
    mutateTimer = setTimeout(function () {
      evaluate(false);
    }, MUTATE_DEBOUNCE_MS);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["src", "href", "class", "id"],
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
}

/** @deprecated Use buildQueueMonitorMainScript("native") */
export const WEBVIEW_MONITOR_SCRIPT = buildQueueMonitorMainScript("native")
