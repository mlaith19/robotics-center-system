import type { Sql } from "postgres"
async function ensureCourseManualStatusOverrideColumn(db: Sql): Promise<void> {
  try {
    await db.unsafe(`
      ALTER TABLE "Course"
      ADD COLUMN IF NOT EXISTS "statusManualOverride" boolean NOT NULL DEFAULT false
    `)
  } catch (e) {
    console.warn("[course-status] ensure statusManualOverride column:", e)
  }
}


function startOfTodayLocal(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

/** האם תאריך הסיום (טקסט YYYY-MM-DD או ISO) חלף ביחס ליום המקומי */
export function isCoursePastEndDate(endDate: string | null | undefined): boolean {
  if (endDate == null || String(endDate).trim() === "") return false
  const raw = String(endDate).trim()
  const ymd = raw.length >= 10 ? raw.slice(0, 10) : raw
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) {
    const t = new Date(raw)
    if (Number.isNaN(t.getTime())) return false
    const end = new Date(t.getFullYear(), t.getMonth(), t.getDate())
    return end < startOfTodayLocal()
  }
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const end = new Date(y, mo - 1, d)
  return end < startOfTodayLocal()
}

function isActiveLikeStatus(status: string | null | undefined): boolean {
  const raw = (status || "").toString().trim()
  const s = raw.toLowerCase()
  if (s === "inactive" || s === "draft" || s === "completed") return false
  if (raw === "לא פעיל" || raw === "הושלם") return false
  return s === "active" || s === "" || raw === "פעיל"
}

export function shouldTreatCourseAsCompleted(course: {
  status?: string | null
  endDate?: string | null
  statusManualOverride?: boolean | null
}): boolean {
  if (course.statusManualOverride === true) return false
  const raw = (course.status || "").toString().trim()
  const s = raw.toLowerCase()
  if (s === "completed" || raw === "הושלם") return true
  return isCoursePastEndDate(course.endDate) && isActiveLikeStatus(course.status)
}

export type CourseStatusPresentation = {
  key: string
  labelHe: string
  badgeClassName: string
  cardClassName: string
}

export function getCourseStatusPresentation(course: {
  status?: string | null
  endDate?: string | null
}): CourseStatusPresentation {
  if (shouldTreatCourseAsCompleted(course)) {
    return {
      key: "completed",
      labelHe: "הושלם",
      badgeClassName: "bg-red-100 text-red-800 border border-red-300 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-200",
      cardClassName: "border-2 border-red-400 dark:border-red-700 bg-red-50/60 dark:bg-red-950/20",
    }
  }

  const raw = (course.status || "active").toString().trim()
  const s = raw.toLowerCase()

  if (s === "inactive" || raw === "לא פעיל") {
    return {
      key: "inactive",
      labelHe: "לא פעיל",
      badgeClassName: "bg-red-100 text-red-700 hover:bg-red-100",
      cardClassName: "",
    }
  }
  if (s === "draft") {
    return {
      key: "draft",
      labelHe: "טיוטה",
      badgeClassName: "bg-gray-100 text-gray-700 hover:bg-gray-100",
      cardClassName: "",
    }
  }
  if (s === "upcoming") {
    return {
      key: "upcoming",
      labelHe: "בקרוב",
      badgeClassName: "bg-blue-100 text-blue-700 hover:bg-blue-100",
      cardClassName: "",
    }
  }
  if (s === "active" || raw === "פעיל" || s === "") {
    return {
      key: "active",
      labelHe: "פעיל",
      badgeClassName: "bg-green-100 text-green-700 hover:bg-green-100",
      cardClassName: "",
    }
  }

  return {
    key: s || "unknown",
    labelHe: raw || "—",
    badgeClassName: "bg-gray-100 text-gray-800",
    cardClassName: "",
  }
}

/**
 * מעדכן ב-DB קורסים שפעילים ותאריך הסיום שלהם לפני היום → status = completed
 */
export async function runAutoCompleteExpiredCourses(db: Sql): Promise<void> {
  try {
    await ensureCourseManualStatusOverrideColumn(db)
    await db.unsafe(`
      WITH completed_courses AS (
        UPDATE "Course"
        SET status = 'completed', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "endDate" IS NOT NULL
          AND TRIM("endDate") <> ''
          AND LENGTH(TRIM("endDate")) >= 10
          AND LEFT(TRIM("endDate"), 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          AND (LEFT(TRIM("endDate"), 10))::date < CURRENT_DATE
          AND COALESCE("statusManualOverride", false) = false
          AND (
            LOWER(TRIM(COALESCE(status, ''))) IN ('active', '')
            OR TRIM(COALESCE(status, '')) = 'פעיל'
          )
        RETURNING id
      )
      UPDATE "Enrollment" e
      SET status = 'inactive'
      WHERE e."courseId" IN (SELECT id FROM completed_courses)
        AND (
          LOWER(TRIM(COALESCE(e.status, ''))) IN ('active', '')
          OR TRIM(COALESCE(e.status, '')) IN ('פעיל', 'active')
        )
    `)
  } catch (e) {
    console.warn("[course-status] runAutoCompleteExpiredCourses:", e)
  }
}
