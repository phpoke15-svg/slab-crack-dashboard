"use client"

import { useId } from "react"
import { cn } from "@/lib/utils"
import { GiveawayRewardedAdButton } from "@/components/giveaway-rewarded-ad-button"

export type GiveawayDailyProgressStatus = {
  todayActiveMinutes: number
  todayAdsWatched: number
  adsDailyLimit: number
  adMinutesPerWatch: number
  qualifyingMinutes: number
  thresholdMinutes: number
  todayEntryAwarded: boolean
  canWatchAds: boolean
  plan: string
  monthEntries: number
  monthlyCap: number
}

type GiveawayDailyProgressProps = {
  userId: string
  status: GiveawayDailyProgressStatus
  onRefresh: () => void
  className?: string
}

export function GiveawayDailyProgress({ userId, status, onRefresh, className }: GiveawayDailyProgressProps) {
  const gradientId = useId()
  const progress = Math.min(1, status.qualifyingMinutes / Math.max(1, status.thresholdMinutes))
  const progressPct = Math.round(progress * 100)
  const size = 112
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)
  const showAds = status.adsDailyLimit > 0

  const adButtonDisabled = !status.canWatchAds
  let adDisabledReason: string | undefined
  if (status.todayEntryAwarded) {
    adDisabledReason = "Daily Entry Secured! 🎉"
  } else if (status.todayAdsWatched >= status.adsDailyLimit) {
    adDisabledReason = `Daily ad limit reached (${status.adsDailyLimit}/${status.adsDailyLimit})`
  } else if (status.monthEntries >= status.monthlyCap) {
    adDisabledReason = "Monthly entry cap reached"
  }

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative shrink-0" aria-label={`Daily entry progress ${progressPct}%`}>
          <svg width={size} height={size} className="-rotate-90" role="img">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-500"
            />
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="color-mix(in oklab, var(--primary) 70%, white)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold tabular-nums text-foreground">{progressPct}%</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">today</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <h3 className="font-semibold text-foreground">Daily entry progress</h3>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{status.qualifyingMinutes}</span>
            {" / "}
            {status.thresholdMinutes} qualifying minutes
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              Active time: <span className="text-foreground">{status.todayActiveMinutes} min</span>
            </li>
            {showAds ? (
              <li>
                Ad bonus:{" "}
                <span className="text-foreground">
                  {status.todayAdsWatched} × {status.adMinutesPerWatch} min
                </span>{" "}
                ({status.todayAdsWatched}/{status.adsDailyLimit} ads today)
              </li>
            ) : null}
          </ul>
          {status.todayEntryAwarded ? (
            <p className="text-xs font-medium text-primary">Daily Entry Secured! 🎉</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {Math.max(0, status.thresholdMinutes - status.qualifyingMinutes)} min left for
              today&apos;s entry
            </p>
          )}
        </div>
      </div>

      {showAds ? (
        <GiveawayRewardedAdButton
          userId={userId}
          minutesPerWatch={status.adMinutesPerWatch}
          disabled={adButtonDisabled}
          disabledReason={adDisabledReason}
          onRewardRecorded={onRefresh}
        />
      ) : null}
    </section>
  )
}
