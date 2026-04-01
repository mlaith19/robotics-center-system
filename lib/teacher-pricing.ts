import type { Sql } from "postgres"

export type TeacherPricingMethod = "standard" | "per_student_tier"

export type StudentTierRate = {
  upToStudents: number
  hourlyRate: number
}

export function normalizeStudentTierRates(input: unknown): StudentTierRate[] {
  const arr = Array.isArray(input) ? input : []
  const normalized = arr
    .map((item: any) => ({
      upToStudents: Number(item?.upToStudents),
      hourlyRate: Number(item?.hourlyRate),
    }))
    .filter((x) => Number.isFinite(x.upToStudents) && x.upToStudents > 0 && Number.isFinite(x.hourlyRate) && x.hourlyRate >= 0)
    .map((x) => ({ upToStudents: Math.floor(x.upToStudents), hourlyRate: Math.round(x.hourlyRate * 100) / 100 }))
    .sort((a, b) => a.upToStudents - b.upToStudents)

  const dedup: StudentTierRate[] = []
  for (const item of normalized) {
    const idx = dedup.findIndex((x) => x.upToStudents === item.upToStudents)
    if (idx >= 0) dedup[idx] = item
    else dedup.push(item)
  }
  return dedup
}

function isCenterLocation(raw: string | null | undefined): boolean {
  const v = String(raw ?? "").trim().toLowerCase()
  return v === "" || v === "center" || v.includes("מרכז")
}

export function resolveTeacherHourlyRate(params: {
  pricingMethod?: TeacherPricingMethod | null
  centerHourlyRate?: number | null
  externalCourseRate?: number | null
  studentTierRates?: StudentTierRate[] | null
  bonusEnabled?: boolean | null
  bonusMinStudents?: number | null
  bonusPerHour?: number | null
  location?: string | null
  enrollmentCount?: number | null
}): number {
  const method = params.pricingMethod === "per_student_tier" ? "per_student_tier" : "standard"
  const enrollmentCount = Math.max(0, Number(params.enrollmentCount || 0))

  let baseRate = 0
  if (method === "per_student_tier") {
    const tiers = normalizeStudentTierRates(params.studentTierRates || [])
    if (tiers.length > 0) {
      const match = tiers.find((t) => enrollmentCount <= t.upToStudents)
      baseRate = match ? match.hourlyRate : tiers[tiers.length - 1].hourlyRate
    } else {
      baseRate = Number(params.centerHourlyRate || 0)
    }
  } else {
    baseRate = isCenterLocation(params.location) ? Number(params.centerHourlyRate || 0) : Number(params.externalCourseRate || 0)
  }

  const bonusEnabled = params.bonusEnabled === true
  const bonusMinStudents = Number(params.bonusMinStudents || 0)
  const bonusPerHour = Number(params.bonusPerHour || 0)
  if (bonusEnabled && bonusPerHour > 0 && enrollmentCount >= bonusMinStudents && bonusMinStudents > 0) {
    baseRate += bonusPerHour
  }

  return Math.max(0, Math.round(baseRate * 100) / 100)
}

export async function ensureTeacherPricingColumns(sql: Sql) {
  const safe = async (label: string, p: Promise<unknown>) => {
    try {
      await p
    } catch (err) {
      console.warn(`[teacher-pricing] skip ${label}:`, err)
    }
  }
  await safe(
    "pricingMethod",
    sql`ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "pricingMethod" TEXT NOT NULL DEFAULT 'standard'`
  )
  await safe(
    "studentTierRates",
    sql`ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "studentTierRates" JSONB NOT NULL DEFAULT '[]'::jsonb`
  )
  await safe(
    "bonusEnabled",
    sql`ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "bonusEnabled" BOOLEAN NOT NULL DEFAULT FALSE`
  )
  await safe(
    "bonusMinStudents",
    sql`ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "bonusMinStudents" INTEGER`
  )
  await safe(
    "bonusPerHour",
    sql`ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "bonusPerHour" DOUBLE PRECISION NOT NULL DEFAULT 0`
  )
}
