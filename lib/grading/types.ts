export const GRADING_COMPANIES = ["PSA", "BGS", "CGC", "TAG", "ACE", "SGC"] as const
export type GradingCompany = (typeof GRADING_COMPANIES)[number]

export type SlabGradeRef = {
  company: GradingCompany
  grade: string
}

export const DEFAULT_SLAB_GRADE: SlabGradeRef = { company: "PSA", grade: "9" }

/** Common grade scales per company (Scrydex may return additional grades). */
export const GRADES_BY_COMPANY: Record<GradingCompany, string[]> = {
  PSA: ["7", "8", "9", "10"],
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

export function gradesForCompany(
  company: GradingCompany,
  available?: Array<{ company: string; grade: string }>,
): string[] {
  const fromAvailable = (available ?? [])
    .filter((row) => normalizeGradingCompany(row.company) === company)
    .map((row) => String(row.grade).trim())
    .filter(Boolean)

  const merged = [...new Set([...GRADES_BY_COMPANY[company], ...fromAvailable])]
  return merged.sort((a, b) => {
    const na = Number.parseFloat(a)
    const nb = Number.parseFloat(b)
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
    return a.localeCompare(b)
  })
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
  return { company: normalizedCompany, grade: gradeList.includes("9") ? "9" : gradeList[0] ?? "10" }
}
