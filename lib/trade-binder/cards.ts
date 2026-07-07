export type CardStatus = "trade" | "wishlist"

export type Rarity = "Common" | "Rare" | "Epic" | "Legendary"

/** A Pokemon card from the TCG API (or any catalog source). */
export type CatalogCard = {
  id: string
  name: string
  set: string
  rarity: Rarity
  image: string
}

/** A card in the user's binder, with a trade/wishlist status. */
export type TcgCard = CatalogCard & {
  status: CardStatus
}
