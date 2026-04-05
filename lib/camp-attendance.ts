import type postgres from "postgres"
import { ensureCampTables, isCampCourseType } from "@/lib/camp-kaytana"

export type CampMeetingSlotDetail = {
  id: string
  sortOrder: number
  startTime: string
  endTime: string
  isBreak: boolean
  breakTitle: string
  cells: Array<{
    id: string
    classroomNo: number
    lessonTitle: string
    groupLabels: string[]
    teacherIds: string[]
  }>
}

export type CampMeetingDetail = {
  id: string
  sessionDate: string
  slots: CampMeetingSlotDetail[]
}

export function parseTimeToDecimalHours(t: string): number {
  const s = String(t || "").trim().slice(0, 5)
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return 0
  const h = Number(m[1])
  const min = Number(m[2])
  if (Number.isNaN(h) || Number.isNaN(min)) return 0
  return h + min / 60
}

export function slotDurationHours(start: string, end: string): number {
  return Math.max(0, parseTimeToDecimalHours(end) - parseTimeToDecimalHours(start))
}

function normGroupLabel(g: string | null | undefined): string {
  return String(g ?? "").trim()
}

/** האם למורה יש תא במפגש שכולל את תווית הקבוצה של התלמיד */
export function teacherCoversCampGroupOnMeeting(
  meeting: CampMeetingDetail,
  teacherId: string,
  campGroupLabel: string | null | undefined
): boolean {
  const g = normGroupLabel(campGroupLabel)
  if (!g) return false
  for (const slot of meeting.slots) {
    if (slot.isBreak) continue
    for (const cell of slot.cells) {
      if (!cell.teacherIds.includes(teacherId)) continue
      if (cell.groupLabels.some((x) => normGroupLabel(x) === g)) return true
    }
  }
  return false
}

/** סיכום שעות הוראה ליום מפגש לפי משבצות שבהן המורה משובץ (לא כולל הפסקות) */
export function computeCampTeacherDayHoursFromMeeting(meeting: CampMeetingDetail, teacherId: string): number {
  const countedSlots = new Set<string>()
  let total = 0
  for (const slot of meeting.slots) {
    if (slot.isBreak) continue
    const inSlot = slot.cells.some((c) => c.teacherIds.includes(teacherId))
    if (!inSlot || countedSlots.has(slot.id)) continue
    countedSlots.add(slot.id)
    total += slotDurationHours(slot.startTime, slot.endTime)
  }
  return total
}

export function collectTeacherIdsFromCampMeeting(meeting: CampMeetingDetail): Set<string> {
  const set = new Set<string>()
  for (const slot of meeting.slots) {
    if (slot.isBreak) continue
    for (const cell of slot.cells) {
      for (const tid of cell.teacherIds) {
        if (tid) set.add(tid)
      }
    }
  }
  return set
}

export async function loadCampMeetingDetailForSessionDate(
  db: ReturnType<typeof postgres>,
  courseId: string,
  sessionDateYmd: string
): Promise<CampMeetingDetail | null> {
  await ensureCampTables(db)
  const mRows = await db`
    SELECT id, "sessionDate" FROM "CampMeeting"
    WHERE "courseId" = ${courseId} AND "sessionDate" = ${sessionDateYmd}
    LIMIT 1
  `
  if (!mRows.length) return null
  const m = mRows[0] as { id: string; sessionDate: string }
  const slotRows = await db`
    SELECT id, "sortOrder", "startTime", "endTime", "isBreak", "breakTitle"
    FROM "CampMeetingSlot"
    WHERE "meetingId" = ${m.id}
    ORDER BY "sortOrder", "startTime"
  `
  const slots: CampMeetingSlotDetail[] = []
  for (const s of slotRows as {
    id: string
    sortOrder: number
    startTime: string
    endTime: string
    isBreak: boolean
    breakTitle: string
  }[]) {
    const cellRows = await db`
      SELECT id, "classroomNo", "lessonTitle"
      FROM "CampMeetingCell"
      WHERE "slotId" = ${s.id}
      ORDER BY "classroomNo"
    `
    const cells = []
    for (const c of cellRows as { id: string; classroomNo: number; lessonTitle: string }[]) {
      const gRows = await db`SELECT "groupLabel" FROM "CampMeetingCellGroup" WHERE "cellId" = ${c.id}`
      const tRows = await db`SELECT "teacherId" FROM "CampMeetingCellTeacher" WHERE "cellId" = ${c.id}`
      cells.push({
        id: c.id,
        classroomNo: Number(c.classroomNo),
        lessonTitle: String(c.lessonTitle || ""),
        groupLabels: (gRows as { groupLabel: string }[]).map((x) => String(x.groupLabel)),
        teacherIds: (tRows as { teacherId: string }[]).map((x) => String(x.teacherId)),
      })
    }
    slots.push({
      id: s.id,
      sortOrder: Number(s.sortOrder),
      startTime: String(s.startTime),
      endTime: String(s.endTime),
      isBreak: Boolean(s.isBreak),
      breakTitle: String(s.breakTitle || ""),
      cells,
    })
  }
  return { id: m.id, sessionDate: m.sessionDate, slots }
}

export async function getTeacherIdForUserId(
  db: ReturnType<typeof postgres>,
  userId: string
): Promise<string | null> {
  const rows = await db`SELECT id FROM "Teacher" WHERE "userId" = ${userId} LIMIT 1`
  return rows.length ? String((rows[0] as { id: string }).id) : null
}

async function teacherHasMarkedAssignedCampStudent(
  db: ReturnType<typeof postgres>,
  courseId: string,
  dateYmd: string,
  teacherUserId: string,
  meeting: CampMeetingDetail,
  teacherId: string
): Promise<boolean> {
  const rows = await db`
    SELECT e."campGroupLabel"
    FROM "Attendance" a
    INNER JOIN "Enrollment" e ON e."studentId" = a."studentId" AND e."courseId" = a."courseId"
    WHERE a."courseId" = ${courseId}
      AND a."date" = ${dateYmd}
      AND a."studentId" IS NOT NULL
      AND a."createdByUserId" = ${teacherUserId}
  `
  for (const r of rows as { campGroupLabel?: string | null }[]) {
    if (teacherCoversCampGroupOnMeeting(meeting, teacherId, r.campGroupLabel)) return true
  }
  return false
}

/**
 * מסנכרן נוכחות מורים לקורס קייטנה לפי לוח המפגשים: שעות רק אם המורה רשם נוכחות לתלמידים
 * בקבוצות שהוא משובץ אליהן באותו יום.
 */
export async function resyncCampTeacherAttendanceForCourseDate(
  db: ReturnType<typeof postgres>,
  courseId: string,
  dateYmd: string,
  nowIso: string
): Promise<void> {
  const crs = await db`SELECT "courseType" FROM "Course" WHERE id = ${courseId} LIMIT 1`
  if (!crs.length) return
  const courseType = String((crs[0] as { courseType?: string }).courseType || "")
  if (!isCampCourseType(courseType)) return

  const meeting = await loadCampMeetingDetailForSessionDate(db, courseId, dateYmd)
  const teacherIdsInSchedule = meeting ? collectTeacherIdsFromCampMeeting(meeting) : new Set<string>()

  const existingTeacherRows = await db`
    SELECT DISTINCT "teacherId" FROM "Attendance"
    WHERE "courseId" = ${courseId} AND "date" = ${dateYmd} AND "teacherId" IS NOT NULL
  `
  const allTeacherIds = new Set<string>(teacherIdsInSchedule)
  for (const r of existingTeacherRows as { teacherId: string }[]) {
    if (r.teacherId) allTeacherIds.add(String(r.teacherId))
  }

  const presentStatus = "נוכח"

  for (const tid of allTeacherIds) {
    let hours = 0
    if (meeting) {
      const trows = await db`SELECT "userId" FROM "Teacher" WHERE id = ${tid} LIMIT 1`
      const uid = (trows[0] as { userId?: string | null } | undefined)?.userId
      if (uid && typeof uid === "string") {
        const marked = await teacherHasMarkedAssignedCampStudent(db, courseId, dateYmd, uid, meeting, tid)
        if (marked) hours = computeCampTeacherDayHoursFromMeeting(meeting, tid)
      }
    }

    const existing = await db`
      SELECT id FROM "Attendance"
      WHERE "teacherId" = ${tid} AND "courseId" = ${courseId} AND "date" = ${dateYmd}
    `

    if (hours > 0) {
      if (existing.length > 0) {
        await db`
          UPDATE "Attendance"
          SET status = ${presentStatus}, hours = ${hours}, notes = null, "hourKind" = null
          WHERE id = ${(existing[0] as { id: string }).id}
        `
      } else {
        await db`
          INSERT INTO "Attendance" (id, "studentId", "teacherId", "courseId", date, status, notes, hours, "hourKind", "createdByUserId", "createdAt")
          VALUES (${crypto.randomUUID()}, null, ${tid}, ${courseId}, ${dateYmd}, ${presentStatus}, null, ${hours}, null, null, ${nowIso})
        `
      }
    } else if (existing.length > 0) {
      await db`DELETE FROM "Attendance" WHERE id = ${(existing[0] as { id: string }).id}`
    }
  }
}

export async function courseIsCampType(db: ReturnType<typeof postgres>, courseId: string): Promise<boolean> {
  const crs = await db`SELECT "courseType" FROM "Course" WHERE id = ${courseId} LIMIT 1`
  if (!crs.length) return false
  return isCampCourseType(String((crs[0] as { courseType?: string }).courseType || ""))
}
