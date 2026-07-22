import { gotScraping } from "got-scraping"
import { buildProxyUrl, config } from "./config.js"
import { formatProbeError } from "./probe-utils.js"
import { parseIpFromBody } from "./proxy-ip-parse.js"

const IP_CHECK_URL = "https://icanhazip.com"

const ipCheckClient = gotScraping.extend({
  timeout: { request: 10_000 },
  retry: { limit: 0 },
  throwHttpErrors: false,
})

export type ProxyIpDiagnostic = {
  proxyIp: string | null
  directIp: string | null
  ok: boolean
  misconfigured: boolean
  message: string | null
}
async function fetchPublicIp(proxyUrl?: string): Promise<{ ip: string | null; error: string | null }> {
  try {
    const response = await ipCheckClient.get({
      url: IP_CHECK_URL,
      ...(proxyUrl ? { proxyUrl } : {}),
    })

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return {
        ip: null,
        error: `IP check returned HTTP ${response.statusCode}`,
      }
    }

    const ip = parseIpFromBody(String(response.body ?? ""))
    if (!ip) {
      return { ip: null, error: "IP check response did not contain a valid IP" }
    }

    return { ip, error: null }
  } catch (error) {
    return { ip: null, error: formatProbeError(error) }
  }
}

/** Temporary startup diagnostic — verify IPRoyal proxy egress before queue probes. */
export async function runProxyIpDiagnostic(): Promise<ProxyIpDiagnostic> {
  const proxyUrl = buildProxyUrl()
  const [{ ip: directIp }, { ip: proxyIp, error: proxyError }] = await Promise.all([
    fetchPublicIp(),
    fetchPublicIp(proxyUrl),
  ])

  if (proxyError || !proxyIp) {
    return {
      proxyIp,
      directIp,
      ok: false,
      misconfigured: true,
      message:
        `Proxy IP check failed (${proxyError ?? "unknown error"}). ` +
        "Verify IPROYAL_HOST/IPROYAL_PORT/IPROYAL_USER/IPROYAL_PASS " +
        "(or PROXY_* legacy names) in Railway env vars.",
    }
  }

  if (directIp && proxyIp === directIp) {
    return {
      proxyIp,
      directIp,
      ok: false,
      misconfigured: true,
      message:
        `Proxy IP (${proxyIp}) matches Railway direct egress IP — traffic is not routing through IPRoyal. ` +
        "Check proxy host/port/credentials and ensure the password includes _country-us for residential US egress.",
    }
  }

  if (!config.proxy.username || !config.proxy.password) {
    return {
      proxyIp,
      directIp,
      ok: true,
      misconfigured: true,
      message:
        "Proxy returned an IP, but IPROYAL_USER/IPROYAL_PASS (or PROXY_USERNAME/PROXY_PASSWORD) are empty. " +
        "Authenticated IPRoyal residential proxies require both values.",
    }
  }

  return {
    proxyIp,
    directIp,
    ok: true,
    misconfigured: false,
    message: null,
  }
}

export function logProxyIpDiagnostic(result: ProxyIpDiagnostic): void {
  if (result.proxyIp) {
    console.log(`[worker] Current Proxy IP: ${result.proxyIp}`)
  } else {
    console.warn("[worker] Current Proxy IP: unavailable")
  }

  if (result.directIp) {
    console.log(`[worker] Railway direct egress IP: ${result.directIp}`)
  }

  if (result.misconfigured && result.message) {
    console.error(`[worker] PROXY MISCONFIGURED: ${result.message}`)
  } else if (result.ok) {
    console.log("[worker] Proxy IP diagnostic passed")
  }
}
