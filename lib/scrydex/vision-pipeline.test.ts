import { describe, expect, it } from "vitest"
import { visionScanGameScope } from "@/lib/scrydex/vision-pipeline"

describe("visionScanGameScope", () => {
  it("scopes vision to a single game tab", () => {
    expect(visionScanGameScope("pokemon")).toEqual(["pokemon"])
    expect(visionScanGameScope("lorcana")).toEqual(["lorcana"])
    expect(visionScanGameScope("mtg")).toEqual(["mtg"])
  })
})
