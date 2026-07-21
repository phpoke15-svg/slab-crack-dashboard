import { ScrydexClient } from "@/lib/scrydex/client"
import { isScrydexConfigured, splitCatalogId } from "@/lib/scrydex/constants"
import type { ScrydexListing, TcgGame } from "@/lib/scrydex/types"
import type { RecentSale } from "@/lib/slab-data"

function normalizeSoldDate(value: string | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10)
  const normalized = value.replace(/\//g, "-")
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

export function scrydexListingToRecentSale(listing: ScrydexListing): RecentSale | null {
  const price = Number(listing.price ?? 0)
  if (!Number.isFinite(price) || price <= 0) return null

  return {
    title: String(listing.title ?? "Sold listing").trim(),
    price,
    shipping: 0,
    total: price,
    soldDate: normalizeSoldDate(listing.sold_at),
    url: listing.url?.trim() || undefined,
  }
}

export function partitionScrydexListings(
  listings: ScrydexListing[],
  slabGrade: number,
): { recentRawSales: RecentSale[]; recentSlabSales: RecentSale[] } {
  const recentRawSales: RecentSale[] = []
  const recentSlabSales: RecentSale[] = []

  for (const listing of listings) {
    const sale = scrydexListingToRecentSale(listing)
    if (!sale) continue

    const company = String(listing.company ?? "").trim().toUpperCase()
    const grade = String(listing.grade ?? "").trim()

    if (company && grade) {
      if (company === "PSA" && Number(grade) === slabGrade) {
        recentSlabSales.push(sale)
      }
      continue
    }

    if (!company && !grade) {
      recentRawSales.push(sale)
    }
  }

  recentRawSales.sort((a, b) => b.soldDate.localeCompare(a.soldDate))
  recentSlabSales.sort((a, b) => b.soldDate.localeCompare(a.soldDate))

  return {
    recentRawSales: recentRawSales.slice(0, 40),
    recentSlabSales: recentSlabSales.slice(0, 40),
  }
}

function resolveScrydexTarget(input: {
  catalogId?: string | null
  scrydexId?: string | null
  game?: TcgGame
}): { game: TcgGame; scrydexId: string; catalogId: string | null } | null {
  const catalogId = input.catalogId?.trim() || null
  const fromCatalog = catalogId ? splitCatalogId(catalogId) : null
  const game = input.game ?? fromCatalog?.game
  const scrydexId = input.scrydexId?.trim() || fromCatalog?.scrydexId

  if (!game || !scrydexId) return null
  return { game, scrydexId, catalogId }
}

/** Fetch recent sold comps from Scrydex listings (eBay-backed historical sales). */
export async function fetchScrydexSoldComps(input: {
  catalogId?: string | null
  scrydexId?: string | null
  game?: TcgGame
  slabGrade: number
  days?: number
  rawOnly?: boolean
}): Promise<{ recentRawSales: RecentSale[]; recentSlabSales: RecentSale[] }> {
  if (!isScrydexConfigured()) {
    throw new Error("SCRYDEX_API_KEY and SCRYDEX_TEAM_ID must be configured")
  }

  const target = resolveScrydexTarget(input)
  if (!target) {
    throw new Error("Scrydex card id required for sold comps")
  }

  const client = ScrydexClient.fromEnv()
  const requestOpts = { game: target.game, catalogId: target.catalogId ?? undefined }

  const rawResponse = await client.getListings(
    target.game,
    target.scrydexId,
    { days: input.days ?? 30, condition: "NM", pageSize: 40 },
    requestOpts,
  )

  const rawListings = rawResponse.data ?? []
  const rawSales = rawListings
    .map(scrydexListingToRecentSale)
    .filter((sale): sale is RecentSale => sale != null)
    .sort((a, b) => b.soldDate.localeCompare(a.soldDate))
    .slice(0, 40)

  if (input.rawOnly) {
    if (rawSales.length > 0) {
      return { recentRawSales: rawSales, recentSlabSales: [] }
    }
    return partitionScrydexListings(rawListings, input.slabGrade)
  }

  const slabResponse = await client.getListings(
    target.game,
    target.scrydexId,
    {
      days: input.days ?? 30,
      company: "PSA",
      grade: String(input.slabGrade),
      pageSize: 40,
    },
    requestOpts,
  )

  const slabListings = slabResponse.data ?? []

  const slabSales = slabListings
    .map(scrydexListingToRecentSale)
    .filter((sale): sale is RecentSale => sale != null)
    .sort((a, b) => b.soldDate.localeCompare(a.soldDate))
    .slice(0, 40)

  if (rawSales.length > 0 || slabSales.length > 0) {
    return { recentRawSales: rawSales, recentSlabSales: slabSales }
  }

  const combined = [...rawListings, ...slabListings]
  return partitionScrydexListings(combined, input.slabGrade)
}
