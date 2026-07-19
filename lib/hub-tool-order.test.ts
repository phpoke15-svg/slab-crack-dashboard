import { describe, expect, it } from "vitest"
import { moveHubToolId, normalizeHubToolOrder, orderHubTools, parseHubToolOrder } from "@/lib/hub-tool-order"
import type { CollecTool } from "@/lib/collectools-tools"
import { Layers } from "lucide-react"

function tool(id: string): CollecTool {
  return {
    id,
    href: `/${id}`,
    name: id,
    tagline: "",
    blurb: "",
    description: "",
    icon: Layers,
  }
}

describe("parseHubToolOrder", () => {
  it("migrates legacy slabcrack, slablab, and slabit ids to slablabs", () => {
    expect(parseHubToolOrder(["slabcrack", "binder", "slablab", "slabit"])).toEqual([
      "slablabs",
      "binder",
    ])
  })
})

describe("orderHubTools", () => {
  it("reorders visible tools and appends any missing ids", () => {
    const tools = [tool("a"), tool("b"), tool("c")]
    const ordered = orderHubTools(tools, ["c", "a"])
    expect(ordered.map((t) => t.id)).toEqual(["c", "a", "b"])
  })
})

describe("normalizeHubToolOrder", () => {
  it("fills missing ids and rejects unknown ids", () => {
    expect(normalizeHubToolOrder(["b", "a"], ["a", "b", "c"])).toEqual(["b", "a", "c"])
    expect(normalizeHubToolOrder(["x", "a"], ["a", "b"])).toEqual(["a", "b"])
  })
})

describe("moveHubToolId", () => {
  it("moves an id within the order array", () => {
    expect(moveHubToolId(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"])
  })
})
