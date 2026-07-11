import { NextResponse } from "next/server"
import { getDeficitHistoryForCard } from "@/lib/db/price-snapshots"
import { getDeficitTrendFromHistory, isPsaSlabGrade, type PsaGradeNumber } from "@/lib/slab-data"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim()
  const gradeParam = Number(searchParams.get("grade"))

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }
  if (!isPsaSlabGrade(gradeParam)) {
    return NextResponse.json({ error: "grade must be 7, 8, 9, or 10" }, { status: 400 })
  }

  const grade = gradeParam as PsaGradeNumber

  try {
    const points = await getDeficitHistoryForCard(id, grade, 30)
    const history = points.map((p) => p.deficit)
    const trend = getDeficitTrendFromHistory(history)

    return NextResponse.json({
      id,
      grade,
      history,
      points,
      trend,
      building: trend === "building",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load deficit history"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
