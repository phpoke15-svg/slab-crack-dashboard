"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  GripVertical,
  LayoutGrid,
  Loader2,
  X,
} from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteFooter } from "@/components/legal/site-footer"
import { FooterAd } from "@/components/footer-ad"
import { SiteAuthButton } from "@/components/site-auth-button"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import { hubToolsForUser, type CollecTool } from "@/lib/collectools-tools"
import { moveHubToolId, orderHubTools, parseHubToolOrder } from "@/lib/hub-tool-order"
import { SLABLABS_SUBTOOLS } from "@/lib/slabs-labs-tools"
import { cn } from "@/lib/utils"

function HubToolTile({
  tool,
  editMode,
  dragOver,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  tool: CollecTool
  editMode: boolean
  dragOver: boolean
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (event: React.DragEvent) => void
  onDrop: () => void
}) {
  const Icon = tool.icon

  return (
    <button
      type="button"
      draggable={editMode}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", tool.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(event) => {
        event.preventDefault()
        onDrop()
      }}
      onClick={() => {
        if (!editMode) onOpen()
      }}
      className={cn(
        "group flex w-full flex-col items-start gap-2 rounded-xl border bg-card/60 p-3 text-left transition-colors",
        editMode
          ? "cursor-grab border-dashed border-primary/50 bg-primary/[0.04] active:cursor-grabbing"
          : "border-border hover:border-primary/40 hover:bg-card",
        dragOver && "border-primary ring-2 ring-primary/30",
        tool.supremeOnly && !editMode && "border-primary/25 bg-primary/[0.03]",
      )}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {editMode ? (
            <GripVertical className="size-4 shrink-0 text-primary" aria-hidden />
          ) : null}
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Icon className="size-4" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex flex-wrap items-center gap-1.5">
            <span className="text-base font-bold leading-tight text-foreground sm:text-lg">
              {tool.name}
            </span>
            {tool.supremeOnly ? (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                Supreme
              </span>
            ) : null}
          </span>
        </span>
        {!editMode ? (
          <ArrowRight className="mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        ) : null}
      </span>
      <span className={cn("min-w-0 w-full", editMode ? "pl-[4.25rem]" : "pl-11")}>
        <span className="block text-xs leading-snug text-muted-foreground line-clamp-2">
          {tool.blurb}
        </span>
      </span>
    </button>
  )
}

function HubGiveawayBlock({
  tool,
  onOpen,
}: {
  tool: CollecTool
  onOpen: () => void
}) {
  const Icon = tool.icon

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group mb-3 flex w-full flex-col items-start gap-3 rounded-xl border border-primary/35 bg-primary/[0.07] p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/[0.11] sm:p-5"
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/15 text-primary sm:size-12">
            <Icon className="size-5 sm:size-6" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold leading-tight text-foreground sm:text-xl">
              {tool.name}
            </span>
            <span className="mt-0.5 block text-xs font-medium text-primary sm:text-sm">
              {tool.tagline}
            </span>
          </span>
        </span>
        <ArrowRight className="mt-2 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </span>
      <span className="w-full pl-14 sm:pl-[3.75rem]">
        <span className="block text-sm leading-snug text-muted-foreground sm:text-base">
          {tool.blurb}
        </span>
      </span>
    </button>
  )
}

export function CollecToolsHub() {
  const entitlements = useOptionalEntitlements()
  const showUpgrade =
    !entitlements?.isLoading && entitlements?.signedIn && entitlements.plan === "free"
  const showProNudge =
    !entitlements?.isLoading && entitlements?.signedIn && entitlements.plan === "premium"
  const canCustomize =
    Boolean(
      entitlements?.signedIn &&
        !entitlements?.isLoading &&
        (entitlements?.customHubLayout || entitlements?.supreme),
    )

  const defaultTools = useMemo(
    () => hubToolsForUser({ supreme: Boolean(entitlements?.supreme) }),
    [entitlements?.supreme],
  )
  const defaultOrder = useMemo(() => defaultTools.map((tool) => tool.id), [defaultTools])

  const [savedOrder, setSavedOrder] = useState<string[] | null>(null)
  const [draftOrder, setDraftOrder] = useState<string[]>(defaultOrder)
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderLoaded, setOrderLoaded] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [selected, setSelected] = useState<CollecTool | null>(null)

  const activeOrder = editMode ? draftOrder : savedOrder ?? defaultOrder
  const tools = useMemo(
    () => orderHubTools(defaultTools, activeOrder),
    [activeOrder, defaultTools],
  )
  const giveawayTool = useMemo(
    () => defaultTools.find((tool) => tool.id === "giveaway") ?? null,
    [defaultTools],
  )
  const gridTools = useMemo(
    () => tools.filter((tool) => tool.id !== "giveaway"),
    [tools],
  )

  const loadSavedOrder = useCallback(async () => {
    if (!canCustomize) {
      setSavedOrder(null)
      setOrderLoaded(true)
      return
    }
    setOrderLoading(true)
    try {
      const res = await fetch("/api/hub/tool-order", { credentials: "same-origin" })
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        toolOrder?: string[] | null
        error?: string
      } | null
      if (res.ok && json?.ok) {
        const parsed = parseHubToolOrder(json.toolOrder)
        setSavedOrder(parsed.length ? parsed : null)
      } else {
        setSavedOrder(null)
      }
    } catch {
      setSavedOrder(null)
    } finally {
      setOrderLoading(false)
      setOrderLoaded(true)
    }
  }, [canCustomize])

  useEffect(() => {
    void loadSavedOrder()
  }, [loadSavedOrder])

  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null)
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [selected])

  const startEdit = () => {
    setDraftOrder(savedOrder ?? defaultOrder)
    setSaveError(null)
    setEditMode(true)
  }

  const cancelEdit = () => {
    setDraftOrder(savedOrder ?? defaultOrder)
    setDraggingId(null)
    setDragOverId(null)
    setSaveError(null)
    setEditMode(false)
  }

  const saveOrder = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch("/api/hub/tool-order", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolOrder: draftOrder }),
      })
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        toolOrder?: string[]
        error?: string
      } | null
      if (!res.ok || !json?.ok || !json.toolOrder?.length) {
        throw new Error(json?.error || "Could not save layout")
      }
      setSavedOrder(json.toolOrder)
      setDraftOrder(json.toolOrder)
      setEditMode(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save layout")
    } finally {
      setSaving(false)
    }
  }

  const handleDropOn = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return
    const fromIndex = draftOrder.indexOf(draggingId)
    const toIndex = draftOrder.indexOf(targetId)
    if (fromIndex < 0 || toIndex < 0) return
    setDraftOrder(moveHubToolId(draftOrder, fromIndex, toIndex))
    setDraggingId(null)
    setDragOverId(null)
  }

  return (
    <div className="hub-shell mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <CollecToolsBrand
            href={undefined}
            size="lg"
            asHeading
            subtitle="Pokémon TCG collector toolkit"
          />
          <SiteAuthButton className="shrink-0" />
        </div>

        <div className="mt-5 w-full space-y-3">
          <p className="w-full text-base font-medium leading-snug text-foreground sm:text-lg">
            The Ultimate Tool Kit for Pokemon Card Collectors!
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/pricing"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card/60 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40"
            >
              View membership tiers
              <span className="ml-1.5 font-medium text-muted-foreground">Free · Premium · Pro</span>
            </Link>
            {canCustomize ? (
              editMode ? (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveOrder()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Save layout
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={cancelEdit}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground"
                  >
                    <X className="size-3.5" />
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={orderLoading || !orderLoaded}
                  onClick={startEdit}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40"
                >
                  {orderLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <LayoutGrid className="size-3.5" />
                  )}
                  Reorder tools
                </button>
              )
            ) : null}
          </div>
        </div>
      </header>

      {showUpgrade ? (
        <p className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          Go Premium from $4.99/mo for full SlabCrack, ad-free.{" "}
          <Link href="/pricing" className="font-medium text-primary hover:underline">
            View plans
          </Link>
        </p>
      ) : null}
      {showProNudge ? (
        <p className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          You&apos;re on Premium. Unlock Pokemon Center PokeWatch with Pro.{" "}
          <Link href="/pricing" className="font-medium text-primary hover:underline">
            Upgrade
          </Link>
        </p>
      ) : null}

      {editMode ? (
        <p className="mb-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          Drag and drop tiles where you want them. Tap{" "}
          <span className="font-medium text-foreground">Save layout</span> when you&apos;re done — your
          order syncs to your account.
        </p>
      ) : null}
      {saveError ? (
        <p className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {saveError}
        </p>
      ) : null}

      {giveawayTool && !editMode ? (
        <HubGiveawayBlock tool={giveawayTool} onOpen={() => setSelected(giveawayTool)} />
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {gridTools.map((tool) => (
          <HubToolTile
            key={tool.id}
            tool={tool}
            editMode={editMode}
            dragOver={dragOverId === tool.id}
            onOpen={() => setSelected(tool)}
            onDragStart={() => setDraggingId(tool.id)}
            onDragEnd={() => {
              setDraggingId(null)
              setDragOverId(null)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOverId(tool.id)
            }}
            onDrop={() => handleDropOn(tool.id)}
          />
        ))}
      </div>

      <FooterAd className="mt-10" />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/pricing" className="font-medium text-primary hover:underline">
          Premium & Pro plans
        </Link>
        {" · "}
        ad-free full SlabCrack from $4.99/mo · PokeWatch with Pro · all tiers earn monthly giveaway entries
        {canCustomize ? (
          <>
            {" · "}
            <span className="text-foreground">
              {entitlements?.supreme ? "Supreme" : "Pro"} can drag-and-drop hub tools
            </span>
          </>
        ) : null}
      </p>
      <SiteFooter className="mt-auto pt-10" />

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close tool details"
            onClick={() => setSelected(null)}
            className="absolute inset-0 modal-backdrop bg-black/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} details`}
            className="relative z-10 flex max-h-[85vh] w-full max-w-lg modal-panel flex-col overflow-hidden rounded-t-3xl border border-border bg-popover sm:rounded-3xl"
          >
            <div className="relative flex items-center justify-center pt-3">
              <span className="h-1.5 w-10 rounded-full bg-border sm:hidden" />
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-5 pt-2">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <selected.icon className="size-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">{selected.name}</h2>
                    {selected.supremeOnly ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Supreme
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{selected.tagline}</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {selected.description}
              </p>

              {selected.highlights && selected.highlights.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {selected.highlights.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-primary" aria-hidden>
                        ·
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {selected.id === "slablabs" ? (
                <div className="mt-4 grid gap-2">
                  {SLABLABS_SUBTOOLS.map((tool) => {
                    const Icon = tool.icon
                    return (
                      <Link
                        key={tool.id}
                        href={tool.href}
                        onClick={() => setSelected(null)}
                        className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-card"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                          <Icon className="size-4" strokeWidth={2} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{tool.name}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{tool.blurb}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              ) : null}

              <Link
                href={selected.href}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open {selected.name}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
