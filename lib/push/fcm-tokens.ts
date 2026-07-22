import "server-only"

import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { getFcmTopic } from "@/lib/push/fcm-admin"

export type FcmDeviceTokenRecord = {
  deviceToken: string
  userId: string
  platform?: string | null
  topic: string
}

const memoryTokens = new Map<string, FcmDeviceTokenRecord>()

export async function upsertFcmDeviceToken(input: {
  userId: string
  deviceToken: string
  platform?: string | null
  topic?: string
}): Promise<void> {
  const topic = input.topic?.trim() || getFcmTopic()
  const record: FcmDeviceTokenRecord = {
    userId: input.userId,
    deviceToken: input.deviceToken,
    platform: input.platform ?? null,
    topic,
  }
  memoryTokens.set(input.deviceToken, record)

  if (!isSupabaseConfigured()) return

  const supabase = createAdminClient()
  const { error } = await supabase.from("fcm_device_tokens").upsert(
    {
      user_id: input.userId,
      device_token: input.deviceToken,
      platform: input.platform ?? null,
      topic,
      last_subscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_token" },
  )

  if (error) {
    console.error("[fcm-tokens] upsert failed:", error.message)
  }
}

export async function listFcmDeviceTokens(topic = getFcmTopic()): Promise<FcmDeviceTokenRecord[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("fcm_device_tokens")
        .select("device_token, user_id, platform, topic")
        .eq("topic", topic)

      if (!error && data) {
        return data.map((row) => ({
          deviceToken: row.device_token as string,
          userId: row.user_id as string,
          platform: (row.platform as string | null) ?? null,
          topic: row.topic as string,
        }))
      }
    } catch {
      // fall through
    }
  }

  return [...memoryTokens.values()].filter((row) => row.topic === topic)
}

export async function countFcmDeviceTokens(topic = getFcmTopic()): Promise<number> {
  const tokens = await listFcmDeviceTokens(topic)
  return tokens.length
}
