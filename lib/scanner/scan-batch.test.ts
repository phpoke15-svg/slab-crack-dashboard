import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/slabcrack/detect-card-boxes", () => ({
  detectCardBoxes: vi.fn(),
}))

vi.mock("@/lib/scanner/scan-pipeline", () => ({
  scanCardPipeline: vi.fn(),
}))

vi.mock("@/lib/scanner/crop-server", () => ({
  cropDataUrlRegionServer: vi.fn(async () => "data:image/jpeg;base64,abc"),
  phashFromDataUrlServer: vi.fn(async () => "0".repeat(16)),
}))

import { detectCardBoxes } from "@/lib/slabcrack/detect-card-boxes"
import { scanCardPipeline } from "@/lib/scanner/scan-pipeline"
import { scanBatchPipeline } from "@/lib/scanner/scan-batch"

describe("scanBatchPipeline", () => {
  it("identifies each pre-cropped item", async () => {
    vi.mocked(scanCardPipeline).mockResolvedValue({
      ok: true,
      detected: {
        cardName: "Pikachu",
        setName: "Base",
        cardNumber: "58",
        confidence: 0.9,
      },
      query: "Pikachu 58",
      hit: null,
      candidates: [],
      card: null,
      source: "gemini",
      matchScore: 80,
      pricingSource: "local",
      needsLiveRefresh: false,
      matchMethod: "vision",
    })

    const result = await scanBatchPipeline({
      items: [
        {
          image: "data:image/jpeg;base64,one",
          phash: "a".repeat(16),
          bounds: { x: 0.1, y: 0.1, w: 0.2, h: 0.3, confidence: 0.9 },
        },
        {
          image: "data:image/jpeg;base64,two",
          bounds: { x: 0.5, y: 0.1, w: 0.2, h: 0.3, confidence: 0.8 },
        },
      ],
    })

    expect(result.ok).toBe(true)
    expect(result.cardCount).toBe(2)
    expect(scanCardPipeline).toHaveBeenCalledTimes(2)
    expect(detectCardBoxes).not.toHaveBeenCalled()
  })

  it("detects boxes when only a full frame is provided", async () => {
    vi.mocked(detectCardBoxes).mockResolvedValue({
      ok: true,
      boxes: [{ x: 0, y: 0, w: 0.4, h: 0.5, confidence: 0.95 }],
      source: "gemini",
    })
    vi.mocked(scanCardPipeline).mockResolvedValue({
      ok: true,
      detected: {
        cardName: "Charizard",
        setName: "Base",
        cardNumber: "4",
        confidence: 0.9,
      },
      query: "Charizard 4",
      hit: null,
      candidates: [],
      card: null,
      source: "gemini",
      matchScore: 90,
      pricingSource: "local",
      needsLiveRefresh: false,
      matchMethod: "vision",
    })

    const result = await scanBatchPipeline({
      image: "data:image/jpeg;base64,frame",
    })

    expect(detectCardBoxes).toHaveBeenCalledOnce()
    expect(result.cardCount).toBe(1)
  })
})
