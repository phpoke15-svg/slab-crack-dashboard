import type { Server } from "node:http"
import { WebSocketServer, type WebSocket } from "ws"

export const QUEUE_DETECTED_EVENT = "QUEUE_DETECTED" as const

export type QueueDetectedPayload = {
  type: typeof QUEUE_DETECTED_EVENT
  url: string
  status: number
  detectedAt: string
}

let wss: WebSocketServer | null = null
const clients = new Set<WebSocket>()

export function attachWebSocketBroadcast(server: Server, path = "/ws"): void {
  if (wss) return

  wss = new WebSocketServer({ server, path })
  wss.on("connection", (socket) => {
    clients.add(socket)
    socket.on("close", () => clients.delete(socket))
    socket.on("error", () => clients.delete(socket))
  })

  console.log(`[worker] WebSocket broadcast listening on path ${path}`)
}

export function getWebSocketClientCount(): number {
  return clients.size
}

export function broadcastQueueDetected(payload: Omit<QueueDetectedPayload, "type">): number {
  const message: QueueDetectedPayload = {
    type: QUEUE_DETECTED_EVENT,
    ...payload,
  }
  const body = JSON.stringify(message)
  let delivered = 0

  for (const client of clients) {
    if (client.readyState !== client.OPEN) continue
    client.send(body)
    delivered += 1
  }

  return delivered
}

export function resetWebSocketBroadcastForTests(): void {
  for (const client of clients) {
    client.close()
  }
  clients.clear()
  wss?.close()
  wss = null
}
