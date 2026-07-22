import type { IncomingMessage, ServerResponse } from "node:http"
import { config } from "../config.js"
import { sendQueueNotification } from "../services/notificationService.js"

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  if (chunks.length === 0) return null
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

export function isTestQueueLiveAuthorized(request: IncomingMessage): boolean {
  const secret = config.workerTestSecret
  if (!secret) {
    return process.env.NODE_ENV !== "production"
  }
  return request.headers.authorization === `Bearer ${secret}`
}

export async function handleTestQueueLive(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<void> {
  if (!isTestQueueLiveAuthorized(request)) {
    response.writeHead(401, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ error: "Unauthorized" }))
    return
  }

  const force =
    url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true"

  let body: { url?: string; status?: number } | null = null
  try {
    body = (await readJsonBody(request)) as { url?: string; status?: number } | null
  } catch {
    response.writeHead(400, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ error: "Invalid JSON body" }))
    return
  }

  const targetUrl = body?.url?.trim() || config.queueDeepLink
  const status = typeof body?.status === "number" ? body.status : 200

  try {
    const result = await sendQueueNotification(
      {
        url: targetUrl,
        status,
        detectedAt: new Date().toISOString(),
      },
      force ? { skipCooldown: true } : undefined,
    )

    response.writeHead(200, { "Content-Type": "application/json" })
    response.end(
      JSON.stringify({
        ok: true,
        test: true,
        force,
        url: targetUrl,
        status,
        ...result,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "test dispatch failed"
    response.writeHead(500, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ ok: false, error: message }))
  }
}
