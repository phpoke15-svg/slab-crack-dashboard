import { resolveBinderSetIdHint } from "@/lib/trade-binder/pokemon-tcg"

type SetMatchRow = {
  set_name: string
  set_id?: string | null
  set_code?: string | null
  id?: string | null
  catalog_id?: string | null
}

/** True when a catalog row belongs to the user's set shorthand (151, prismatic, sv8pt5, …). */
export function catalogRowMatchesSetHint(row: SetMatchRow, setHint: string): boolean {
  const hint = setHint.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (!hint) return true

  const resolved = resolveBinderSetIdHint(setHint)?.toLowerCase()
  const setCompact = row.set_name.toLowerCase().replace(/[^a-z0-9]/g, "")
  const setId = String(row.set_id ?? row.set_code ?? "").toLowerCase()
  const idLower = String(row.id ?? row.catalog_id ?? "").toLowerCase()

  if (resolved) {
    if (setId === resolved || setCompact.includes(resolved) || idLower.includes(resolved)) return true
    if (idLower.includes(`poke-${resolved}-`) || idLower.includes(`pokemon-${resolved}-`)) return true
  }

  if (setCompact.includes(hint) || setId.includes(hint)) return true
  if (idLower.includes(`poke-${hint}-`) || idLower.includes(`pokemon-${hint}-`)) return true
  return false
}
