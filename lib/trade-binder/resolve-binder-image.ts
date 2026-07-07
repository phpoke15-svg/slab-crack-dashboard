import { resolveCardArtwork, isPlaceholderImage } from "@/lib/card-images"
import { resolvePokemonCardImage } from "@/lib/pokemon-tcg"

function parseNumberFromName(name: string): string {
  return name.match(/#(\d+[a-zA-Z/-]*)/)?.[1] ?? ""
}

function upgradePriceChartingImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes("storage.googleapis.com")) return null
    const match = parsed.pathname.match(/\/([a-z0-9]+)\/(\d+)\.jpg$/i)
    if (!match) return null
    const [, hash, size] = match
    if (Number(size) >= 400) return url
    return `https://storage.googleapis.com/images.pricecharting.com/${hash}/1600.jpg`
  } catch {
    return null
  }
}

function existingImageUrl(imageUrl?: string): string | null {
  if (!imageUrl || isPlaceholderImage(imageUrl)) return null
  const upgraded = upgradePriceChartingImageUrl(imageUrl)
  if (upgraded) return upgraded
  if (imageUrl.includes("images.pokemontcg.io")) return imageUrl
  if (imageUrl.includes("storage.googleapis.com")) {
    const sizeMatch = imageUrl.match(/\/(\d+)\.jpg(?:\?|$)/)
    if (sizeMatch && Number(sizeMatch[1]) >= 160) return imageUrl
  }
  if (!imageUrl.includes("storage.googleapis.com")) return imageUrl
  return null
}

export async function resolveBinderCardImage(input: {
  id: string
  name: string
  set: string
  cardNumber?: string
  imageUrl?: string
}): Promise<string | null> {
  const cardNumber = input.cardNumber || parseNumberFromName(input.name)
  const pokemonTcgId = input.id.startsWith("poke-") ? input.id.replace(/^poke-/, "") : undefined
  const pricechartingId = input.id.startsWith("pc-") ? input.id.replace(/^pc-/, "") : undefined

  if (pokemonTcgId || !pricechartingId) {
    const catalog = await resolvePokemonCardImage({
      cardName: input.name,
      setName: input.set,
      cardNumber,
      pokemonTcgId,
    })
    const pokemonImage = catalog?.imageLarge ?? catalog?.imageSmall
    if (pokemonImage) return pokemonImage
  }

  const artwork = await resolveCardArtwork({
    cardName: input.name,
    setName: input.set,
    cardNumber,
    imageUrl: input.imageUrl,
    pricechartingId,
  })
  if (artwork) return artwork

  return existingImageUrl(input.imageUrl)
}

export function cardNeedsImage(image?: string): boolean {
  if (!image?.trim()) return true
  return isPlaceholderImage(image)
}

export async function attachBinderCardImages<
  T extends { id: string; name: string; set: string; image: string; cardNumber?: string },
>(cards: T[], limit = 16): Promise<T[]> {
  const missing = cards.filter((card) => cardNeedsImage(card.image)).slice(0, limit)
  if (missing.length === 0) return cards

  const resolved = new Map<string, string>()

  for (let i = 0; i < missing.length; i += 3) {
    const batch = missing.slice(i, i + 3)
    await Promise.all(
      batch.map(async (card) => {
        const image = await Promise.race([
          resolveBinderCardImage({
            id: card.id,
            name: card.name,
            set: card.set,
            cardNumber: card.cardNumber,
            imageUrl: card.image,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
        ])
        if (image) resolved.set(card.id, image)
      }),
    )
  }

  return cards.map((card) => (resolved.has(card.id) ? { ...card, image: resolved.get(card.id)! } : card))
}
