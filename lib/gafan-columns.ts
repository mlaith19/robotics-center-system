import type postgres from "postgres"

export async function ensureGafanLinkColumns(db: ReturnType<typeof postgres>): Promise<void> {
  try {
    await db`ALTER TABLE "Gafan" ADD COLUMN IF NOT EXISTS "schoolId" TEXT`
  } catch (e) {
    console.warn("[gafan] ensure schoolId column:", e)
  }
  try {
    await db`ALTER TABLE "Gafan" ADD COLUMN IF NOT EXISTS "teacherIds" JSONB DEFAULT '[]'::jsonb`
  } catch (e) {
    console.warn("[gafan] ensure teacherIds column:", e)
  }
  try {
    await db`
      CREATE TABLE IF NOT EXISTS "GafanSchoolLink" (
        "gafanId" TEXT NOT NULL,
        "schoolId" TEXT NOT NULL,
        "teacherIds" JSONB DEFAULT '[]'::jsonb,
        "workshopRows" JSONB DEFAULT '[]'::jsonb,
        "allocatedHours" NUMERIC DEFAULT 0,
        "hourRows" JSONB DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GafanSchoolLink_pkey" PRIMARY KEY ("gafanId", "schoolId")
      )
    `
    await db`CREATE INDEX IF NOT EXISTS "GafanSchoolLink_schoolId_idx" ON "GafanSchoolLink"("schoolId")`
  } catch (e) {
    console.warn("[gafan] ensure link table:", e)
  }
  try {
    await db`ALTER TABLE "GafanSchoolLink" ADD COLUMN IF NOT EXISTS "workshopRows" JSONB DEFAULT '[]'::jsonb`
  } catch (e) {
    console.warn("[gafan] ensure workshopRows column:", e)
  }
  try {
    await db`ALTER TABLE "GafanSchoolLink" ADD COLUMN IF NOT EXISTS "allocatedHours" NUMERIC DEFAULT 0`
    await db`ALTER TABLE "GafanSchoolLink" ADD COLUMN IF NOT EXISTS "hourRows" JSONB DEFAULT '[]'::jsonb`
  } catch (e) {
    console.warn("[gafan] ensure hour columns:", e)
  }
  try {
    await db`
      INSERT INTO "GafanSchoolLink" ("gafanId", "schoolId", "teacherIds", "createdAt", "updatedAt")
      SELECT g.id, g."schoolId", COALESCE(g."teacherIds", '[]'::jsonb), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM "Gafan" g
      WHERE g."schoolId" IS NOT NULL AND btrim(g."schoolId") <> ''
      ON CONFLICT ("gafanId", "schoolId") DO NOTHING
    `
  } catch (e) {
    console.warn("[gafan] backfill link table:", e)
  }
  try {
    await db`
      DELETE FROM "GafanSchoolLink" a
      USING "GafanSchoolLink" b
      WHERE a.ctid < b.ctid
        AND a."gafanId" = b."gafanId"
        AND a."schoolId" = b."schoolId"
    `
    await db`CREATE UNIQUE INDEX IF NOT EXISTS "GafanSchoolLink_gafan_school_uidx" ON "GafanSchoolLink"("gafanId", "schoolId")`
  } catch (e) {
    console.warn("[gafan] ensure unique link index:", e)
  }
}

export function normalizeGafanTeacherIds(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean)
  return []
}

export function normalizeGafanWorkshopRows(raw: unknown): Array<{
  kind: string
  groupsCount: number
  studentsCount: number
  grade: string
  hours: number
  price: number
  total: number
}> {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => {
      const row = (r ?? {}) as Record<string, unknown>
      const groupsCount = Number(row.groupsCount ?? 1)
      const studentsCount = Number(row.studentsCount ?? 1)
      const hours = Number(row.hours ?? 0)
      const price = Number(row.price ?? 0)
      const total = Number(row.total ?? hours * price)
      return {
        kind: String(row.kind ?? ""),
        groupsCount: Number.isFinite(groupsCount) && groupsCount > 0 ? groupsCount : 1,
        studentsCount: Number.isFinite(studentsCount) && studentsCount > 0 ? studentsCount : 1,
        grade: String(row.grade ?? ""),
        hours: Number.isFinite(hours) && hours >= 0 ? hours : 0,
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        total: Number.isFinite(total) && total >= 0 ? total : 0,
      }
    })
    .filter((x) => x.kind || x.grade || x.hours > 0 || x.price > 0)
}

export function normalizeGafanAllocatedHours(raw: unknown): number {
  const n = Number(raw ?? 0)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function normalizeGafanHourRows(raw: unknown): Array<{
  date: string
  startTime: string
  endTime: string
  totalHours: number
}> {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => {
      const row = (r ?? {}) as Record<string, unknown>
      const date = String(row.date ?? "")
      const startTime = String(row.startTime ?? "")
      const endTime = String(row.endTime ?? "")
      const totalHours = Number(row.totalHours ?? 0)
      return {
        date,
        startTime,
        endTime,
        totalHours: Number.isFinite(totalHours) && totalHours >= 0 ? totalHours : 0,
      }
    })
    .filter((x) => x.date || x.startTime || x.endTime || x.totalHours > 0)
}
