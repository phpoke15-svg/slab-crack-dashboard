/** Keep official English + Japanese Pokémon TCG; drop Topps, promos, other languages. */

const EXCLUDED_SET_PATTERNS = [
  /\btopps\b/i,
  /\bkfc\b/i,
  /\bburger king\b/i,
  /\bmcdonald'?s?\b/i,
  /\bwendy'?s\b/i,
  /\bgeneral mills\b/i,
  /\baction flipz\b/i,
  /\bhasbro\b/i,
  /\btomy\b/i,
  /\bbandai\b/i,
  /\bsticker\b/i,
  /\badvent calendar\b/i,
  /\btoys r us\b/i,
  /\bcoin\b/i,
  /\bnotebook\b/i,
  /\bpokedex\b/i,
  /\btrading figure\b/i,
  /\bplush\b/i,
]

const EXCLUDED_LANGUAGE_PATTERNS = [
  /\bpokemon chinese\b/i,
  /\bchinese pokemon\b/i,
  /\bpokemon korean\b/i,
  /\bkorean pokemon\b/i,
  /\bpokemon thai\b/i,
  /\bpokemon indonesian\b/i,
  /\bpokemon french\b/i,
  /\bpokemon german\b/i,
  /\bpokemon italian\b/i,
  /\bpokemon spanish\b/i,
  /\bpokemon portuguese\b/i,
]

const EXCLUDED_SLUG_PATTERNS = [
  /topps/i,
  /kfc/i,
  /burger-king/i,
  /mcdonald/i,
  /wendy/i,
  /general-mills/i,
  /action-flipz/i,
  /hasbro/i,
  /sticker/i,
  /advent-calendar/i,
  /toysrus/i,
  /coin/i,
  /pokemon-chinese/i,
  /chinese-pokemon/i,
  /pokemon-korean/i,
  /korean-pokemon/i,
]

function isAllowedLanguage(input: { setName: string; genre?: string }): boolean {
  const haystack = `${input.setName} ${input.genre ?? ""}`
  if (EXCLUDED_LANGUAGE_PATTERNS.some((pattern) => pattern.test(haystack))) return false
  if (input.genre && /^(Chinese|Korean|Thai|Indonesian) Pokemon Card$/i.test(input.genre)) {
    return false
  }
  return true
}

export function getDefaultSetAgeYears(): number {
  const fromEnv = Number(process.env.DISCOVERY_MAX_SET_AGE_YEARS)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 3
}

export function getSetAgeCutoff(years = getDefaultSetAgeYears(), now = new Date()): Date {
  // Jan 1 of (current year - years), so "3 years" in 2026 includes all of 2023–2026.
  return new Date(now.getFullYear() - years, 0, 1)
}

export function isRecentSetRelease(
  releaseDate: string | undefined | null,
  years = getDefaultSetAgeYears(),
): boolean {
  if (!releaseDate?.trim()) return false
  const parsed = Date.parse(releaseDate.trim())
  if (!Number.isFinite(parsed)) return false
  return parsed >= getSetAgeCutoff(years).getTime()
}

export function isMainlinePokemonTcg(input: {
  setName: string
  genre?: string
  productName?: string
}): boolean {
  if (input.genre && input.genre !== "Pokemon Card") return false
  if (!isAllowedLanguage(input)) return false

  const haystack = `${input.setName} ${input.productName ?? ""}`
  if (EXCLUDED_SET_PATTERNS.some((pattern) => pattern.test(haystack))) return false

  return true
}

export function isMainlinePokemonSetSlug(slug: string): boolean {
  const decoded = slug.replace(/&amp;/g, "&")
  if (EXCLUDED_SLUG_PATTERNS.some((pattern) => pattern.test(decoded))) return false
  return true
}

export function filterMainlineProducts<T extends { setName: string; genre?: string; productName?: string }>(
  rows: T[],
): T[] {
  return rows.filter((row) =>
    isMainlinePokemonTcg({
      setName: row.setName,
      genre: row.genre,
      productName: row.productName,
    }),
  )
}
