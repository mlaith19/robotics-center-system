import type postgres from "postgres"
import { ensureCampTables, isCampCourseType } from "@/lib/camp-kaytana"
import { ensureAttendanceUniqueIndexes } from "@/lib/attendance-uniqueness"

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

export function normCampGroupLabel(g: string | null | undefined): string {
  return String(g ?? "").trim()
}

/** האם למורה יש תא במפגש שכולל את תווית הקבוצה של התלמיד */
export function teacherCoversCampGroupOnMeeting(
  meeting: CampMeetingDetail,
  teacherId: string,
  campGroupLabel: string | null | undefined
): boolean {
  const g = normCampGroupLabel(campGroupLabel)
  if (!g) return false
  for (const slot of meeting.slots) {
    if (slot.isBreak) continue
    for (const cell of slot.cells) {
      if (!cell.teacherIds.includes(teacherId)) continue
      if (cell.groupLabels.some((x) => normCampGroupLabel(x) === g)) return true
    }
  }
  return false
}

/** מורה משובץ לתא ספציפי והתלמיד בקבוצה שמלומדת בתא */
export function findCampMeetingCell(
  meeting: CampMeetingDetail,
  cellId: string
): { cell: CampMeetingSlotDetail["cells"][number]; slot: CampMeetingSlotDetail } | null {
  for (const slot of meeting.slots) {
    for (const cell of slot.cells) {
      if (cell.id === cellId) return { cell, slot }
    }
  }
  return null
}

export function teacherTeachesCellForStudentGroup(
  meeting: CampMeetingDetail,
  cellId: string,
  teacherId: string,
  campGroupLabel: string | null | undefined
): boolean {
  const found = findCampMeetingCell(meeting, cellId)
  if (!found) return false
  const g = normCampGroupLabel(campGroupLabel)
  if (!g) return false
  if (!found.cell.teacherIds.includes(teacherId)) return false
  return found.cell.groupLabels.some((x) => normCampGroupLabel(x) === g)
}

export async function ensureAttendanceCampColumns(db: ReturnType<typeof postgres>) {
  const safe = async (q: Promise<unknown>) => {
    try {
      await q
    } catch (e) {
      console.warn("[camp-attendance] ensure column:", e)
    }
  }
  await safe(db`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campMeetingCellId" TEXT`)
  await safe(db`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campLessonTitle" TEXT`)
  await safe(db`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campSlotStart" TEXT`)
  await safe(db`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campSlotEnd" TEXT`)
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
    WHERE "courseId" = ${courseId}
      AND LEFT(BTRIM("sessionDate"::text), 10) = ${sessionDateYmd}
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

/**
 * נוכחות מורה בקייטנה — שורה לכל תא שיעור: שעות אם אותו מורה רשם נוכחות לתלמיד באותו תא.
 * (שני מורים באותו תא — לכל אחד שורה נפרדת לפי רישום שלו.)
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

  await ensureAttendanceCampColumns(db)
  await ensureAttendanceUniqueIndexes(db)

  const meeting = await loadCampMeetingDetailForSessionDate(db, courseId, dateYmd)
  const presentStatus = "נוכח"

  const hasCellStudentMarks =
    (
      await db`
    SELECT 1 FROM "Attendance"
    WHERE "courseId" = ${courseId} AND "date" = ${dateYmd}
      AND "studentId" IS NOT NULL AND "campMeetingCellId" IS NOT NULL
    LIMIT 1
  `
    ).length > 0

  if (meeting && hasCellStudentMarks) {
    for (const slot of meeting.slots) {
      if (slot.isBreak) continue
      const hours = slotDurationHours(slot.startTime, slot.endTime)
      const st = String(slot.startTime || "").trim().slice(0, 5)
      const et = String(slot.endTime || "").trim().slice(0, 5)
      const cellsByTeacher = new Map<string, Array<{ id: string; lessonTitle: string }>>()
      for (const cell of slot.cells) {
        for (const tid of cell.teacherIds) {
          const teacherId = String(tid || "").trim()
          if (!teacherId) continue
          const arr = cellsByTeacher.get(teacherId) ?? []
          arr.push({ id: String(cell.id), lessonTitle: String(cell.lessonTitle || "").trim() })
          cellsByTeacher.set(teacherId, arr)
        }
      }

      for (const [tid, teacherCells] of cellsByTeacher.entries()) {
        const trows = await db`SELECT "userId" FROM "Teacher" WHERE id = ${tid} LIMIT 1`
        const uid = (trows[0] as { userId?: string | null } | undefined)?.userId
        const cellIds = teacherCells.map((x) => x.id).filter(Boolean)
        if (cellIds.length === 0) continue

        let shouldHave = false
        let chosenCellId = cellIds[0]
        if (uid && typeof uid === "string") {
          const marked = await db`
            SELECT a."campMeetingCellId" as "campMeetingCellId"
            FROM "Attendance" a
            WHERE a."courseId" = ${courseId} AND a."date" = ${dateYmd}
              AND a."campMeetingCellId" = ANY(${db.array(cellIds)})
              AND a."studentId" IS NOT NULL
              AND a."createdByUserId" = ${uid}
            ORDER BY a."createdAt" ASC, a.id ASC
            LIMIT 1
          `
          shouldHave = marked.length > 0
          if (shouldHave) {
            const cellFromMark = String((marked[0] as { campMeetingCellId?: string }).campMeetingCellId || "").trim()
            if (cellFromMark) chosenCellId = cellFromMark
          }
        }

        const chosenLessonTitle =
          teacherCells.find((x) => x.id === chosenCellId)?.lessonTitle || teacherCells[0]?.lessonTitle || ""

        const existing = await db`
          SELECT id, "campMeetingCellId"
          FROM "Attendance"
          WHERE "teacherId" = ${tid} AND "courseId" = ${courseId} AND "date" = ${dateYmd}
            AND "studentId" IS NULL
            AND "campMeetingCellId" = ANY(${db.array(cellIds)})
          ORDER BY "createdAt" ASC, id ASC
        `

        if (shouldHave && hours > 0) {
          if (existing.length > 0) {
            const keepId = String((existing[0] as { id: string }).id)
            await db`
              UPDATE "Attendance"
              SET status = ${presentStatus},
                  hours = ${hours},
                  notes = null,
                  "hourKind" = null,
                  "campMeetingCellId" = ${chosenCellId},
                  "campLessonTitle" = ${chosenLessonTitle || null},
                  "campSlotStart" = ${st || null},
                  "campSlotEnd" = ${et || null},
                  "createdByUserId" = COALESCE("createdByUserId", ${uid && typeof uid === "string" ? uid : null})
              WHERE id = ${keepId}
            `
            if (existing.length > 1) {
              const extraIds = (existing.slice(1) as Array<{ id: string }>).map((x) => String(x.id)).filter(Boolean)
              if (extraIds.length) {
                await db`DELETE FROM "Attendance" WHERE id = ANY(${db.array(extraIds)})`
              }
            }
          } else {
            try {
              await db`
                INSERT INTO "Attendance" (
                  id, "studentId", "teacherId", "courseId", date, status, notes, hours, "hourKind",
                  "campMeetingCellId", "campLessonTitle", "campSlotStart", "campSlotEnd",
                  "createdByUserId", "createdAt"
                )
                VALUES (
                  ${crypto.randomUUID()}, null, ${tid}, ${courseId}, ${dateYmd}, ${presentStatus},
                  null, ${hours}, null, ${chosenCellId}, ${chosenLessonTitle || null}, ${st || null}, ${et || null},
                  ${uid && typeof uid === "string" ? uid : null}, ${nowIso}
                )
              `
            } catch (err) {
              const code = (err as { code?: string }).code
              if (code !== "23505") throw err
              await db`
                UPDATE "Attendance"
                SET status = ${presentStatus},
                    hours = ${hours},
                    notes = null,
                    "hourKind" = null,
                    "campMeetingCellId" = ${chosenCellId},
                    "campLessonTitle" = ${chosenLessonTitle || null},
                    "campSlotStart" = ${st || null},
                    "campSlotEnd" = ${et || null}
                WHERE "teacherId" = ${tid} AND "courseId" = ${courseId} AND "date" = ${dateYmd}
                  AND "studentId" IS NULL
                  AND "campMeetingCellId" = ANY(${db.array(cellIds)})
              `
            }
          }
        } else if (existing.length > 0) {
          await db`
            DELETE FROM "Attendance"
            WHERE id = ANY(${db.array((existing as Array<{ id: string }>).map((x) => String(x.id)).filter(Boolean))})
          `
        }
      }
    }
    await db`
      DELETE FROM "Attendance"
      WHERE "courseId" = ${courseId} AND "date" = ${dateYmd}
        AND "teacherId" IS NOT NULL AND "campMeetingCellId" IS NULL
    `
    return
  }

  /** מצב ישן: נוכחות תלמיד ליום בלי תא — שורת מורה אחת ליום */
  const teacherIdsInSchedule = meeting ? collectTeacherIdsFromCampMeeting(meeting) : new Set<string>()
  const existingTeacherRows = await db`
    SELECT DISTINCT "teacherId" FROM "Attendance"
    WHERE "courseId" = ${courseId} AND "date" = ${dateYmd} AND "teacherId" IS NOT NULL
  `
  const allTeacherIds = new Set<string>(teacherIdsInSchedule)
  for (const r of existingTeacherRows as { teacherId: string }[]) {
    if (r.teacherId) allTeacherIds.add(String(r.teacherId))
  }

  async function teacherHasMarkedAssignedCampStudent(
    teacherUserId: string,
    meet: CampMeetingDetail,
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
        AND a."campMeetingCellId" IS NULL
    `
    for (const row of rows as { campGroupLabel?: string | null }[]) {
      if (teacherCoversCampGroupOnMeeting(meet, teacherId, row.campGroupLabel)) return true
    }
    return false
  }

  for (const tid of allTeacherIds) {
    const trowsUid = await db`SELECT "userId" FROM "Teacher" WHERE id = ${tid} LIMIT 1`
    const uidRaw = (trowsUid[0] as { userId?: string | null } | undefined)?.userId
    const uidForRow = uidRaw && typeof uidRaw === "string" ? uidRaw : null

    let hours = 0
    if (meeting && uidForRow) {
      const marked = await teacherHasMarkedAssignedCampStudent(uidForRow, meeting, tid)
      if (marked) hours = computeCampTeacherDayHoursFromMeeting(meeting, tid)
    }

    const existing = await db`
      SELECT id FROM "Attendance"
      WHERE "teacherId" = ${tid} AND "courseId" = ${courseId} AND "date" = ${dateYmd}
        AND "campMeetingCellId" IS NULL
    `

    if (hours > 0) {
      if (existing.length > 0) {
        await db`
          UPDATE "Attendance"
          SET status = ${presentStatus},
              hours = ${hours},
              notes = null,
              "hourKind" = null,
              "createdByUserId" = COALESCE("createdByUserId", ${uidForRow})
          WHERE id = ${(existing[0] as { id: string }).id}
        `
      } else {
        await db`
          INSERT INTO "Attendance" (id, "studentId", "teacherId", "courseId", date, status, notes, hours, "hourKind", "createdByUserId", "createdAt")
          VALUES (${crypto.randomUUID()}, null, ${tid}, ${courseId}, ${dateYmd}, ${presentStatus}, null, ${hours}, null, ${uidForRow}, ${nowIso})
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
