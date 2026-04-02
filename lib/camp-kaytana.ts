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
    "CampGroup",
    sql`
      CREATE TABLE IF NOT EXISTS "CampGroup" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
        "label" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  )
  await safe("CampGroup idx", sql`CREATE INDEX IF NOT EXISTS "CampGroup_courseId_idx" ON "CampGroup"("courseId")`)

  await safe(
    "CampRoom",
    sql`
      CREATE TABLE IF NOT EXISTS "CampRoom" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
        "label" TEXT NOT NULL,
        "teacherId" TEXT REFERENCES "Teacher"("id") ON DELETE SET NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  )
  await safe("CampRoom idx", sql`CREATE INDEX IF NOT EXISTS "CampRoom_courseId_idx" ON "CampRoom"("courseId")`)

  await safe(
    "CampSlot",
    sql`
      CREATE TABLE IF NOT EXISTS "CampSlot" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
        "sortOrder" INTEGER NOT NULL,
        "startTime" TEXT NOT NULL,
        "endTime" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  )
  await safe("CampSlot idx", sql`CREATE INDEX IF NOT EXISTS "CampSlot_courseId_idx" ON "CampSlot"("courseId")`)
  await safe("CampSlot isBreak", sql`ALTER TABLE "CampSlot" ADD COLUMN IF NOT EXISTS "isBreak" BOOLEAN NOT NULL DEFAULT false`)
  await safe("CampSlot breakTitle", sql`ALTER TABLE "CampSlot" ADD COLUMN IF NOT EXISTS "breakTitle" TEXT NOT NULL DEFAULT ''`)

  await safe(
    "CampDay",
    sql`
      CREATE TABLE IF NOT EXISTS "CampDay" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
        "sessionDate" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CampDay_courseId_sessionDate_key" UNIQUE ("courseId", "sessionDate")
      )
    `,
  )
  await safe("CampDay idx", sql`CREATE INDEX IF NOT EXISTS "CampDay_courseId_idx" ON "CampDay"("courseId")`)

  await safe(
    "CampAssignment",
    sql`
      CREATE TABLE IF NOT EXISTS "CampAssignment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "campDayId" TEXT NOT NULL REFERENCES "CampDay"("id") ON DELETE CASCADE,
        "slotSortOrder" INTEGER NOT NULL,
        "roomId" TEXT NOT NULL REFERENCES "CampRoom"("id") ON DELETE CASCADE,
        "groupId" TEXT NOT NULL REFERENCES "CampGroup"("id") ON DELETE CASCADE,
        "lessonTitle" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CampAssignment_day_slot_room_key" UNIQUE ("campDayId", "slotSortOrder", "roomId")
      )
    `,
  )
  await safe(
    "CampAssignment idx",
    sql`CREATE INDEX IF NOT EXISTS "CampAssignment_campDayId_idx" ON "CampAssignment"("campDayId")`,
  )

  await safe(
    "CampClassAssignment",
    sql`
      CREATE TABLE IF NOT EXISTS "CampClassAssignment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "campDayId" TEXT NOT NULL REFERENCES "CampDay"("id") ON DELETE CASCADE,
        "slotSortOrder" INTEGER NOT NULL,
        "classroomNo" INTEGER NOT NULL,
        "lessonTitle" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CampClassAssignment_day_slot_class_key" UNIQUE ("campDayId", "slotSortOrder", "classroomNo")
      )
    `,
  )
  await safe(
    "CampClassAssignment idx",
    sql`CREATE INDEX IF NOT EXISTS "CampClassAssignment_campDayId_idx" ON "CampClassAssignment"("campDayId")`,
  )

  await safe(
    "CampClassAssignmentGroup",
    sql`
      CREATE TABLE IF NOT EXISTS "CampClassAssignmentGroup" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "assignmentId" TEXT NOT NULL REFERENCES "CampClassAssignment"("id") ON DELETE CASCADE,
        "groupLabel" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  )
  await safe(
    "CampClassAssignmentGroup uniq",
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "CampClassAssignmentGroup_assignment_group_key" ON "CampClassAssignmentGroup"("assignmentId", "groupLabel")`,
  )

  await safe(
    "CampClassAssignmentTeacher",
    sql`
      CREATE TABLE IF NOT EXISTS "CampClassAssignmentTeacher" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "assignmentId" TEXT NOT NULL REFERENCES "CampClassAssignment"("id") ON DELETE CASCADE,
        "teacherId" TEXT NOT NULL REFERENCES "Teacher"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  )
  await safe(
    "CampClassAssignmentTeacher uniq",
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "CampClassAssignmentTeacher_assignment_teacher_key" ON "CampClassAssignmentTeacher"("assignmentId", "teacherId")`,
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
}
