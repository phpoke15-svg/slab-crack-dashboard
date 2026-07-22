import type { FastifyReply, FastifyRequest } from "fastify"
import { config } from "../config.js"
import {
  dispatchQueueNotificationAsync,
  type QueueNotificationDetails,
} from "../services/notificationService.js"

export type QueueAlertWebhookBody = {
  siteTitle?: string
  dropUrl?: string
  url?: string
  productName?: string
  status?: number
}

export function isWebhookAuthorized(request: FastifyRequest): boolean {
  const secret = config.webhookSecret
  if (!secret) {
    return process.env.NODE_ENV !== "production"
  }

  const headerSecret = request.headers["x-webhook-secret"]
  if (typeof headerSecret === "string" && headerSecret === secret) {
    return true
  }

  const authorization = request.headers.authorization
  if (authorization === `Bearer ${secret}`) {
    return true
  }

  const query = request.query as { secret?: string }
  if (query.secret === secret) {
    return true
  }

  return false
}

export function parseQueueAlertPayload(body: unknown): QueueNotificationDetails | null {
  if (!body || typeof body !== "object") {
    return null
  }

  const payload = body as QueueAlertWebhookBody
  const dropUrl = payload.dropUrl?.trim() || payload.url?.trim() || config.queueDeepLink
  const siteTitle = payload.siteTitle?.trim() || undefined
  const productName = payload.productName?.trim() || undefined
  const status = typeof payload.status === "number" ? payload.status : 200

  if (!dropUrl.startsWith("http")) {
    return null
  }

  return {
    url: dropUrl,
    status,
    siteTitle,
    productName,
    detectedAt: new Date().toISOString(),
  }
}

export async function handleQueueAlertWebhook(
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply,
): Promise<void> {
  if (!isWebhookAuthorized(request)) {
    await reply.code(401).send({ ok: false, error: "Unauthorized" })
    return
  }

  const details = parseQueueAlertPayload(request.body)
  if (!details) {
    await reply.code(400).send({
      ok: false,
      error: "Invalid payload. Expected JSON with dropUrl (or url) starting with http.",
    })
    return
  }

  dispatchQueueNotificationAsync(details)

  await reply.code(200).send({
    ok: true,
    accepted: true,
    url: details.url,
    siteTitle: details.siteTitle ?? null,
    productName: details.productName ?? null,
    status: details.status,
    cooldownMs: config.notificationCooldownMs,
  })
}
