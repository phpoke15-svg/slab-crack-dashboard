export type RestockRetailer = "walmart" | "pokemon_center"

export type RestockProduct = {
  id: string
  retailer: RestockRetailer
  externalId: string
  name: string
  productUrl: string
  imageUrl: string | null
  msrp: number | null
  category: string
  queueLikely: boolean
  active: boolean
  inStock: boolean | null
  price: number | null
  lastCheckedAt: string | null
  lastRestockAt: string | null
  lastSource: string | null
  updatedAt: string
}

export type RestockEvent = {
  id: string
  productId: string
  inStock: boolean
  price: number | null
  source: string
  notedAt: string
}

export type StockSnapshot = {
  inStock: boolean
  price?: number | null
  source: string
  checkedAt?: string
}
