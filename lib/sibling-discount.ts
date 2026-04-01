import type { Sql } from "postgres"

export type SiblingDiscountPackage = {
  id: string
  name: string
  description: string | null
  firstAmount: number
  secondAmount: number
  thirdAmount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const INACTIVE_STATUSES = new Set(["inactive", "completed", "stopped", "לא פעיל", "הושלם", "הפסיק"])

export async function ensureSiblingDiscountTables(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS "SiblingDiscountPackage" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "firstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "secondAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "thirdAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    ALTER TABLE "Student"
    ADD COLUMN IF NOT EXISTS "siblingGroupId" TEXT
  `

  await sql`
    CREATE INDEX IF NOT EXISTS "idx_student_sibling_group"
    ON "Student" ("siblingGroupId")
  `
}

export function normalizeAmount(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

export function normalizeSiblingPayload(body: any) {
  return {
    name: String(body?.name ?? "").trim(),
    description: String(body?.description ?? "").trim() || null,
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

