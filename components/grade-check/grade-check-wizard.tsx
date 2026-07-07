"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Check, Loader2, Search, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { CardSearchResults, type CardSearchHit } from "@/components/card-search-results"
import { searchHitToPlaceholder } from "@/lib/card-lookup"
import { normalizeCardEntry, type MockCardEntry } from "@/lib/slab-data"
import {
  DEFAULT_BORDER_INSETS,
  DEFAULT_EXTENDED_CONDITION,
  type ExtendedGradeCondition,
} from "@/lib/grade-estimate"
import { CardPhotoCapture, type CardPhotos } from "@/components/grade-check/card-photo-capture"
import { CenteringHelper } from "@/components/grade-check/centering-helper"
import { GradeCheckCondition } from "@/components/grade-check/grade-check-condition"
import { GradeCheckResult } from "@/components/grade-check/grade-check-result"

const STEPS = ["card", "photos", "centering", "condition", "result"] as const
type Step = (typeof STEPS)[number]

const STEP_LABELS: Record<Step, string> = {
  card: "Card",
  photos: "Photos",
  centering: "Centering",
  condition: "Condition",
  result: "Result",
}

export function GradeCheckWizard() {
  const [step, setStep] = useState<Step>("card")
  const [query, setQuery] = useState("")
  const [searchHits, setSearchHits] = useState<CardSearchHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedHit, setSelectedHit] = useState<CardSearchHit | null>(null)
  const [card, setCard] = useState<MockCardEntry | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [photos, setPhotos] = useState<CardPhotos>({ front: null, back: null })
  const [borders, setBorders] = useState(DEFAULT_BORDER_INSETS)
  const [condition, setCondition] = useState<ExtendedGradeCondition>(DEFAULT_EXTENDED_CONDITION)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSearchHits([])
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    const timer = window.setTimeout(() => {
      fetch(`/api/cards/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: CardSearchHit[] }) => setSearchHits(data.results ?? []))
        .catch(() => setSearchHits([]))
        .finally(() => setSearchLoading(false))
    }, 350)

    return () => window.clearTimeout(timer)
  }, [query])

  const lookupCard = useCallback(async (hit: CardSearchHit) => {
    setLookupLoading(true)
    try {
      const params = hit.id.startsWith("pc-")
        ? new URLSearchParams({ id: hit.id })
        : new URLSearchParams({
            pokemonTcgId: hit.pokemonTcgId,
            cardName: hit.cardName,
            setName: hit.setName,
            cardNumber: hit.cardNumber,
          })
      if (!hit.id.startsWith("pc-") && hit.imageUrl) params.set("imageUrl", hit.imageUrl)

      const res = await fetch(`/api/cards/lookup?${params.toString()}`)
      if (!res.ok) return searchHitToPlaceholder(hit)
      return normalizeCardEntry((await res.json()) as MockCardEntry)
    } catch {
      return searchHitToPlaceholder(hit)
    } finally {
      setLookupLoading(false)
    }
  }, [])

  const selectCard = async (hit: CardSearchHit) => {
    setSelectedHit(hit)
    setCard(searchHitToPlaceholder(hit))
    const loaded = await lookupCard(hit)
    setCard(loaded)
  }

  const stepIndex = STEPS.indexOf(step)

  const canContinue = (() => {
    if (step === "card") return Boolean(card && selectedHit)
    if (step === "photos") return Boolean(photos.front)
    if (step === "centering") return Boolean(photos.front)
    if (step === "condition") return true
    return true
  })()

  const goNext = () => {
    const next = STEPS[stepIndex + 1]
    if (next) setStep(next)
  }

  const goBack = () => {
    const prev = STEPS[stepIndex - 1]
    if (prev) setStep(prev)
  }

  const handleCenteringScore = useCallback((score: number) => {
    setCondition((prev) => ({ ...prev, centering: score }))
  }, [])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-4 pt-5 pb-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Tools
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h1 className="text-base font-bold text-foreground">Grade Check</h1>
                <p className="text-[10px] text-muted-foreground">Pre-submission estimator</p>
              </div>
            </div>
            <CollecToolsBrand href="/" size="sm" className="opacity-80" />
          </div>

          <div className="mt-4 flex gap-1">
            {STEPS.map((key, index) => (
              <div
                key={key}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  index <= stepIndex ? "bg-primary" : "bg-secondary",
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Step {stepIndex + 1} of {STEPS.length}: {STEP_LABELS[step]}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 sm:px-6">
        {step === "card" && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Choose a card</h2>
              <p className="text-sm text-muted-foreground">
                Search any card to pull live PSA 7–10 comps for your estimate.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. charizard 151, pikachu 227"
                className="h-11 w-full rounded-xl border border-border bg-secondary/60 pl-10 pr-4 text-sm outline-none focus:border-primary/50"
              />
            </div>
            <CardSearchResults
              hits={searchHits}
              loading={searchLoading}
              query={query}
              watchedIds={[]}
              isHitWatched={() => false}
              onSelect={selectCard}
              onToggleWatch={() => {}}
              detailLoadingId={lookupLoading ? selectedHit?.id ?? null : null}
            />
            {card && selectedHit && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="relative aspect-[3/4] w-12 overflow-hidden rounded-md border border-white/10">
                  <Image
                    src={card.imageUrl || selectedHit.imageUrl || "/placeholder.svg"}
                    alt=""
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{card.cardName}</p>
                  <p className="truncate text-xs text-muted-foreground">{card.setName}</p>
                </div>
                <Check className="size-5 shrink-0 text-primary" />
              </div>
            )}
          </div>
        )}

        {step === "photos" && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Add photos</h2>
              <p className="text-sm text-muted-foreground">
                Photos stay on your device — they are not uploaded to our servers.
              </p>
            </div>
            <CardPhotoCapture photos={photos} onChange={setPhotos} />
          </div>
        )}

        {step === "centering" && photos.front && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Measure centering</h2>
              <p className="text-sm text-muted-foreground">
                Align the box with the printed art border on your front photo.
              </p>
            </div>
            <CenteringHelper
              imageUrl={photos.front}
              borders={borders}
              onChange={setBorders}
              onCenteringScore={handleCenteringScore}
            />
          </div>
        )}

        {step === "condition" && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Rate condition</h2>
              <p className="text-sm text-muted-foreground">
                Be conservative — graders weight the weakest subgrade heavily.
              </p>
            </div>
            <GradeCheckCondition values={condition} onChange={setCondition} />
          </div>
        )}

        {step === "result" && card && (
          <GradeCheckResult card={card} condition={condition} frontPhoto={photos.front} />
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="flex gap-2">
          {stepIndex > 0 && step !== "result" && (
            <button
              type="button"
              onClick={goBack}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          )}
          {step !== "result" ? (
            <button
              type="button"
              disabled={!canContinue || lookupLoading}
              onClick={goNext}
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {lookupLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Loading comps…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          ) : (
            <Link
              href="/"
              className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              Back to tools
            </Link>
          )}
        </div>
      </footer>
    </div>
  )
}
