/**
 * Builds a self-contained Queue Watch bookmarklet.
 * Pokemon Center CSP blocks loading /pc-queue-watch.js and fetch() to CollecTools,
 * so the monitor is inlined and reports via window.open() navigation beacons.
 */
export function buildQueueWatchBookmarklet(input: {
  origin: string
  sessionId: string
  token: string
}): string {
  const origin = input.origin.replace(/\/$/, "")
  const sid = JSON.stringify(input.sessionId)
  const tok = JSON.stringify(input.token)
  const base = JSON.stringify(origin)

  // Keep this compact — Chrome bookmark URL length limits still apply.
  const body = `(()=>{if(window.__pcQueueWatchActive)return;window.__pcQueueWatchActive=true;var O=${base},SID=${sid},TOK=${tok},lastLive=false,lastRep=null,lastAt=0,sticky=[],HB=15000,SCAN=4000;var b=document.createElement("div");b.textContent="PC Queue Watch active";b.style.cssText="position:fixed;bottom:12px;right:12px;z-index:2147483647;padding:8px 12px;border-radius:999px;background:#111827;color:#f9fafb;font:600 12px/1.2 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)";document.documentElement.appendChild(b);function push(a,id,l,c){if(a.some(function(s){return s.id===id}))return;a.push({id:id,label:l,confidence:c})}function merge(dom){var m=[];sticky.forEach(function(s){push(m,s.id,s.label,s.confidence)});dom.forEach(function(s){push(m,s.id,s.label,s.confidence)});return m}function scan(){var dom=[],t=document.documentElement.innerHTML,h=location.href;if(/queue-it\\.net/i.test(h)||/waitingroom|waiting-room/i.test(h))push(dom,"waiting-room-url","Waiting room URL",100);if(/queue-it\\.net|queue-it\\.js|queueit/i.test(t))push(dom,"queue-it","Queue-it assets",100);if(/virtual queue|waiting room|hi,?\\s*trainer/i.test(t))push(dom,"queue-copy","Queue page copy",80);if(/"pos"\\s*:\\s*\\d+/.test(t)&&/"pending"\\s*:\\s*1/.test(t))push(dom,"incapsula-queue","Incapsula queue payload",90);var nodes=document.querySelectorAll("script[src],iframe[src],link[href]");for(var i=0;i<nodes.length;i++){var src=nodes[i].src||nodes[i].href||"";if(/queue-it\\.net/i.test(src)){push(dom,"queue-it-asset","Queue-it page asset",100);break}}var signals=merge(dom),confidence=signals.reduce(function(m,s){return Math.max(m,s.confidence)},0);return{live:confidence>=60,confidence:confidence,signals:signals}}function beacon(state){var q=new URLSearchParams({sessionId:SID,live:state.live?"1":"0",confidence:String(state.confidence||0),token:TOK,pageUrl:location.href,source:"bookmarklet"});try{q.set("signals",JSON.stringify(state.signals||[]))}catch(e){}var url=O+"/api/pokemon-center/report?"+q.toString();try{var w=window.open(url,"pcwBeacon");if(w)setTimeout(function(){try{w.close()}catch(e){}},600)}catch(e){}try{fetch(url,{method:"GET",mode:"no-cors",credentials:"omit",keepalive:true}).catch(function(){})}catch(e){}}function report(state,force){var now=Date.now(),changed=lastRep===null||lastRep!==state.live;if(!force&&!changed&&now-lastAt<HB)return;beacon(state);lastAt=now;lastRep=state.live;if(state.live&&!lastLive){try{if(typeof Notification!=="undefined"&&Notification.permission==="granted")new Notification("Pokemon Center queue is LIVE",{body:"Join the queue now.",tag:"pc-queue-live",requireInteraction:true})}catch(e){}}lastLive=state.live;b.textContent=state.live?"PC Queue LIVE":"PC Queue Watch active";b.style.background=state.live?"#059669":"#111827"}function onNet(url){if(!/queue-it\\.net/i.test(String(url||"")))return;push(sticky,"queue-it-net","Queue-it network request",100);report({live:true,confidence:100,signals:merge([{id:"queue-it-net",label:"Queue-it network request",confidence:100}])},true)}var of=window.fetch;window.fetch=function(){try{onNet(arguments[0]&&arguments[0].url?arguments[0].url:arguments[0])}catch(e){}return of.apply(this,arguments)};var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{onNet(u)}catch(e){}return oo.apply(this,arguments)};try{if(typeof PerformanceObserver!=="undefined"){var po=new PerformanceObserver(function(list){list.getEntries().forEach(function(e){onNet(e.name)})});po.observe({entryTypes:["resource"]})}}catch(e){}var mt=null;new MutationObserver(function(){if(mt)clearTimeout(mt);mt=setTimeout(function(){report(scan(),false)},750)}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});setInterval(function(){report(scan(),false)},SCAN);report(scan(),true);alert("PC Queue Watch is running — keep this tab open. Allow pop-ups for CollecTools if asked.")})();`

  return `javascript:${body}`
}

/** Same monitor without the javascript: prefix — paste into DevTools console on pokemoncenter.com */
export function buildQueueWatchConsoleSnippet(input: {
  origin: string
  sessionId: string
  token: string
}): string {
  const href = buildQueueWatchBookmarklet(input)
  return href.startsWith("javascript:") ? href.slice("javascript:".length) : href
}

