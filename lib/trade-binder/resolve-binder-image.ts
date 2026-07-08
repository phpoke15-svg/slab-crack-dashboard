import { resolveCardArtwork, isPlaceholderImage } from "@/lib/card-images"
import {
  bestKnownImageUrl,
  cardImageNeedsUpgrade,
  isPlaceholderCardImage,
  upgradeCardImageUrlSync,
} from "@/lib/card-image-url"
import { resolvePokemonCardImage } from "@/lib/pokemon-tcg"

function parseNumberFromName(name: string): string {
  return name.match(/#(\d+[a-zA-Z/-]*)/)?.[1] ?? ""
}

function cardNumberFromPokemonId(id: string): string {
  if (id.startsWith("pc-") || id.startsWith("poke-")) return ""
  const match = id.match(/-(\d+[a-z]?)$/i)
  return match?.[1] ?? ""
}

function resolvePokemonTcgId(id: string): string | undefined {
  if (id.startsWith("pc-")) return undefined
  if (id.startsWith("poke-")) return id.slice("poke-".length)
  return id
}

function existingImageUrl(imageUrl?: string): string | null {
  if (!imageUrl || isPlaceholderImage(imageUrl)) return null
  if (isPlaceholderCardImage(imageUrl)) return null
  const upgraded = bestKnownImageUrl(imageUrl)
  return upgraded ?? imageUrl
}

export async function resolveBinderCardImage(input: {
  id: string
  name: string
  set: string
  cardNumber?: string
  imageUrl?: string
}): Promise<string | null> {
  const cardNumber =
    input.cardNumber ||
    parseNumberFromName(input.name) ||
    cardNumberFromPokemonId(input.id)
  const pokemonTcgId = resolvePokemonTcgId(input.id)
  const pricechartingId = input.id.startsWith("pc-") ? input.id.replace(/^pc-/, "") : undefined

  const catalog = await resolvePokemonCardImage({
    cardName: input.name,
    setName: input.set,
    cardNumber,
    pokemonTcgId,
  })
  const pokemonImage = catalog?.imageLarge ?? catalog?.imageSmall
  if (pokemonImage) {
    const url = upgradeCardImageUrlSync(pokemonImage)
    if (catalog?.imageLarge) return upgradeCardImageUrlSync(catalog.imageLarge)
    if (!cardImageNeedsUpgrade(url)) return url
    return pokemonImage
  }

  const artwork = await resolveCardArtwork({
    cardName: input.name,
    setName: input.set,
    cardNumber,
    imageUrl: input.imageUrl,
    pricechartingId,
  })
  if (artwork) return upgradeCardImageUrlSync(artwork)

  const existing = existingImageUrl(input.imageUrl)
  return existing ? upgradeCardImageUrlSync(existing) : null
}

export function cardNeedsImage(image?: string): boolean {
  return cardImageNeedsUpgrade(image)
}

export async function attachBinderCardImages<
  T extends { id: string; name: string; set: string; image: string; cardNumber?: string },
>(cards: T[], limit = 16): Promise<T[]> {
  const missing = cards.filter((card) => cardImageNeedsUpgrade(card.image)).slice(0, limit)
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
