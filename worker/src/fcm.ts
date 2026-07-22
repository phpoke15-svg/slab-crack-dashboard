import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import admin from "firebase-admin"
import { config } from "./config.js"

let initialized = false

export function initFirebase(): void {
  if (initialized) return

  const accountPath = resolve(process.cwd(), config.firebaseServiceAccountPath)
  const serviceAccount = JSON.parse(readFileSync(accountPath, "utf8")) as admin.ServiceAccount

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  initialized = true
}

export async function sendQueueLiveAlert(queueUrl: string): Promise<string> {
  initFirebase()

  const messageId = await admin.messaging().send({
    topic: config.fcmTopic,
    notification: {
      title: "Pokémon Center queue is LIVE",
      body: "Tap to open the queue in your browser.",
    },
    data: {
      url: queueUrl || config.queueDeepLink,
      type: "queue_live",
    },
    android: {
      priority: "high",
      notification: {
        channelId: "pokemon_center_alerts",
        priority: "max",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          "content-available": 1,
        },
      },
    },
  })

  return messageId
}

export async function subscribeTokenToTopic(token: string): Promise<void> {
  initFirebase()
  await admin.messaging().subscribeToTopic([token], config.fcmTopic)
}
