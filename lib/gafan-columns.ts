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
}

export function normalizeGafanTeacherIds(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean)
  return []
}
