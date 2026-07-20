import type { CatalogCard, Rarity } from "./cards"

export type PokemonApiCard = {
  id: string
  name: string
  number?: string
  rarity?: string
  set?: { name?: string }
  images?: { small?: string; large?: string }
}

export function mapPokemonRarity(rarity?: string): Rarity {
  if (!rarity) return "Common"
  const r = rarity.toLowerCase()
  if (
    r.includes("secret") ||
    r.includes("hyper") ||
    r.includes("special illustration") ||
    r.includes("rainbow") ||
    r.includes("gold")
  ) {
    return "Legendary"
  }
  if (
    r.includes("ultra") ||
    r.includes("illustration rare") ||
    r.includes("amazing") ||
    r.includes("double rare") ||
    r.includes(" ace spec") ||
    r.endsWith(" ace")
  ) {
    return "Epic"
  }
  if (r.includes("holo") || r.includes("rare") || r.includes(" ex") || r.endsWith(" ex")) {
    return "Rare"
  }
  return "Common"
}

export function toCatalogCard(card: PokemonApiCard): CatalogCard {
  return {
    id: card.id,
    name: card.name,
    set: card.set?.name ?? "Unknown Set",
    rarity: mapPokemonRarity(card.rarity),
    image: card.images?.large ?? card.images?.small ?? "/placeholder.svg",
  }
}

export type BinderSearchTokens = {
  name: string
  number?: string
  /** Set shorthand when query is like "151 173" or "sv151 173". */
  setHint?: string
}

/** User-facing set nicknames → catalog set_id (e.g. 151 → sv3pt5). */
const SET_HINT_IDS: Record<string, string> = {
  "151": "sv3pt5",
  pokemon151: "sv3pt5",
  sv151: "sv3pt5",
  sv4: "sv4",
  sv3: "sv3",
  sv2: "sv2",
  sv1: "sv1",
  sv5: "sv5",
  sv6: "sv6",
  sv7: "sv7",
  sv8: "sv8",
  sv9: "sv9",
  sv10: "sv10",
  paldeaevolved: "sv4",
  paradoxrift: "sv4",
  obsidianflames: "sv3",
  paldeafates: "sv4pt5",
  temporalforces: "sv5",
  twilightmasquerade: "sv6",
  stellarcrown: "sv7",
  shroudedfable: "sv6pt5",
  surging: "sv8",
  sv8pt5: "sv8pt5",
  prismatic: "sv8pt5",
  mep: "mep",
  megaevolution: "mep",
  megaevolutionpromo: "mep",
}

function looksLikeSetHint(token: string): boolean {
  const normalized = token.replace(/^#/, "").trim()
  if (!normalized) return false
  if (resolveBinderSetIdHint(normalized)) return true
  if (/^sv\d{1,4}[a-z]?$/i.test(normalized)) return true
  const compact = normalized.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (/^\d{2,4}$/.test(normalized) && SET_HINT_IDS[compact]) return true
  return false
}

function normalizeSetHintToken(token: string): string {
  const trimmed = token.trim()
  if (/^sv151$/i.test(trimmed)) return "151"
  if (/^sv\d{1,4}[a-z]?$/i.test(trimmed)) return trimmed.toLowerCase()
  return trimmed
}

export function resolveBinderSetIdHint(setHint: string): string | null {
  const key = setHint.toLowerCase().replace(/[^a-z0-9]/g, "")
  return SET_HINT_IDS[key] ?? null
}

export function parseBinderSearchTokens(q: string): BinderSearchTokens {
  const trimmed = q.trim()
  if (!trimmed) return { name: "" }

  const tokens = trimmed.split(/\s+/).filter(Boolean)

  if (tokens.length === 2) {
    const [left, right] = tokens
    const rightNumber = right.replace(/^#/, "")
    if (/^\d{1,4}$/.test(left) && /^\d{1,4}$/.test(rightNumber)) {
      return { name: "", setHint: left, number: rightNumber }
    }
    if (looksLikeSetHint(right) && /[a-z]/i.test(left)) {
      return { name: left, setHint: normalizeSetHintToken(right) }
    }
    if (/^#?\d{1,4}$/.test(right)) {
      const number = rightNumber
      if (looksLikeSetHint(left)) {
        return { name: "", setHint: normalizeSetHintToken(left), number }
      }
      if (/^sv\d{1,4}[a-z]?$/i.test(left) || /^\d{2,4}$/.test(left)) {
        return { name: "", setHint: normalizeSetHintToken(left), number }
      }
      if (looksLikeSetHint(rightNumber) && /[a-z]/i.test(left)) {
        return { name: left, setHint: normalizeSetHintToken(rightNumber) }
      }
      return { name: left, number }
    }
  }

  if (tokens.length === 1) {
    const token = tokens[0]
    if (/^sv\d{1,4}[a-z]?$/i.test(token)) {
      return { name: "", setHint: normalizeSetHintToken(token) }
    }
    if (/^\d{2,4}[a-z]?$/i.test(token)) {
      return { name: "", setHint: token }
    }
  }

  const numberIndex = tokens.findIndex((token) => /^#?\d{1,4}$/.test(token))

  if (numberIndex >= 0) {
    const number = tokens[numberIndex].replace(/^#/, "")
    const name = tokens.filter((_, index) => index !== numberIndex).join(" ").trim()
    return { name, number }
  }

  return { name: trimmed }
}

export function cardNumberMatches(cardNumber: string | undefined, target: string): boolean {
  if (!target) return true
  if (!cardNumber) return false

  const prefix =
    cardNumber
      .split("/")[0]
      ?.replace(/^#/, "")
      .replace(/^0+/, "") || "0"
  const normalizedTarget = target.replace(/^#/, "").replace(/^0+/, "") || "0"
  return prefix === normalizedTarget
}

export function buildPokemonSearchQueries(q: string): string[] {
  const { name, number } = parseBinderSearchTokens(q)
  if (!name && number) {
    const padded = number.padStart(3, "0")
    return [`number:${number}`, ...(padded !== number ? [`number:${padded}`] : [])]
  }
  if (!name) return []

  const escaped = name.replace(/[+\-&|!(){}[\]^"~*?:\\\/]/g, "\\$&")

  if (number) {
    const padded = number.padStart(3, "0")
    const queries = [
      `name:"${escaped}" number:${number}`,
      `name:"${escaped}" number:${padded}`,
      `name:${escaped} number:${number}`,
    ]
    if (padded !== number) queries.push(`name:"${escaped}" number:${padded}`)
    return queries
  }

  return [`(name:*${escaped}* OR set.name:*${escaped}*)`]
}

export function buildPokemonSearchQuery(q: string): string {
  return buildPokemonSearchQueries(q)[0] ?? ""
}
