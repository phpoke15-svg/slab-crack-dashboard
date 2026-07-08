"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Plus, X, ArrowLeftRight, Heart, Search, PackageX, Loader2 } from "lucide-react"
import type { CardStatus, CatalogCard, Rarity } from "@/lib/trade-binder/cards"
import { usePokemonSearch } from "@/hooks/trade-binder/use-pokemon-search"
import { cn } from "@/lib/utils"

type AddCardFabProps = {
  ownedIds: Set<string>
  onAdd: (card: CatalogCard, status: CardStatus) => void
}

const rarityText: Record<Rarity, string> = {
  Common: "text-muted-foreground",
  Rare: "text-foreground",
  Epic: "text-wishlist",
  Legendary: "text-primary",
}

export function AddCardFab({ ownedIds, onAdd }: AddCardFabProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [status, setStatus] = useState<CardStatus | null>(null)
  const [query, setQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  const pickerOpen = status !== null
  const { results, isLoading, error } = usePokemonSearch(query, pickerOpen)

  useEffect(() => {
    if (pickerOpen) searchRef.current?.focus()
  }, [pickerOpen])

  const closeAll = () => {
    setStatus(null)
    setMenuOpen(false)
    setQuery("")
  }

  const startAdd = (next: CardStatus) => {
    setStatus(next)
    setMenuOpen(false)
  }

  const availableResults = useMemo(
    () => results.filter((c) => !ownedIds.has(c.id)),
    [results, ownedIds],
  )

  const pick = (card: CatalogCard) => {
    if (!status) return
    onAdd(card, status)
    closeAll()
  }

  return (
    <>
      {(menuOpen || pickerOpen) && (
        <button
          type="button"
          aria-label="Close add menu"
          onClick={closeAll}
          className="fixed inset-0 z-20 bg-background/70 backdrop-blur-sm"
        />
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
        <div className="relative mx-auto w-full max-w-3xl">
          {menuOpen && !pickerOpen && (
            <div className="pointer-events-auto absolute bottom-24 right-4 flex flex-col items-end gap-2 sm:right-6">
              <FabAction
                label="Add to wishlist"
                onClick={() => startAdd("wishlist")}
                className="bg-wishlist/20 text-wishlist"
                icon={<Heart className="size-4 fill-current" aria-hidden="true" />}
              />
              <FabAction
                label="Add for trade"
                onClick={() => startAdd("trade")}
                className="bg-trade/20 text-trade"
                icon={<ArrowLeftRight className="size-4" aria-hidden="true" />}
              />
            </div>
          )}

          {!pickerOpen && (
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close add card menu" : "Add a card"}
              className={cn(
                "pointer-events-auto absolute bottom-6 right-4 flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-4px] shadow-primary/60 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-6",
              )}
            >
              <Plus className={cn("size-7 transition-transform duration-200", menuOpen && "rotate-45")} aria-hidden="true" />
            </button>
          )}

          {pickerOpen && (
            <div className="pointer-events-auto absolute inset-x-3 bottom-6 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl sm:inset-x-6">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-base font-semibold text-foreground">
                  {status === "trade" ? "Add for trade" : "Add to wishlist"}
                </h2>
                <button
                  type="button"
                  onClick={closeAll}
                  aria-label="Cancel"
                  className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="relative border-b border-border p-3">
                <Search
                  className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search any EN/JP card…"
                  aria-label="Search cards"
                  className="h-11 w-full rounded-xl border border-border bg-secondary/60 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50 focus:bg-secondary"
                />
                {isLoading && (
                  <Loader2
                    className="pointer-events-none absolute right-6 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary"
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {error ? (
                  <PickerEmpty message={error} />
                ) : isLoading && availableResults.length === 0 && query.trim().length >= 2 ? (
                  <PickerEmpty message="Loading cards…" />
                ) : query.trim().length < 2 ? (
                  <PickerEmpty message="Type at least 2 characters to search the catalog." />
                ) : availableResults.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {availableResults.map((card, index) => (
                      <li key={`${card.id}-${index}`}>
                        <button
                          type="button"
                          onClick={() => pick(card)}
                          className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/40 p-2 text-left transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                            <Image
                              src={card.image || "/placeholder.svg"}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-contain p-0.5"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{card.name}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{card.set}</span>
                            {"rawPrice" in card && typeof card.rawPrice === "number" && card.rawPrice > 0 && (
                              <span className="block font-mono text-[10px] text-primary tabular-nums">
                                Raw ${card.rawPrice.toFixed(0)}
                              </span>
                            )}
                          </span>
                          <span className={cn("shrink-0 text-[10px] font-medium", rarityText[card.rarity])}>
                            {card.rarity}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <PickerEmpty message="No cards match your search." />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function PickerEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
        <PackageX className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground text-pretty">{message}</p>
    </div>
  )
}

function FabAction({
  label,
  onClick,
  icon,
  className,
}: {
  label: string
  onClick: () => void
  icon: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-medium shadow-lg backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  )
}
