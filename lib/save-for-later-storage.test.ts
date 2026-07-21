import { describe, expect, it } from "vitest"
import type { MockCardEntry } from "@/lib/slab-data"
import type { SlabLabCard } from "@/lib/slablab"
import {
  ensureSaveForLaterFolders,
  getSavedItemsForSource,
  isSavedForLater,
  toggleSavedForLater,
} from "@/lib/save-for-later-storage"

const slabcrackCard: MockCardEntry = {
  id: "pc-123",
  cardName: "Pikachu",
  setName: "Base",
  cardNumber: "58",
  imageUrl: "",
  rawPrice: 10,
  slabGrade: 9,
  slabPrice: 20,
  deficit: 10,
  percentageSavings: 50,
  marketInsight: "test",
}

const slablabCard: SlabLabCard = {
  id: "lab-1",
  watchlistId: "pc-123",
  name: "Pikachu",
  set: "Base",
  era: "Wizards",
  yearsAgo: 20,
  rawPrice: 10,
  psa10Price: 40,
  psa9Price: 15,
  gradeQuotes: [],
  image: "",
  cardNumber: "58",
}

describe("save-for-later-storage", () => {
  it("creates default folders for both tools", () => {
    const store = ensureSaveForLaterFolders({ folders: [], items: [] })
    expect(store.folders.map((folder) => folder.id)).toEqual(["slabcrack-saved", "slablab-saved"])
  })

  it("toggles slabcrack cards in the saved folder", () => {
    let store = ensureSaveForLaterFolders({ folders: [], items: [] })
    store = toggleSavedForLater(store, { source: "slabcrack", card: slabcrackCard })
    expect(isSavedForLater(store, "slabcrack", "pc-123")).toBe(true)
    expect(getSavedItemsForSource(store, "slabcrack")).toHaveLength(1)

    store = toggleSavedForLater(store, { source: "slabcrack", card: slabcrackCard })
    expect(isSavedForLater(store, "slabcrack", "pc-123")).toBe(false)
    expect(getSavedItemsForSource(store, "slabcrack")).toHaveLength(0)
  })

  it("keeps slablab saves separate from slabcrack", () => {
    let store = ensureSaveForLaterFolders({ folders: [], items: [] })
    store = toggleSavedForLater(store, { source: "slablab", card: slablabCard })
    expect(isSavedForLater(store, "slablab", "pc-123")).toBe(true)
    expect(isSavedForLater(store, "slabcrack", "pc-123")).toBe(false)
  })
})
