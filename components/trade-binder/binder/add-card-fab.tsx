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
        <div className="relative mx-auto w-full max-w-md">
          {menuOpen && !pickerOpen && (
            <div className="pointer-events-auto absolute bottom-24 right-4 flex flex-col items-end gap-2">
              <FabAction
                label="Add to Wishlist"
                onClick={() => startAdd("wishlist")}
                className="border-wishlist/70 bg-wishlist text-wishlist-foreground"
                icon={<Heart className="size-4 fill-current" aria-hidden="true" />}
              />
              <FabAction
                label="Add to Binder"
                onClick={() => startAdd("trade")}
                className="border-trade/70 bg-trade text-trade-foreground"
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
                "pointer-events-auto absolute bottom-6 right-4 flex size-14 items-center justify-center rounded-[10px] border-2 border-primary/70 bg-primary text-primary-foreground shadow-[3px_3px_0_0_var(--border)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0.5",
              )}
            >
              <Plus className={cn("size-7 transition-transform duration-200", menuOpen && "rotate-45")} aria-hidden="true" />
            </button>
          )}

          {pickerOpen && (
            <div className="pointer-events-auto absolute inset-x-3 bottom-6 flex max-h-[70vh] flex-col rounded-[10px] border-2 border-border bg-card shadow-[3px_3px_0_0_var(--border)]">
              <div className="flex items-center justify-between border-b-2 border-border p-4">
                <h2 className="font-serif text-lg font-bold uppercase tracking-widest text-card-foreground">
                  {status === "trade" ? "Add To Binder" : "Add To Wishlist"}
                </h2>
                <button
                  type="button"
                  onClick={closeAll}
                  aria-label="Cancel"
                  className="flex size-8 items-center justify-center rounded-xs border-2 border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="relative border-b-2 border-border p-3">
                <Search
                  className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-primary"
                  aria-hidden="true"
                />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="SEARCH POKEMON CARDS..."
                  aria-label="Search Pokemon cards"
                  className="h-11 w-full rounded-xs border-2 border-border bg-input pl-10 pr-10 font-mono text-sm uppercase tracking-wider text-foreground placeholder:text-muted-foreground placeholder:tracking-widest focus-visible:border-primary focus-visible:outline-none"
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
                  <PickerEmpty message="Fetching Pokemon cards..." />
                ) : query.trim().length < 2 ? (
                  <PickerEmpty message="Type at least 2 characters to search" />
                ) : availableResults.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {availableResults.map((card) => (
                      <li key={card.id}>
                        <button
                          type="button"
                          onClick={() => pick(card)}
                          className="flex w-full items-center gap-3 rounded-xs border-2 border-border bg-secondary p-2 text-left transition-colors hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <span className="relative size-12 shrink-0 overflow-hidden rounded-xs border border-border bg-muted">
                            <Image
                              src={card.image || "/placeholder.svg"}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-contain p-0.5"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-serif text-sm font-bold uppercase tracking-wide text-card-foreground">
                              {card.name}
                            </span>
                            <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              {card.set}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest",
                              rarityText[card.rarity],
                            )}
                          >
                            {card.rarity}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <PickerEmpty message="No Pokemon cards match your search" />
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
      <span className="flex size-10 items-center justify-center rounded-xs border-2 border-border bg-secondary text-muted-foreground">
        <PackageX className="size-5" aria-hidden="true" />
      </span>
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground text-pretty">{message}</p>
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
        "flex items-center gap-2 rounded-[10px] border-2 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--border)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0.5",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  )
}
