import {
  bareTcgIdFromCatalogId,
  inferCardLanguageFromTcgId,
  toPokemonCatalogId,
} from "@/lib/types/card-id"
import type {
  CardLanguage,
  CardPricingUsd,
  PokemonCard,
  PriceHistoryPointUsd,
  PriceHistorySource,
} from "@/lib/types/pokemon-api"
import type { TcgGoCard, TcgGoFetchedPrices, TcgGoHistoryPoint } from "@/lib/tcggo-api"
import { catalogIdFromTcgGoCard, tcgGoCardImageUrl, tcgGoCardNumber, tcgGoCardSetName } from "@/lib/tcggo-api"

export function tcgGoCardToPokemonCard(card: TcgGoCard, language?: CardLanguage): PokemonCard {
  const tcgId = card.tcgid?.trim() ?? bareTcgIdFromCatalogId(catalogIdFromTcgGoCard(card)) ?? ""
  const catalogId = catalogIdFromTcgGoCard(card)
  const front = tcgGoCardImageUrl(card) ?? ""

  return {
    id: catalogId,
    tcgGoId: card.id,
    tcgId,
    tcgplayerId: card.tcgplayer_id,
    name: card.name?.trim() || card.name_numbered?.trim() || "Unknown card",
    setName: tcgGoCardSetName(card),
    setCode: card.episode?.code?.trim(),
    number: tcgGoCardNumber(card),
    rarity: card.rarity ?? null,
    language: language ?? inferCardLanguageFromTcgId(tcgId),
    images: { front },
  }
}

export function tcgGoFetchedPricesToCardPricingUsd(prices: TcgGoFetchedPrices): CardPricingUsd {
  return {
    usdMarket: prices.rawPrice,
    usdLow: prices.rawPrice,
    usdMid: 0,
    psa7Usd: prices.psa7Price,
    psa8Usd: prices.psa8Price,
    psa9Usd: prices.psa9Price,
    psa10Usd: prices.psa10Price,
    currency: "USD",
  }
}

export function tcgGoHistoryPointToUsd(point: TcgGoHistoryPoint): PriceHistoryPointUsd {
  const source: PriceHistorySource = point.grade === 0 ? "tcgplayer" : "ebay"
  return {
    date: point.date,
    grade: point.grade,
    priceUsd: point.price,
    saleCount: point.saleCount,
    source,
  }
}

export function catalogIdFromTcgId(tcgId: string): PokemonCard["id"] {
  return toPokemonCatalogId(tcgId)
}
