import type { Sql } from "postgres"

export type SiblingDiscountPackage = {
  id: string
  name: string
  description: string | null
  pricingMode: "perStudent" | "perCourse" | "perSession" | "perHour"
  firstAmount: number
  secondAmount: number
  thirdAmount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const INACTIVE_STATUSES = new Set(["inactive", "completed", "stopped", "לא פעיל", "הושלם", "הפסיק"])

export async function ensureSiblingDiscountTables(sql: Sql) {
  const safeExec = async (label: string, query: Promise<unknown>) => {
    try {
      await query
    } catch (err) {
      console.warn(`[sibling-discount] skip ${label}:`, err)
    }
  }

  await safeExec(
    "create sibling package table",
    sql`
      CREATE TABLE IF NOT EXISTS "SiblingDiscountPackage" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "pricingMode" TEXT NOT NULL DEFAULT 'perCourse',
        "firstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "secondAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "thirdAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `
  )

  await safeExec(
    "add student sibling group column",
    sql`
      ALTER TABLE "Student"
      ADD COLUMN IF NOT EXISTS "siblingGroupId" TEXT
    `
  )
  await safeExec(
    "add student package column",
    sql`
      ALTER TABLE "Student"
      ADD COLUMN IF NOT EXISTS "siblingDiscountPackageId" TEXT
    `
  )
  await safeExec(
    "add course package column",
    sql`
      ALTER TABLE "Course"
      ADD COLUMN IF NOT EXISTS "siblingDiscountPackageId" TEXT
    `
  )

  await safeExec(
    "create student sibling group index",
    sql`
      CREATE INDEX IF NOT EXISTS "idx_student_sibling_group"
      ON "Student" ("siblingGroupId")
    `
  )
  await safeExec(
    "create course sibling package index",
    sql`
      CREATE INDEX IF NOT EXISTS "idx_course_sibling_package"
      ON "Course" ("siblingDiscountPackageId")
    `
  )
}

export function normalizeAmount(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

export function normalizeSiblingPayload(body: any) {
  const pricingModeRaw = String(body?.pricingMode ?? "perCourse")
  const pricingMode =
    pricingModeRaw === "perStudent" || pricingModeRaw === "perSession" || pricingModeRaw === "perHour"
      ? pricingModeRaw
      : "perCourse"
  return {
    name: String(body?.name ?? "").trim(),
    description: String(body?.description ?? "").trim() || null,
    pricingMode,
    firstAmount: normalizeAmount(body?.firstAmount),
    secondAmount: normalizeAmount(body?.secondAmount),
    thirdAmount: normalizeAmount(body?.thirdAmount),
    isActive: body?.isActive !== false,
  }
}

export async function getSiblingRank(sql: Sql, studentId: string): Promise<number | null> {
  const rows = await sql<
    { id: string; status: string | null; createdAt: string | null }[]
  >`
    SELECT "id", "status", "createdAt"
    FROM "Student"
    WHERE "siblingGroupId" = (
      SELECT "siblingGroupId" FROM "Student" WHERE "id" = ${studentId}
    )
  `
  if (!rows.length) return null
  const active = rows
    .filter((s) => !INACTIVE_STATUSES.has(String(s.status ?? "").trim().toLowerCase()))
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      if (aTime !== bTime) return aTime - bTime
      return a.id.localeCompare(b.id)
    })
  const idx = active.findIndex((s) => s.id === studentId)
  return idx >= 0 ? idx + 1 : null
}

export function resolveSiblingAmountByRank(pkg: SiblingDiscountPackage, rank: number | null): number | null {
  if (!rank || rank <= 0) return null
  if (rank === 1) return pkg.firstAmount
  if (rank === 2) return pkg.secondAmount
  return pkg.thirdAmount
}

function diffHours(startTime: string | null | undefined, endTime: string | null | undefined): number {
  if (!startTime || !endTime) return 0
  const sh = startTime.slice(0, 2)
  const sm = startTime.slice(3, 5)
  const eh = endTime.slice(0, 2)
  const em = endTime.slice(3, 5)
  const start = Number(sh) * 60 + Number(sm)
  const end = Number(eh) * 60 + Number(em)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return (end - start) / 60
}

export function resolveEffectiveCoursePriceByPackage(
  packagePricingMode: "perStudent" | "perCourse" | "perSession" | "perHour",
  amountForRank: number,
  course: { duration?: number | null; startTime?: string | null; endTime?: string | null }
): number {
  if (packagePricingMode === "perStudent") return Math.max(0, amountForRank)
  if (packagePricingMode === "perCourse") return Math.max(0, amountForRank)
  const sessions = Math.max(0, Number(course.duration || 0))
  if (packagePricingMode === "perSession") return Math.max(0, amountForRank * sessions)
  const hours = diffHours(course.startTime, course.endTime)
  return Math.max(0, amountForRank * sessions * hours)
}

