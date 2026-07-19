/** Canonical SlabLabs route paths. */
export const SLABLABS_HREF = "/slablabs"
export const SLABCRACK_HREF = `${SLABLABS_HREF}/slabcrack`
export const SLABPOP_HREF = `${SLABLABS_HREF}/slabpop`
export const SLABIT_HREF = `${SLABLABS_HREF}/slabit`

export type SlabLabsScanTool = "slabcrack" | "slabit"

/** SlabIt was formerly SlabLab — accept legacy id in scan flows. */
export function isSlabItTool(tool: string): boolean {
  return tool === "slabit" || tool === "slablab"
}

export function slabLabsScanBackHref(tool: SlabLabsScanTool | "slablab"): string {
  return isSlabItTool(tool) ? SLABIT_HREF : SLABCRACK_HREF
}

export function slabLabsScanHref(tool: SlabLabsScanTool | "slablab"): string {
  return `${slabLabsScanBackHref(tool)}/scan`
}

export function slabLabsMultiScanHref(tool: SlabLabsScanTool | "slablab"): string {
  return `${slabLabsScanBackHref(tool)}/multi-scan`
}
