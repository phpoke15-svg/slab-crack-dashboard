import "server-only"
import {
  lookupCardById,
  lookupCardByPokemonId,
  searchCatalogCards,
  searchHitToPlaceholder,
  type CardSearchHit,
} from "@/lib/card-lookup"
import {
  geminiVisionModelCandidates,
  isGeminiModelUnavailable,
} from "@/lib/slabcrack/gemini-models"
import {
  cleanNumber,
  extractGeminiAnswerText,
  minAutoMatchScore,
  parseDetectedJson,
  scoreHit,
  simplifyCardName,
  thinkingConfigForModel,
  type DetectedCard,
  type GeminiGenerateResponse,
} from "@/lib/slabcrack/identify-parse"
import { matchDetectedCardLocal } from "@/lib/slabcrack/local-match"
import { normalizeCardEntry, type MockCardEntry } from "@/lib/slab-data"

export type { DetectedCard }

export type IdentifyCardResult = {
  ok: true
  detected: DetectedCard
  query: string
  hit: CardSearchHit | null
  candidates: CardSearchHit[]
  card: MockCardEntry | null
  source: "gemini" | "openai"
  matchScore: number
  /** Where catalog/pricing came from for this match. */
  pricingSource: "local" | "live"
  /** Client may background-refresh live PriceCharting comps. */
  needsLiveRefresh: boolean
}

/** Single parallel catalog attempt budget (Pokémon + PriceCharting inside). */
const IDENTIFY_SEARCH_MS = 3_500

const IDENTIFY_PROMPT = [
  "Identify the Pokemon TCG card in this photo.",
  "Return JSON only with keys: cardName, setName, cardNumber, confidence, notes.",
  'cardName like "Umbreon ex"; setName English or ""; cardNumber like "161" or "161/131" or "".',
  "Prefer English. Ignore slab labels. Guess if unsure and lower confidence.",
].join(" ")

function buildSearchQuery(detected: DetectedCard): string {
  const number = cleanNumber(detected.cardNumber)
  const name = simplifyCardName(detected.cardName)
  const setName = detected.setName.trim()
  if (name && number) return `${name} ${number}`
  if (name && setName) return `${name} ${setName}`
  if (name) return name
  if (number && setName) return `${setName} ${number}`
  return number || setName
}

function buildAlternateQueries(detected: DetectedCard, primary: string): string[] {
  const number = cleanNumber(detected.cardNumber)
  const fullName = detected.cardName.trim()
  const simpleName = simplifyCardName(fullName)
  const setName = detected.setName.trim()
  const firstName =
    simpleName
      .split(/\s+/)
      .find((t) => t.length > 2 && !/^(ex|gx|v|vmax|vstar|lv\.?x|break)$/i.test(t)) ?? ""
  const alts = [
    primary,
    simpleName && number ? `${simpleName} ${number}` : "",
    firstName && number ? `${firstName} ${number}` : "",
    fullName && number ? `${fullName} ${number}` : "",
    simpleName && setName ? `${simpleName} ${setName}` : "",
    firstName && setName ? `${firstName} ${setName}` : "",
    simpleName,
    firstName,
    number && setName ? `${setName} ${number}` : "",
    number,
  ]
  return alts.filter((q, i, arr): q is string => Boolean(q) && arr.indexOf(q) === i && q !== primary)
}

function splitDataUrl(imageDataUrl: string): { mimeType: string; base64: string } {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) {
    throw new Error("Expected a data:image base64 URL from the camera capture.")
  }
  return { mimeType: match[1]!, base64: match[2]! }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

class GeminiOverloadedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GeminiOverloadedError"
  }
}

type GeminiRequestMode = "preferred" | "more-tokens"

function buildGenerationConfig(model: string, mode: GeminiRequestMode) {
  const thinking = thinkingConfigForModel(model)

  return {
    responseMimeType: "application/json",
    // Tiny JSON answer — keep output budget small for lower latency.
    maxOutputTokens: mode === "more-tokens" ? 2048 : 768,
    temperature: 0,
    ...(thinking ? { thinkingConfig: thinking } : {}),
  }
}

async function detectWithGemini(imageDataUrl: string): Promise<DetectedCard> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.")
  }

  // Prefer gemini-3.5-flash — 2.5-flash 404s on many keys ("update to newest version").
  const models = geminiVisionModelCandidates()

  const { mimeType, base64 } = splitDataUrl(imageDataUrl)
  let lastError = "Gemini vision failed."
  let sawOverload = false
  const started = Date.now()

  for (const model of models) {
    let modelUnavailable = false
    const modes: GeminiRequestMode[] = ["preferred", "more-tokens"]

    for (const mode of modes) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: IDENTIFY_PROMPT },
                  {
                    inlineData: {
                      mimeType,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: buildGenerationConfig(model, mode),
          }),
        })

        if (response.status === 429 || response.status === 503) {
          sawOverload = true
          lastError = `Gemini vision overloaded (${response.status}) on ${model}`
          await sleep(500 * (attempt + 1))
          continue
        }

        if (!response.ok) {
          const body = await response.text().catch(() => "")
          lastError = `Gemini vision failed (${response.status}) on ${model}: ${body.slice(0, 280)}`
          console.warn("[slabcrack-identify]", lastError)

          // Model id missing / unavailable for this key → skip to the next candidate.
          if (isGeminiModelUnavailable(response.status, body)) {
            modelUnavailable = true
            break
          }
          // Invalid thinkingConfig → try next mode / model.
          if (response.status === 400 && /thinking/i.test(body)) {
            break
          }
          throw new Error(lastError)
        }

        const json = (await response.json()) as GeminiGenerateResponse
        const { text: raw, finishReason, blockReason } = extractGeminiAnswerText(json)

        if (blockReason) {
          lastError = `Gemini blocked the photo (${blockReason}) on ${model}.`
          console.warn("[slabcrack-identify]", lastError)
          break
        }

        if (!raw) {
          lastError = `Gemini returned an empty identification from ${model}${
            finishReason ? ` (${finishReason})` : ""
          }.`
          console.warn("[slabcrack-identify]", lastError, JSON.stringify(json).slice(0, 400))
          // Empty / MAX_TOKENS usually means thinking ate the output budget — try next mode.
          break
        }

        try {
          const detected = parseDetectedJson(raw, "Gemini")
          console.warn(
            `[slabcrack-identify] vision ok via ${model}/${mode} in ${Date.now() - started}ms`,
          )
          return detected
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Gemini JSON parse failed."
          console.warn("[slabcrack-identify]", lastError, raw.slice(0, 240))
          break
        }
      }

      if (modelUnavailable || sawOverload) break
    }

    // 429/503 is usually account-wide — don't burn more Gemini models.
    if (sawOverload) break
  }

  if (sawOverload) {
    throw new GeminiOverloadedError(
      `${lastError}. Wait a few seconds and try again, or we'll use OpenAI fallback if configured.`,
    )
  }

  throw new Error(lastError)
}

async function detectWithOpenAI(imageDataUrl: string): Promise<DetectedCard> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.")
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You identify Pokemon TCG trading cards from photos. Return strict JSON only.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: IDENTIFY_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
                detail: "low",
              },
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`OpenAI vision failed (${response.status}): ${body.slice(0, 200)}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = json.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error("OpenAI returned an empty identification.")
  return parseDetectedJson(raw, "OpenAI")
}

async function detectCard(
  imageDataUrl: string,
): Promise<{ detected: DetectedCard; source: "gemini" | "openai" }> {
  const prefer = (process.env.SLABCRACK_VISION_PROVIDER?.trim() || "auto").toLowerCase()
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim())
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim())

  if (prefer === "openai") {
    if (!hasOpenAI) throw new Error("OPENAI_API_KEY is not configured.")
    return { detected: await detectWithOpenAI(imageDataUrl), source: "openai" }
  }

  if (prefer === "gemini") {
    if (!hasGemini) throw new Error("GEMINI_API_KEY is not configured.")
    try {
      return { detected: await detectWithGemini(imageDataUrl), source: "gemini" }
    } catch (error) {
      // Prefer Gemini, but don't leave Scan broken when OpenAI can finish the job.
      if (hasOpenAI) {
        console.warn(
          "[slabcrack-identify] Gemini failed — falling back to OpenAI:",
          error instanceof Error ? error.message : error,
        )
        return { detected: await detectWithOpenAI(imageDataUrl), source: "openai" }
      }
      throw error
    }
  }

  // auto: Gemini first, then OpenAI on any Gemini failure when both are configured.
  if (hasGemini) {
    try {
      return { detected: await detectWithGemini(imageDataUrl), source: "gemini" }
    } catch (error) {
      if (!hasOpenAI) throw error
      console.warn(
        "[slabcrack-identify]",
        error instanceof GeminiOverloadedError
          ? "Gemini overloaded — falling back to OpenAI"
          : "Gemini failed — falling back to OpenAI:",
        error instanceof Error ? error.message : error,
      )
    }
  }

  if (hasOpenAI) {
    return { detected: await detectWithOpenAI(imageDataUrl), source: "openai" }
  }

  throw new Error(
    "No vision API key configured. Add GEMINI_API_KEY (paid Gemini 3.5 recommended) in Vercel env.",
  )
}

async function priceHit(hit: CardSearchHit): Promise<MockCardEntry> {
  try {
    if (hit.id.startsWith("pc-")) {
      const priced = await lookupCardById(hit.id)
      return priced ?? searchHitToPlaceholder(hit)
    }

    const number = cleanNumber(hit.cardNumber)
    const name = simplifyCardName(hit.cardName)
    const priced = await lookupCardByPokemonId(hit.pokemonTcgId, {
      cardName: hit.cardName,
      setName: hit.setName,
      cardNumber: hit.cardNumber,
      imageUrl: hit.imageUrl || undefined,
      rarity: hit.rarity,
      fast: true,
      searchQuery: [name, number ? `#${number}` : "", hit.setName].filter(Boolean).join(" "),
    })
    return priced ?? searchHitToPlaceholder(hit)
  } catch (error) {
    console.warn(
      "[slabcrack-identify] price lookup failed — using catalog placeholder:",
      error instanceof Error ? error.message : error,
    )
    return searchHitToPlaceholder(hit)
  }
}

async function searchWithFallbacks(
  detected: DetectedCard,
  primaryQuery: string,
): Promise<CardSearchHit[]> {
  const queries = [primaryQuery, ...buildAlternateQueries(detected, primaryQuery)].slice(0, 3)

  // Primary first (Pokémon + PriceCharting in parallel inside searchCatalogCards).
  const primaryHits = await searchCatalogCards(queries[0]!, 6, IDENTIFY_SEARCH_MS, { fast: true })
  if (primaryHits.length) return primaryHits

  // Remaining alternates in parallel — don't chain slow sequential passes.
  const altQueries = queries.slice(1)
  if (!altQueries.length) return []

  const altResults = await Promise.all(
    altQueries.map((query) => searchCatalogCards(query, 6, IDENTIFY_SEARCH_MS, { fast: true })),
  )
  for (let i = 0; i < altResults.length; i += 1) {
    const hits = altResults[i]!
    if (hits.length) {
      console.warn("[slabcrack-identify] recovered catalog match via", altQueries[i])
      return hits
    }
  }

  console.warn(
    "[slabcrack-identify] catalog miss after fallbacks",
    JSON.stringify({
      primaryQuery,
      cardName: detected.cardName,
      setName: detected.setName,
      cardNumber: detected.cardNumber,
    }),
  )
  return []
}

function normalizeDetectedInput(input: Partial<DetectedCard> | null | undefined): DetectedCard {
  const cardName = String(input?.cardName ?? "").trim()
  const setName = String(input?.setName ?? "").trim()
  const cardNumber = cleanNumber(String(input?.cardNumber ?? ""))
  const confidenceRaw = Number(input?.confidence)
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0.5
  const notes = String(input?.notes ?? "").trim() || undefined
  if (!cardName && !cardNumber) {
    throw new Error("detected.cardName or detected.cardNumber is required")
  }
  return { cardName, setName, cardNumber, confidence, notes }
}

export type VisionIdentifyResult = {
  ok: true
  detected: DetectedCard
  query: string
  source: "gemini" | "openai"
}

/** Vision-only step — returns as soon as the model names the card. */
export async function identifyCardVision(imageDataUrl: string): Promise<VisionIdentifyResult> {
  if (!imageDataUrl.startsWith("data:image/")) {
    throw new Error("Expected a data:image URL from the camera capture.")
  }
  if (imageDataUrl.length > 4_500_000) {
    throw new Error("Photo is too large. Retake closer or use a smaller image.")
  }

  const started = Date.now()
  const { detected, source } = await detectCard(imageDataUrl)
  const query = buildSearchQuery(detected)
  console.warn(`[slabcrack-identify] vision-only source=${source} in ${Date.now() - started}ms`)
  return { ok: true, detected, query, source }
}

function withLowConfidenceInsight(card: MockCardEntry, lowConfidence: boolean): MockCardEntry {
  if (!lowConfidence) return card
  return {
    ...card,
    marketInsight: card.marketInsight
      ? `${card.marketInsight} Confirm this is the right card — tap Wrong card if not.`
      : "Confirm this is the right card — tap Wrong card if not.",
  }
}

/** Catalog + pricing step for an already-detected card. */
export async function matchDetectedCard(
  input: Partial<DetectedCard>,
  source: "gemini" | "openai" = "gemini",
): Promise<IdentifyCardResult> {
  const detected = normalizeDetectedInput(input)
  const started = Date.now()
  const query = buildSearchQuery(detected)

  // Local-first: Supabase slab_cards + cached prices (ms), then optional live refresh.
  const local = await matchDetectedCardLocal(detected)
  if (local?.hit && local.card) {
    const lowConfidence = local.matchScore < minAutoMatchScore(detected)
    console.warn(
      `[slabcrack-identify] local-match score=${local.matchScore} refresh=${local.needsLiveRefresh} in ${Date.now() - started}ms`,
    )
    return {
      ok: true,
      detected,
      query,
      hit: local.hit,
      candidates: local.candidates,
      card: withLowConfidenceInsight(local.card, lowConfidence),
      source,
      matchScore: local.matchScore,
      pricingSource: "local",
      needsLiveRefresh: local.needsLiveRefresh,
    }
  }

  const candidates = await searchWithFallbacks(detected, query)
  const afterSearch = Date.now()
  const ranked = [...candidates].sort(
    (a, b) => scoreHit(b, detected) - scoreHit(a, detected),
  )
  const top = ranked[0] ?? null
  const matchScore = top ? scoreHit(top, detected) : 0
  const hit = top
  const lowConfidence = Boolean(hit && matchScore < minAutoMatchScore(detected))

  let card: MockCardEntry | null = null
  if (hit) {
    card = withLowConfidenceInsight(normalizeCardEntry(await priceHit(hit)), lowConfidence)
  }

  console.warn(
    `[slabcrack-identify] live-match search=${afterSearch - started}ms price=${Date.now() - afterSearch}ms total=${Date.now() - started}ms hits=${ranked.length}`,
  )

  return {
    ok: true,
    detected,
    query,
    hit,
    candidates: ranked,
    card,
    source,
    matchScore,
    pricingSource: "live",
    needsLiveRefresh: false,
  }
}

/**
 * Vision-identify a card photo, then resolve live SlabCrack/SlabLab pricing for the best match.
 */
export async function identifyCardFromImage(imageDataUrl: string): Promise<IdentifyCardResult> {
  const vision = await identifyCardVision(imageDataUrl)
  return matchDetectedCard(vision.detected, vision.source)
}
