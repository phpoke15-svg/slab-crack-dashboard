import type { CollecTool } from "@/lib/collectools-tools"

/** Parse stored hub order; ignores invalid entries. */
export function parseHubToolOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

/**
 * Apply a saved order to the tools visible for this user.
 * Unknown ids are dropped; tools missing from the saved order are appended in default order.
 */
export function orderHubTools(tools: CollecTool[], savedOrder: string[] | null | undefined): CollecTool[] {
  if (!savedOrder?.length) return tools

  const byId = new Map(tools.map((tool) => [tool.id, tool]))
  const ordered: CollecTool[] = []
  const seen = new Set<string>()

  for (const id of savedOrder) {
    const tool = byId.get(id)
    if (!tool || seen.has(id)) continue
    ordered.push(tool)
    seen.add(id)
  }

  for (const tool of tools) {
    if (!seen.has(tool.id)) ordered.push(tool)
  }

  return ordered
}

/** Saved order must be a permutation of the user's currently visible tool ids. */
export function normalizeHubToolOrder(order: string[], allowedIds: string[]): string[] | null {
  const allowed = new Set(allowedIds)
  const unique: string[] = []
  const seen = new Set<string>()

  for (const id of order) {
    if (!allowed.has(id) || seen.has(id)) continue
    unique.push(id)
    seen.add(id)
  }

  for (const id of allowedIds) {
    if (!seen.has(id)) unique.push(id)
  }

  if (unique.length !== allowedIds.length) return null
  return unique
}

export function moveHubToolId(order: string[], fromIndex: number, toIndex: number): string[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length ||
    fromIndex === toIndex
  ) {
    return order
  }
  const next = [...order]
  const [item] = next.splice(fromIndex, 1)
  if (!item) return order
  next.splice(toIndex, 0, item)
  return next
}
