import type { CollecTool } from "@/lib/collectools-tools"

/** Legacy hub tile ids collapsed into SlabLabs. */
const LEGACY_HUB_TOOL_IDS: Record<string, string> = {
  slabcrack: "slablabs",
  slablab: "slablabs",
  slabit: "slablabs",
}

/** Parse stored hub order; ignores invalid entries and migrates legacy tool ids. */
export function parseHubToolOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const order: string[] = []

  for (const item of raw) {
    const id = typeof item === "string" ? item.trim() : ""
    if (!id) continue
    const migrated = LEGACY_HUB_TOOL_IDS[id] ?? id
    if (seen.has(migrated)) continue
    seen.add(migrated)
    order.push(migrated)
  }

  return order
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
