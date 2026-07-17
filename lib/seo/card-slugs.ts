/** URL-safe slugs for programmatic card landing pages. */

export function slugifySegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/** Human-readable set slug (e.g. "Base Set" → "base-set"). */
export function buildSetSlug(setId: string, setName: string): string {
  const shortName = setName.includes(":") ? (setName.split(":").pop()?.trim() ?? setName) : setName
  return slugifySegment(shortName) || slugifySegment(setId) || "unknown-set"
}

function slugifyCardNumber(numberToken: string): string {
  const trimmed = numberToken.trim()
  if (!trimmed) return ""

  const direct = slugifySegment(trimmed)
  if (direct) return direct

  // Symbol-only numbers (e.g. Unown ! and ? in Unseen Forces).
  const symbolic = trimmed
    .toLowerCase()
    .replace(/!/g, "exclamation")
    .replace(/\?/g, "question")

  return slugifySegment(symbolic)
}

/** Card slug within a set (e.g. "Charizard" + "4/102" → "charizard-4"). */
export function buildCardSlug(cardName: string, cardNumber: string): string {
  const numberToken = cardNumber.split("/")[0]?.replace(/^#/, "").trim() ?? ""
  const nameSlug = slugifySegment(cardName.replace(/\s+\([^)]+\)$/, "").trim())
  const numberSlug = slugifyCardNumber(numberToken)
  if (nameSlug && numberSlug) return `${nameSlug}-${numberSlug}`
  return nameSlug || numberSlug || "card"
}

export function formatCardNumberForSeo(cardNumber: string): string {
  const trimmed = cardNumber.trim()
  if (!trimmed) return ""
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`
}

export function cardPagePath(setSlug: string, cardSlug: string): string {
  return `/pokemon/${setSlug}/${cardSlug}`
}

export function cardPageUrl(siteOrigin: string, setSlug: string, cardSlug: string): string {
  const base = siteOrigin.replace(/\/$/, "")
  return `${base}${cardPagePath(setSlug, cardSlug)}`
}
