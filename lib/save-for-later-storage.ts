import type { MockCardEntry } from "@/lib/slab-data"
import type { SlabLabCard } from "@/lib/slablab"

const STORAGE_KEY = "collectools-save-for-later-v1"

export type SavedItemSource = "slabcrack" | "slablab"

export type SavedSlabSnapshot =
  | { source: "slabcrack"; card: MockCardEntry }
  | { source: "slablab"; card: SlabLabCard }

export type SaveForLaterFolder = {
  id: string
  name: string
  source: SavedItemSource
  createdAt: string
}

export type SavedForLaterItem = {
  id: string
  folderId: string
  watchlistId: string
  snapshot: SavedSlabSnapshot
  savedAt: string
}

export type SaveForLaterStore = {
  folders: SaveForLaterFolder[]
  items: SavedForLaterItem[]
}

const DEFAULT_FOLDER_NAMES: Record<SavedItemSource, string> = {
  slabcrack: "Saved for later",
  slablab: "Saved for later",
}

function defaultFolderId(source: SavedItemSource): string {
  return `${source}-saved`
}

function emptyStore(): SaveForLaterStore {
  return { folders: [], items: [] }
}

export function ensureSaveForLaterFolders(store: SaveForLaterStore): SaveForLaterStore {
  const folders = [...store.folders]
  for (const source of ["slabcrack", "slablab"] as const) {
    const id = defaultFolderId(source)
    if (!folders.some((folder) => folder.id === id)) {
      folders.push({
        id,
        name: DEFAULT_FOLDER_NAMES[source],
        source,
        createdAt: new Date().toISOString(),
      })
    }
  }
  return { ...store, folders }
}

export function loadSaveForLaterStore(): SaveForLaterStore {
  if (typeof window === "undefined") return ensureSaveForLaterFolders(emptyStore())

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return ensureSaveForLaterFolders(emptyStore())
    const parsed = JSON.parse(raw) as SaveForLaterStore
    if (!Array.isArray(parsed.folders) || !Array.isArray(parsed.items)) {
      return ensureSaveForLaterFolders(emptyStore())
    }
    return ensureSaveForLaterFolders(parsed)
  } catch {
    return ensureSaveForLaterFolders(emptyStore())
  }
}

export function saveSaveForLaterStore(store: SaveForLaterStore): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureSaveForLaterFolders(store)))
}

export function getFolderForSource(
  store: SaveForLaterStore,
  source: SavedItemSource,
): SaveForLaterFolder {
  const folder = store.folders.find((entry) => entry.id === defaultFolderId(source))
  return (
    folder ?? {
      id: defaultFolderId(source),
      name: DEFAULT_FOLDER_NAMES[source],
      source,
      createdAt: new Date().toISOString(),
    }
  )
}

export function isSavedForLater(
  store: SaveForLaterStore,
  source: SavedItemSource,
  watchlistId: string,
): boolean {
  const folderId = defaultFolderId(source)
  return store.items.some(
    (item) => item.folderId === folderId && item.watchlistId === watchlistId,
  )
}

export function toggleSavedForLater(
  store: SaveForLaterStore,
  snapshot: SavedSlabSnapshot,
): SaveForLaterStore {
  const source = snapshot.source
  const watchlistId =
    source === "slabcrack" ? snapshot.card.id : snapshot.card.watchlistId || snapshot.card.id
  const folderId = defaultFolderId(source)
  const existing = store.items.find(
    (item) => item.folderId === folderId && item.watchlistId === watchlistId,
  )

  if (existing) {
    return {
      ...store,
      items: store.items.filter((item) => item.id !== existing.id),
    }
  }

  return ensureSaveForLaterFolders({
    ...store,
    items: [
      {
        id: `${source}:${watchlistId}`,
        folderId,
        watchlistId,
        snapshot,
        savedAt: new Date().toISOString(),
      },
      ...store.items,
    ],
  })
}

export function getSavedItemsForSource(
  store: SaveForLaterStore,
  source: SavedItemSource,
): SavedForLaterItem[] {
  const folderId = defaultFolderId(source)
  return store.items.filter((item) => item.folderId === folderId && item.snapshot.source === source)
}

export function savedCountForSource(store: SaveForLaterStore, source: SavedItemSource): number {
  return getSavedItemsForSource(store, source).length
}

export function resolveSavedSlabcrackCards(
  store: SaveForLaterStore,
  feedById: Map<string, MockCardEntry>,
): MockCardEntry[] {
  return getSavedItemsForSource(store, "slabcrack")
    .map((item) => {
      if (item.snapshot.source !== "slabcrack") return null
      return feedById.get(item.watchlistId) ?? item.snapshot.card
    })
    .filter((card): card is MockCardEntry => Boolean(card))
}

export function resolveSavedSlabLabCards(
  store: SaveForLaterStore,
  liveById: Map<string, SlabLabCard>,
): SlabLabCard[] {
  return getSavedItemsForSource(store, "slablab")
    .map((item) => {
      if (item.snapshot.source !== "slablab") return null
      return liveById.get(item.watchlistId) ?? item.snapshot.card
    })
    .filter((card): card is SlabLabCard => Boolean(card))
}
