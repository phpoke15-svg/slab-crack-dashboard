/**
 * In-page queue scanner for the native Pokemon Center WebView.
 * Token never enters the page — results post to React Native only.
 */
export const NATIVE_MONITOR_INJECT = `
(function(){
  if (window.__pcNativeWatchActive) return;
  window.__pcNativeWatchActive = true;
  var SCAN_MS = 4000;

  function push(list, id, label, confidence) {
    if (list.some(function(s) { return s.id === id; })) return;
    list.push({ id: id, label: label, confidence: confidence });
  }

  function isChallengePage(html) {
    return /are you human|verify you are human|confirm you are human|please verify you(?:'|')?re a human/i.test(html)
      || /g-recaptcha|recaptcha-anchor|hcaptcha|h-captcha|cf-turnstile/i.test(html)
      || /geo\\.captcha-delivery\\.com|distil_captcha|incapsula.*challenge/i.test(html)
      || /select all (?:images|squares|tiles)|pick (?:all )?(?:images|squares)|tap the matching/i.test(html);
  }

  function scan() {
    var signals = [];
    var html = document.documentElement ? document.documentElement.innerHTML : "";
    var href = String(location.href || "");

    if (/queue-it\\.net/i.test(href) || /waitingroom|waiting-room/i.test(href)) {
      push(signals, "waiting-room-url", "Waiting room URL", 100);
    }
    if (/queue-it\\.net|queue-it\\.js|queueit/i.test(html)) {
      push(signals, "queue-it", "Queue-it assets", 100);
    }
    if (/virtual queue|waiting room|hi,?\\s*trainer/i.test(html)) {
      push(signals, "queue-copy", "Queue page copy", 80);
    }
    if (/"pos"\\s*:\\s*\\d+/.test(html) && /"pending"\\s*:\\s*1/.test(html)) {
      push(signals, "incapsula-queue", "Incapsula queue payload", 90);
    }

    var challenge = isChallengePage(html);
    if (challenge) {
      push(signals, "imperva-human-verify", "Imperva human verification", 95);
    }

    var confidence = signals.reduce(function(max, s) {
      return Math.max(max, s.confidence || 0);
    }, 0);

    return {
      live: challenge ? false : confidence >= 60,
      confidence: challenge ? 0 : confidence,
      signals: signals,
      challenge: challenge,
      pageUrl: href.slice(0, 500),
    };
  }

  function publish(state) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "pc-native-scan",
          live: state.live,
          confidence: state.confidence,
          signals: state.signals,
          challenge: state.challenge,
          pageUrl: state.pageUrl,
        }));
      }
    } catch (e) {}
  }

  publish(scan());
  setInterval(function() { publish(scan()); }, SCAN_MS);
})();
true;
`
