export const GRADING_COMPANIES = ["PSA", "BGS", "CGC", "TAG", "ACE", "SGC"] as const
export type GradingCompany = (typeof GRADING_COMPANIES)[number]

export type SlabGradeRef = {
  company: GradingCompany
  grade: string
}

export const DEFAULT_SLAB_GRADE: SlabGradeRef = { company: "PSA", grade: "10" }

export const PSA_NUMERIC_GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const

/** Common grade scales per company (Scrydex may return additional grades). */
export const GRADES_BY_COMPANY: Record<GradingCompany, string[]> = {
  PSA: [...PSA_NUMERIC_GRADES],
  BGS: ["7", "7.5", "8", "8.5", "9", "9.5", "10", "10 BL"],
  CGC: ["7", "8", "9", "9.5", "10", "10 Pristine"],
  TAG: ["8", "9", "10"],
  ACE: ["8", "9", "10"],
  SGC: ["7", "8", "9", "9.5", "10"],
}

export function isGradingCompany(value: string | null | undefined): value is GradingCompany {
  if (!value) return false
  return (GRADING_COMPANIES as readonly string[]).includes(value.toUpperCase())
}

export function normalizeGradingCompany(value: string | null | undefined): GradingCompany {
  const upper = String(value ?? "PSA").trim().toUpperCase()
  return isGradingCompany(upper) ? upper : "PSA"
}

export function slabGradeKey(ref: SlabGradeRef): string {
  return `${ref.company}|${ref.grade}`
}

export function parseSlabGradeKey(key: string): SlabGradeRef | null {
  const [company, ...rest] = key.split("|")
  if (!company || rest.length === 0) return null
  const normalized = normalizeGradingCompany(company)
  return { company: normalized, grade: rest.join("|") }
}

export function formatSlabLabel(ref: SlabGradeRef): string {
  return `${ref.company} ${ref.grade}`
}

export function sortGradesDescending(a: string, b: string): number {
  const na = Number.parseFloat(a)
  const nb = Number.parseFloat(b)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return nb - na
  return b.localeCompare(a)
}

/** PSA 7–10 use legacy chart series keys; PSA 1–6 and other companies use slabSelection. */
export function historyChartGradeProps(ref: SlabGradeRef): {
  grade?: 7 | 8 | 9 | 10
  slabSelection?: SlabGradeRef
} {
  if (ref.company === "PSA" && /^\d+$/.test(ref.grade)) {
    const grade = Number(ref.grade)
    if (grade >= 7 && grade <= 10) return { grade: grade as 7 | 8 | 9 | 10 }
    return { slabSelection: ref }
  }
  if (ref.company === "PSA") return { grade: 10 }
  return { slabSelection: ref }
}

export function gradesForCompany(
  company: GradingCompany,
  available?: Array<{ company: string; grade: string }>,
): string[] {
  const fromAvailable = (available ?? [])
    .filter((row) => normalizeGradingCompany(row.company) === company)
    .map((row) => String(row.grade).trim())
    .filter(Boolean)

  const merged = [...new Set([...GRADES_BY_COMPANY[company], ...fromAvailable])]
  return merged.sort(sortGradesDescending)
}

export function companiesFromGradedRows(
  rows: Array<{ company?: string | null }>,
): GradingCompany[] {
  const found = new Set<GradingCompany>()
  for (const row of rows) {
    const company = normalizeGradingCompany(row.company ?? undefined)
    if ((GRADING_COMPANIES as readonly string[]).includes(company)) found.add(company)
  }
  if (found.size === 0) found.add("PSA")
  return GRADING_COMPANIES.filter((company) => found.has(company))
}

export function coerceSlabGradeRef(
  company: string | null | undefined,
  grade: string | null | undefined,
  available?: Array<{ company: string; grade: string }>,
): SlabGradeRef {
  const normalizedCompany = normalizeGradingCompany(company)
  const gradeList = gradesForCompany(normalizedCompany, available)
  const normalizedGrade = String(grade ?? "").trim()
  if (normalizedGrade && gradeList.includes(normalizedGrade)) {
    return { company: normalizedCompany, grade: normalizedGrade }
  }
  return { company: normalizedCompany, grade: gradeList.includes("10") ? "10" : gradeList[0] ?? "10" }
}
