import type { Sql } from "postgres"

export const HEBREW_GROUP_LETTERS = [
  "א","ב","ג","ד","ה","ו","ז","ח","ט","י","כ","ל","מ","נ","ס","ע","פ","צ","ק","ר","ש","ת",
]

/** מחזיר את סוג הקורס הבסיסי בלי סיומות תמחור (_total / _session / _hour) */
export function baseCourseType(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "regular"
  return raw.replace(/_total$/, "").replace(/_session$/, "").replace(/_hour$/, "")
}

export function isCampCourseType(raw: string | null | undefined): boolean {
  return baseCourseType(raw) === "camp"
}

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** תאריכי מפגש לקייטנה לפי טווח וימי השבוע (מפתחות באנגלית כמו ב-Course) */
export function listCampSessionDates(
  startYmd: string | null | undefined,
  endYmd: string | null | undefined,
  daysOfWeek: string[] | null | undefined,
): string[] {
  if (!startYmd || !endYmd) return []
  const wanted = new Set<number>()
  const arr = Array.isArray(daysOfWeek) ? daysOfWeek : []
  for (const d of arr) {
    const n = DAY_MAP[String(d).toLowerCase().trim()]
    if (n !== undefined) wanted.add(n)
  }
  if (wanted.size === 0) return []

  const [ys, ms, ds] = startYmd.split("-").map(Number)
  const [ye, me, de] = endYmd.split("-").map(Number)
  if ([ys, ms, ds, ye, me, de].some((n) => Number.isNaN(n))) return []

  const out: string[] = []
  const cur = new Date(ys, ms - 1, ds)
  const end = new Date(ye, me - 1, de)
  if (cur > end) return []

  while (cur.getTime() <= end.getTime()) {
    if (wanted.has(cur.getDay())) out.push(ymd(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export async function ensureCampTables(sql: Sql) {
  const safe = async (label: string, q: Promise<unknown>) => {
    try {
      await q
    } catch (e) {
      console.warn(`[camp-kaytana] skip ${label}:`, e)
    }
  }

  await safe(
    "CampMeeting",
    sql`
      CREATE TABLE IF NOT EXISTS "CampMeeting" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
        "sessionDate" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CampMeeting_course_sessionDate_key" UNIQUE ("courseId", "sessionDate")
      )
    `,
  )
  await safe("CampMeeting idx", sql`CREATE INDEX IF NOT EXISTS "CampMeeting_courseId_idx" ON "CampMeeting"("courseId")`)

  await safe(
    "CampMeetingSlot",
    sql`
      CREATE TABLE IF NOT EXISTS "CampMeetingSlot" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "meetingId" TEXT NOT NULL REFERENCES "CampMeeting"("id") ON DELETE CASCADE,
        "sortOrder" INTEGER NOT NULL,
        "startTime" TEXT NOT NULL,
        "endTime" TEXT NOT NULL,
        "isBreak" BOOLEAN NOT NULL DEFAULT false,
        "breakTitle" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CampMeetingSlot_meeting_sortOrder_key" UNIQUE ("meetingId", "sortOrder")
      )
    `,
  )
  await safe("CampMeetingSlot idx", sql`CREATE INDEX IF NOT EXISTS "CampMeetingSlot_meetingId_idx" ON "CampMeetingSlot"("meetingId")`)

  await safe(
    "CampMeetingCell",
    sql`
      CREATE TABLE IF NOT EXISTS "CampMeetingCell" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "slotId" TEXT NOT NULL REFERENCES "CampMeetingSlot"("id") ON DELETE CASCADE,
        "classroomNo" INTEGER NOT NULL,
        "lessonTitle" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CampMeetingCell_slot_classroom_key" UNIQUE ("slotId", "classroomNo")
      )
    `,
  )
  await safe("CampMeetingCell idx", sql`CREATE INDEX IF NOT EXISTS "CampMeetingCell_slotId_idx" ON "CampMeetingCell"("slotId")`)

  await safe(
    "CampMeetingCellGroup",
    sql`
      CREATE TABLE IF NOT EXISTS "CampMeetingCellGroup" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "cellId" TEXT NOT NULL REFERENCES "CampMeetingCell"("id") ON DELETE CASCADE,
        "groupLabel" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  )
  await safe(
    "CampMeetingCellGroup uniq",
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "CampMeetingCellGroup_cell_group_key" ON "CampMeetingCellGroup"("cellId", "groupLabel")`,
  )

  await safe(
    "CampMeetingCellTeacher",
    sql`
      CREATE TABLE IF NOT EXISTS "CampMeetingCellTeacher" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "cellId" TEXT NOT NULL REFERENCES "CampMeetingCell"("id") ON DELETE CASCADE,
        "teacherId" TEXT NOT NULL REFERENCES "Teacher"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  )
  await safe(
    "CampMeetingCellTeacher uniq",
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "CampMeetingCellTeacher_cell_teacher_key" ON "CampMeetingCellTeacher"("cellId", "teacherId")`,
  )

  await safe(
    "Enrollment campGroupId",
    sql`ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "campGroupId" TEXT`,
  )
  await safe(
    "Enrollment campGroupId idx",
    sql`CREATE INDEX IF NOT EXISTS "Enrollment_campGroupId_idx" ON "Enrollment"("campGroupId")`,
  )
  await safe(
    "Enrollment campGroupLabel",
    sql`ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "campGroupLabel" TEXT`,
  )
  await safe(
    "Enrollment campGroupLabel idx",
    sql`CREATE INDEX IF NOT EXISTS "Enrollment_campGroupLabel_idx" ON "Enrollment"("campGroupLabel")`,
  )

  await safe(
    "center_settings campClassroomsCount",
    sql`ALTER TABLE "center_settings" ADD COLUMN IF NOT EXISTS "camp_classrooms_count" INTEGER NOT NULL DEFAULT 6`,
  )
  await safe(
    "center_settings campClassrooms",
    sql`ALTER TABLE "center_settings" ADD COLUMN IF NOT EXISTS "camp_classrooms" JSONB NOT NULL DEFAULT '[]'::jsonb`,
  )
}
