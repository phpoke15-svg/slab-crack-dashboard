import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import admin from "firebase-admin"
import { config } from "./config.js"

let initialized = false

function loadServiceAccount(): admin.ServiceAccount {
  if (config.firebaseServiceAccountJson) {
    return JSON.parse(config.firebaseServiceAccountJson) as admin.ServiceAccount
  }

  const accountPath = resolve(process.cwd(), config.firebaseServiceAccountPath)
  return JSON.parse(readFileSync(accountPath, "utf8")) as admin.ServiceAccount
}

export function initFirebase(): void {
  if (initialized) return

  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount()),
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
