import { NextResponse } from "next/server"
import { getDailyPriceHistory } from "@/lib/db/price-history"
import {
  analyzeDeficitHistory,
  getDeficitTrendFromHistory,
  isPsaSlabGrade,
  type PsaGradeNumber,
} from "@/lib/slab-data"

export const dynamic = "force-dynamic"

function clampDays(value: number): number {
  if (!Number.isFinite(value)) return 30
  return Math.min(Math.max(Math.round(value), 7), 90)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim()
  const gradeParam = Number(searchParams.get("grade"))
  const days = clampDays(Number(searchParams.get("days") ?? 30))

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }
  if (!isPsaSlabGrade(gradeParam)) {
    return NextResponse.json({ error: "grade must be 7, 8, 9, or 10" }, { status: 400 })
  }

  const grade = gradeParam as PsaGradeNumber

  try {
    const { points, salesDays, snapshotDays } = await getDailyPriceHistory(id, grade, days)
    const history = points.map((p) => p.deficit)
    const trend = getDeficitTrendFromHistory(history)
    const analysis = analyzeDeficitHistory(history)

    return NextResponse.json({
      id,
      grade,
      days,
      history,
      points,
      trend,
      building: trend === "building",
      analysis,
      salesDays,
      snapshotDays,
      hasSalesHistory: salesDays > 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load price history"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
