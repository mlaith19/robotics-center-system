import type postgres from "postgres"

/** עמודות שיוך בית ספר ומורים — חסרות בחלק ממסדי הטננט הישנים וגורמות ל־500 ב־JOIN */
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
}

export function normalizeGafanTeacherIds(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean)
  return []
}
