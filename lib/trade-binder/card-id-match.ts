/** Expand catalog ids so poke- / pokemon- / base set ids match the same card in queries. */
export function cardIdVariants(cardId: string): string[] {
  const id = cardId.trim()
  if (!id) return []

  const variants = new Set<string>([id])
  if (id.startsWith("poke-")) {
    const bare = id.slice("poke-".length)
    variants.add(bare)
    variants.add(`pokemon-${bare}`)
  } else if (id.startsWith("pokemon-")) {
    const bare = id.slice("pokemon-".length)
    variants.add(`poke-${bare}`)
    variants.add(bare)
  } else if (!id.startsWith("pc-")) {
    variants.add(`poke-${id}`)
    variants.add(`pokemon-${id}`)
  }
  return [...variants]
}

export function expandCardIdList(cardIds: string[]): string[] {
  return [...new Set(cardIds.flatMap(cardIdVariants))]
}

export function cardIdsEquivalent(a: string, b: string): boolean {
  const aSet = new Set(cardIdVariants(a))
  return cardIdVariants(b).some((v) => aSet.has(v))
}

const STOP_WORDS = new Set(["the", "and", "with", "a", "an", "of", "pokemon", "card"])

/** Lowercase name for matching — strips rarity, #, and set number suffixes. */
export function normalizeCardName(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/\s+\([^)]+\)\s*$/g, "")
    .replace(/#(\d+[a-z]?)/gi, " $1 ")
    .replace(/\b(\d+[a-z]?)\s*\/\s*\d+[a-z]?\b/gi, " $1 ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Lowercase set name without series prefix noise. */
export function normalizeSetName(set: string | null | undefined): string {
  return (set ?? "")
    .toLowerCase()
    .replace(/^(scarlet & violet|sword & shield|sun & moon|xy|black & white):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Card number token from stored field or embedded in the name (e.g. #232, 232/165). */
export function parseCardNumber(
  cardNumber: string | null | undefined,
  cardName?: string | null,
): string {
  const fromField = cardNumber?.split("/")[0]?.replace(/^#/, "").trim()
  if (fromField && /^\d+[a-z]?$/i.test(fromField)) {
    return fromField.toLowerCase()
  }

  const fromName = cardName?.match(/#?\s*(\d{1,4}[a-z]?)(?:\s*\/\s*\d+[a-z]?)?/i)?.[1]
  return fromName?.toLowerCase() ?? ""
}

export function significantNameTokens(name: string | null | undefined): string[] {
  return normalizeCardName(name)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

export function nameSetKey(name: string | null | undefined, set: string | null | undefined): string | null {
  const n = normalizeCardName(name)
  const s = normalizeSetName(set)
  if (!n || !s) return null
  return `${n}::${s}`
}

export function cardIdentityKey(
  name: string | null | undefined,
  set: string | null | undefined,
  cardNumber?: string | null,
): string | null {
  const n = normalizeCardName(name)
  const s = normalizeSetName(set)
  if (!n) return null

  const num = parseCardNumber(cardNumber, name)
  if (num) {
    const base = n
      .replace(new RegExp(`\\b${num}\\b`, "g"), "")
      .replace(/\s+/g, " ")
      .trim()
    return s ? `${base}::${s}::${num}` : `${base}::${num}`
  }
  return s ? `${n}::${s}` : n
}

type CardLike = {
  cardName?: string | null
  cardSet?: string | null
  cardNumber?: string | null
  card_name?: string | null
  card_set?: string | null
  card_number?: string | null
}

function readCardFields(card: CardLike) {
  return {
    name: card.cardName ?? card.card_name ?? "",
    set: card.cardSet ?? card.card_set ?? "",
    number: card.cardNumber ?? card.card_number ?? "",
  }
}

function setsCompatible(setA: string, setB: string): boolean {
  if (!setA || !setB) return true
  if (setA === setB) return true
  return setA.includes(setB) || setB.includes(setA)
}

function namesOverlapEnough(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false
  if (nameA === nameB) return true
  if (nameA.includes(nameB) || nameB.includes(nameA)) return true

  const tokensA = significantNameTokens(nameA)
  const tokensB = significantNameTokens(nameB)
  if (tokensA.length === 0 || tokensB.length === 0) return false

  const overlap = tokensA.filter((token) => tokensB.includes(token))
  const minSize = Math.min(tokensA.length, tokensB.length)
  return overlap.length >= Math.max(2, minSize - 1)
}

export function cardsMatchByNameSet(a: CardLike, b: CardLike): boolean {
  return cardsMatchIdentity(a, b)
}

/** True when two binder/search cards refer to the same physical card. */
export function cardsMatchIdentity(a: CardLike, b: CardLike): boolean {
  const aFields = readCardFields(a)
  const bFields = readCardFields(b)

  const keyA = cardIdentityKey(aFields.name, aFields.set, aFields.number)
  const keyB = cardIdentityKey(bFields.name, bFields.set, bFields.number)
  if (keyA && keyB && keyA === keyB) return true

  const setA = normalizeSetName(aFields.set)
  const setB = normalizeSetName(bFields.set)
  if (!setsCompatible(setA, setB)) return false

  const numA = parseCardNumber(aFields.number, aFields.name)
  const numB = parseCardNumber(bFields.number, bFields.name)
  const nameA = normalizeCardName(aFields.name)
  const nameB = normalizeCardName(bFields.name)

  if (numA && numB && numA === numB) {
    const baseA = nameA.replace(new RegExp(`\\b${numA}\\b`, "g"), "").replace(/\s+/g, " ").trim()
    const baseB = nameB.replace(new RegExp(`\\b${numB}\\b`, "g"), "").replace(/\s+/g, " ").trim()
    if (baseA && baseB && namesOverlapEnough(baseA, baseB)) return true
  }

  return namesOverlapEnough(nameA, nameB)
}

export function cardNumberKeys(cardNumber: string | null | undefined, cardName?: string | null): string[] {
  const num = parseCardNumber(cardNumber, cardName)
  if (!num) return []
  return [num, `${num}/%`]
}
