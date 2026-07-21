import { normalizeSearchCleanName } from "@/lib/db/catalog-search-local"
import { purgeSearchRedisCache } from "@/lib/cache/search-redis"
import { purgeMemorySearchCache } from "@/lib/cache/search-memory-cache"
import { buildCardSlug, buildSetSlug } from "@/lib/seo/card-slugs"
import { catalogIdToLegacyPokeId } from "@/lib/scrydex/constants"
import {
  extractScrydexWebhookPrices,
  normalizeScrydexWebhookEventName,
  readScrydexWebhookCardField,
  readScrydexWebhookId,
} from "@/lib/scrydex/webhook-payload"
import { upsertWebhookDailyHistory } from "@/lib/scrydex/webhook-history"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { TcgGame } from "@/lib/scrydex/types"

export type ScrydexWebhookEvent = {
  id: string
  name: string
  data: Record<string, unknown>
}

async function invalidateSearchCaches(cleanName: string | null | undefined, fallbackName?: string) {
  const keySource = cleanName?.trim() || (fallbackName ? normalizeSearchCleanName(fallbackName) : "")
  if (!keySource) return

  purgeMemorySearchCache(keySource)
  await purgeSearchRedisCache(keySource)
}

function pickFrontImageUrl(data: Record<string, unknown>): string | null {
  const direct = readScrydexWebhookCardField<string>(data, "image_url", "image_url")
  if (direct?.trim()) return direct.trim()

  const images = readScrydexWebhookCardField<
    Array<{ large?: string; small?: string; medium?: string }>
  >(data, "images", "images")
  const front = images?.find((img) => img && typeof img === "object") ?? images?.[0]
  const url = front?.large ?? front?.medium ?? front?.small
  return url?.trim() || null
}

function readWebhookGame(data: Record<string, unknown>): TcgGame {
  const raw = String(
    readScrydexWebhookCardField<string>(data, "game", "game") ??
      readScrydexWebhookCardField<string>(data, "game_id", "game_id") ??
      "pokemon",
  )
    .trim()
    .toLowerCase()

  if (raw === "lorcana" || raw === "mtg" || raw === "magicthegathering" || raw === "magic") {
    return raw === "lorcana" ? "lorcana" : "mtg"
  }
  return "pokemon"
}

async function handleCardPriceUpdated(data: Record<string, unknown>): Promise<void> {
  const scrydexId = readScrydexWebhookId(data)
  if (!scrydexId) {
    console.warn("[scrydex-webhook] card.price_updated missing scrydex_id")
    return
  }

  const { raw, psa10 } = extractScrydexWebhookPrices(data)
  const now = new Date().toISOString()
  const supabase = createAdminClient()

  const { data: rows, error } = await supabase
    .from("cards")
    .update({
      current_price_raw: raw,
      current_price_psa10: psa10,
      price_updated_at: now,
      updated_at: now,
    })
    .eq("scrydex_id", scrydexId)
    .select("clean_name, name")

  if (error) throw error

  await upsertWebhookDailyHistory({
    scrydexId,
    game: readWebhookGame(data),
    raw,
    psa10,
  })

  for (const row of rows ?? []) {
    await invalidateSearchCaches(
      typeof row.clean_name === "string" ? row.clean_name : null,
      typeof row.name === "string" ? row.name : undefined,
    )
  }
}

function buildCardUpsertPayload(data: Record<string, unknown>, scrydexId: string) {
  const expansion = readScrydexWebhookCardField<Record<string, unknown>>(data, "expansion", "expansion")
  const name = String(readScrydexWebhookCardField<string>(data, "name", "name") ?? "Unknown card").trim()
  const setId = String(
    readScrydexWebhookCardField<string>(data, "set_id", "set_id") ??
      expansion?.id ??
      expansion?.code ??
      "",
  ).trim()
  const setName = String(
    readScrydexWebhookCardField<string>(data, "set_name", "set_name") ??
      expansion?.name ??
      "Unknown set",
  ).trim()
  const number = String(readScrydexWebhookCardField<string>(data, "number", "number") ?? "").trim()
  const rarityValue = readScrydexWebhookCardField<string>(data, "rarity", "rarity")
  const imageUrl = pickFrontImageUrl(data)
  const cleanName = normalizeSearchCleanName(name)
  const catalogId = `pokemon-${scrydexId}`
  const legacyId = catalogIdToLegacyPokeId(catalogId) ?? `poke-${scrydexId}`
  const { raw, psa10 } = extractScrydexWebhookPrices(data)
  const now = new Date().toISOString()

  return {
    id: legacyId,
    name,
    set_name: setName,
    set_id: setId,
    number,
    rarity: rarityValue ?? null,
    image_url: imageUrl,
    language: "en",
    scrydex_id: scrydexId,
    clean_name: cleanName,
    set_slug: buildSetSlug(setId, setName),
    card_slug: buildCardSlug(name, number),
    current_price_raw: raw,
    current_price_psa10: psa10,
    price_updated_at: now,
    updated_at: now,
  }
}

async function handleCardCreated(data: Record<string, unknown>): Promise<void> {
  const scrydexId = readScrydexWebhookId(data)
  if (!scrydexId) {
    console.warn("[scrydex-webhook] card.created missing scrydex_id")
    return
  }

  const payload = buildCardUpsertPayload(data, scrydexId)
  const supabase = createAdminClient()
  const { error } = await supabase.from("cards").upsert(payload, { onConflict: "id" })
  if (error) throw error

  await invalidateSearchCaches(payload.clean_name, payload.name)
}

export async function processScrydexWebhookEvent(event: ScrydexWebhookEvent): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured")
  }

  const eventName = normalizeScrydexWebhookEventName(event.name)

  switch (eventName) {
    case "card.price_updated":
      await handleCardPriceUpdated(event.data)
      return
    case "card.created":
      await handleCardCreated(event.data)
      return
    default:
      console.info("[scrydex-webhook] ignored event:", event.name)
  }
}
