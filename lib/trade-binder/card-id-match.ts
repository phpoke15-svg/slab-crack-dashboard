/** Expand catalog ids so poke- / base set ids match the same card in queries. */
export function cardIdVariants(cardId: string): string[] {
  const id = cardId.trim()
  if (!id) return []

  const variants = new Set<string>([id])
  if (id.startsWith("poke-")) {
    variants.add(id.slice("poke-".length))
  } else if (!id.startsWith("pc-")) {
    variants.add(`poke-${id}`)
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

export function nameSetKey(name: string | null | undefined, set: string | null | undefined): string | null {
  const n = name?.trim().toLowerCase()
  const s = set?.trim().toLowerCase()
  if (!n || !s) return null
  return `${n}::${s}`
}

export function cardsMatchByNameSet(
  a: { cardName: string; cardSet: string },
  b: { card_name?: string | null; card_set?: string | null },
): boolean {
  const keyA = nameSetKey(a.cardName, a.cardSet)
  const keyB = nameSetKey(b.card_name, b.card_set)
  return Boolean(keyA && keyB && keyA === keyB)
}
