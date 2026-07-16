"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Gift, Loader2 } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { GiveawayEntryPool } from "@/components/giveaway-entry-pool"
import { GiveawayPrizeShowcase } from "@/components/giveaway-prize-showcase"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import {
  FREE_ACTIVE_MINUTES_REQUIRED,
  GIVEAWAY_MAILING_ADDRESS,
  MAIL_IN_ENTRIES_PER_POSTCARD,
  MAX_MAIL_IN_POSTCARDS_PER_MONTH,
  MONTHLY_ENTRY_CAP,
  PREMIUM_ACTIVE_MINUTES_REQUIRED,
  PRO_ACTIVE_MINUTES_REQUIRED,
} from "@/lib/giveaway/constants"
import type { GiveawayEntryPoolData, GiveawayPagePrizeData } from "@/lib/giveaway/types"
import { GiveawayReminderOptIn } from "@/components/giveaway-reminder-opt-in"

type Status = {
  monthPeriod: string
  monthEntries: number
  monthEntriesRemaining: number
  monthlyCap: number
  todayActiveMinutes: number
  todayEntryAwarded: boolean
  thresholdMinutes: number
  isPremium: boolean
  plan: string
  mailInPostcardsUsed: number
  mailInPostcardsMax: number
  promotionTotalEntries: number
}

const EMPTY_PRIZE_DATA: GiveawayPagePrizeData = {
  prize: null,
  cards: [],
  priceBand: null,
  error: null,
}

const EMPTY_ENTRY_POOL: GiveawayEntryPoolData = {
  monthPeriod: "",
  totalEntries: 0,
  error: null,
}

export function GiveawayClient({
  prizeData: initialPrizeData = EMPTY_PRIZE_DATA,
  entryPool: initialEntryPool = EMPTY_ENTRY_POOL,
}: {
  prizeData?: GiveawayPagePrizeData
  entryPool?: GiveawayEntryPoolData
}) {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prizeData, setPrizeData] = useState(initialPrizeData)
  const [entryPool, setEntryPool] = useState(initialEntryPool)
  const [prizeLoading, setPrizeLoading] = useState(!initialPrizeData.prize && !initialPrizeData.error)

  useEffect(() => {
    setPrizeData(initialPrizeData)
    setPrizeLoading(!initialPrizeData.prize && !initialPrizeData.error)
  }, [initialPrizeData])

  useEffect(() => {
    setEntryPool(initialEntryPool)
  }, [initialEntryPool])

  useEffect(() => {
    if (prizeData.prize || prizeData.error) return

    fetch("/api/giveaway/prize-cards", { credentials: "same-origin" })
      .then(async (r) => {
        const json = (await r.json()) as {
          ok?: boolean
          prize?: GiveawayPagePrizeData["prize"]
          cards?: GiveawayPagePrizeData["cards"]
          priceBand?: GiveawayPagePrizeData["priceBand"]
          usedLivePriceCharting?: boolean
          error?: string
        }
        if (!json.ok || !json.prize) {
          setPrizeData({
            prize: null,
            cards: [],
            priceBand: null,
            error: json.error || "Could not load giveaway prize",
          })
          return
        }
        setPrizeData({
          prize: json.prize,
          cards: json.cards ?? [],
          priceBand: json.priceBand ?? null,
          usedLivePriceCharting: json.usedLivePriceCharting,
          error: null,
        })
      })
      .catch(() => {
        setPrizeData({
          prize: null,
          cards: [],
          priceBand: null,
          error: "Could not load giveaway prize",
        })
      })
      .finally(() => setPrizeLoading(false))
  }, [prizeData.prize, prizeData.error])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetch("/api/giveaway/status", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; status?: Status; error?: string }) => {
        if (json.ok && json.status) setStatus(json.status)
        else setError(json.error || "Could not load status")
      })
      .catch(() => setError("Could not load status"))
      .finally(() => setLoading(false))
  }, [user])

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <CollecToolsBrand href="/" size="sm" subtitle="Monthly Giveaway" />
        <SiteAuthButton />
      </header>

      <main className="flex-1 px-4 py-6">
        {prizeLoading ? (
          <section className="mb-8 rounded-3xl border border-border bg-card p-8 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading this month&apos;s giveaway value as of today…
            </div>
          </section>
        ) : prizeData.error ? (
          <section className="mb-8 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Could not load giveaway prize: {prizeData.error}
          </section>
        ) : prizeData.prize ? (
          <GiveawayPrizeShowcase
            prize={prizeData.prize}
            cards={prizeData.cards}
            priceBand={prizeData.priceBand}
            usedLivePriceCharting={prizeData.usedLivePriceCharting}
          />
        ) : null}

        <GiveawayEntryPool
          pool={entryPool}
          liveTotal={status?.promotionTotalEntries}
        />

        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
            <Gift className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Monthly Giveaway</h1>
            <p className="text-sm text-muted-foreground">
              Earn entries by using the app — no purchase necessary. Prize is cash (USD) paid via PayPal only.
            </p>
          </div>
        </div>

        <section className="mb-6 space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
          <h2 className="font-semibold">How to earn entries</h2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Free:</strong> {FREE_ACTIVE_MINUTES_REQUIRED} active minutes/day → 1
              entry
            </li>
            <li>
              <strong className="text-foreground">Premium:</strong> {PREMIUM_ACTIVE_MINUTES_REQUIRED} active minutes/day
              → 1 entry
            </li>
            <li>
              <strong className="text-foreground">Pro / Supreme:</strong> {PRO_ACTIVE_MINUTES_REQUIRED} active
              minutes/day → 1 entry
            </li>
            <li>Max <strong className="text-foreground">1 entry per day</strong> from app use</li>
            <li>
              Max <strong className="text-foreground">{MONTHLY_ENTRY_CAP} entries per month</strong> (app + mail-in
              combined)
            </li>
            <li>
              <strong className="text-foreground">Mail-in (AMOE):</strong> up to{" "}
              {MAX_MAIL_IN_POSTCARDS_PER_MONTH} postcards/month, {MAIL_IN_ENTRIES_PER_POSTCARD} entries each —
              mail to {GIVEAWAY_MAILING_ADDRESS}.{" "}
              <Link href="/giveaway-rules#mail-in" className="font-medium text-primary hover:underline">
                See official rules
              </Link>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Active time counts while you&apos;re signed in and the app tab is open. A drawing runs at the start of each
            month for the prior month&apos;s entries.{" "}
            <Link href="/giveaway-rules" className="font-medium text-primary hover:underline">
              Read the official rules
            </Link>
            .
          </p>
        </section>

        <GiveawayReminderOptIn />

        {!user ? (
          <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <Link href="/sign-in?next=/giveaway" className="font-medium text-primary hover:underline">
              Sign in
            </Link>{" "}
            to track your entries. Active time is recorded automatically while you use Collectools.
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Loading your entries…
          </div>
        ) : error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </p>
        ) : status ? (
          <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <h2 className="mb-3 text-sm font-semibold">Your progress — {status.monthPeriod}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Month entries</p>
                <p className="text-2xl font-bold">
                  {status.monthEntries}
                  <span className="text-base font-normal text-muted-foreground"> / {status.monthlyCap}</span>
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Today&apos;s active time</p>
                <p className="text-2xl font-bold">
                  {status.todayActiveMinutes}
                  <span className="text-base font-normal text-muted-foreground"> / {status.thresholdMinutes} min</span>
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {status.todayEntryAwarded
                ? "Today’s app entry is already earned."
                : status.plan === "pro" || status.plan === "supreme"
                  ? "Pro / Supreme threshold is active."
                  : status.plan === "premium"
                    ? "Premium threshold is active."
                    : "Upgrade to Premium for a 10-minute daily threshold, or Pro for 5 minutes."}
              {status.mailInPostcardsUsed > 0
                ? ` Mail-in postcards this month: ${status.mailInPostcardsUsed}/${status.mailInPostcardsMax}.`
                : ""}
            </p>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  )
}
