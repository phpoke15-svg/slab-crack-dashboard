export type CardStatus = "trade" | "wishlist" | "pending"

export const ACTIVE_MATCH_STATUSES: CardStatus[] = ["trade", "wishlist"]

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
  rawPrice?: number
  cardNumber?: string
  /** Primary key from user_binders — used for single-row delete. */
  entryId?: string
  /** Stable unique key for React lists — never reuse catalog ids. */
  clientKey: string
}
