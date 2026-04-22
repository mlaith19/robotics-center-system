import postgres from "postgres"
import { handleDbError } from "@/lib/db"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { sessionRolesGrantFullAccess, canDeleteTeacherAttendanceRecord } from "@/lib/permissions"
import { normalizeCourseCalendarYmd } from "@/lib/course-db-fields"
import { listCampSessionDates, isCampCourseType } from "@/lib/camp-kaytana"
import {
  courseIsCampType,
  getTeacherIdForUserId,
  loadCampMeetingDetailForSessionDate,
  resyncCampTeacherAttendanceForCourseDate,
  teacherCoversCampGroupOnMeeting,
  teacherTeachesCellForStudentGroup,
  ensureAttendanceCampColumns,
  findCampMeetingCell,
} from "@/lib/camp-attendance"
import { ensureAttendanceHourKindColumn } from "@/lib/teacher-attendance-hour-kind"
import { enrichTeacherAttendanceRowsWithRates } from "@/lib/teacher-tariff-profiles"
import { syncTeacherWeeklyActivityStatus } from "@/lib/teacher-weekly-activity-status"
import { ensureAttendanceUniqueIndexes } from "@/lib/attendance-uniqueness"

function extractAttendanceDateYmd(raw: unknown): string {
  const s = String(raw ?? "").trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const head = s.split("T")[0]
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ""
}

export const GET = withTenantAuth(async (req, _session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { searchParams } = new URL(req.url)
  const courseId  = searchParams.get("courseId")
  const studentId = searchParams.get("studentId")
  const teacherId = searchParams.get("teacherId")
  const date      = searchParams.get("date")
  const campMeetingCellIdGet = (searchParams.get("campMeetingCellId") || "").trim()
  const schoolIdAtt = (searchParams.get("schoolId") || "").trim()

  const runQuery = async (dbClient: ReturnType<typeof postgres>, withUserJoin: boolean) => {
    if (
      schoolIdAtt &&
      !teacherId &&
      !courseId &&
      !studentId &&
      !date
    ) {
      if (withUserJoin) {
        return dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration",
            COALESCE(u.name, te.name) as "createdByUserName",
            te.name as "teacherName"
          FROM "Attendance" a
          INNER JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          LEFT JOIN "Teacher" te ON a."teacherId" = te.id
          WHERE c."schoolId" = ${schoolIdAtt} AND a."teacherId" IS NOT NULL
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
      }
      const rows = await dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration", te.name as "createdByUserName", te.name as "teacherName"
        FROM "Attendance" a
        INNER JOIN "Course" c ON a."courseId" = c.id
        LEFT JOIN "Teacher" te ON a."teacherId" = te.id
        WHERE c."schoolId" = ${schoolIdAtt} AND a."teacherId" IS NOT NULL
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
      return rows as Record<string, unknown>[]
    }
    if (teacherId) {
      if (withUserJoin) {
        return dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration",
            to_char(c."startTime"::time, 'HH24:MI') as "courseStartTime",
            to_char(c."endTime"::time, 'HH24:MI') as "courseEndTime",
            c.location as "courseLocation",
            u.name as "createdByUserName"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          WHERE a."teacherId" = ${teacherId}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
      }
      const rows = await dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration",
          to_char(c."startTime"::time, 'HH24:MI') as "courseStartTime",
          to_char(c."endTime"::time, 'HH24:MI') as "courseEndTime",
          c.location as "courseLocation"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        WHERE a."teacherId" = ${teacherId}
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
      return rows.map((r: any) => ({ ...r, createdByUserName: null }))
    }
    if (courseId && studentId && date) {
      if (withUserJoin) {
        return dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration", u.name as "createdByUserName"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          WHERE a."courseId" = ${courseId} AND a."studentId" = ${studentId} AND a."date" = ${date}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
      }
      const rows = await dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        WHERE a."courseId" = ${courseId} AND a."studentId" = ${studentId} AND a."date" = ${date}
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
      return rows.map((r: any) => ({ ...r, createdByUserName: null }))
    }
    if (courseId && studentId) {
      if (withUserJoin) {
        return dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration", u.name as "createdByUserName"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          WHERE a."courseId" = ${courseId} AND a."studentId" = ${studentId}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
      }
      const rows = await dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        WHERE a."courseId" = ${courseId} AND a."studentId" = ${studentId}
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
      return rows.map((r: any) => ({ ...r, createdByUserName: null }))
    }
    if (courseId && date) {
      if (withUserJoin) {
        if (campMeetingCellIdGet) {
          return dbClient`
            SELECT a.*, c.name as "courseName", c.duration as "courseDuration", u.name as "createdByUserName"
            FROM "Attendance" a
            LEFT JOIN "Course" c ON a."courseId" = c.id
            LEFT JOIN "User" u ON a."createdByUserId" = u.id
            WHERE a."courseId" = ${courseId} AND a."date" = ${date}
              AND a."campMeetingCellId" = ${campMeetingCellIdGet}
            ORDER BY a."date" DESC, a."createdAt" DESC
          `
        }
        return dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration", u.name as "createdByUserName"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          WHERE a."courseId" = ${courseId} AND a."date" = ${date}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
      }
      if (campMeetingCellIdGet) {
        const rows = await dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          WHERE a."courseId" = ${courseId} AND a."date" = ${date}
            AND a."campMeetingCellId" = ${campMeetingCellIdGet}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
        return rows.map((r: any) => ({ ...r, createdByUserName: null }))
      }
      const rows = await dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        WHERE a."courseId" = ${courseId} AND a."date" = ${date}
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
      return rows.map((r: any) => ({ ...r, createdByUserName: null }))
    }
    if (studentId && date) {
      if (withUserJoin) {
        return dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration", u.name as "createdByUserName"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          WHERE a."studentId" = ${studentId} AND a."date" = ${date}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
      }
      const rows = await dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        WHERE a."studentId" = ${studentId} AND a."date" = ${date}
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
      return rows.map((r: any) => ({ ...r, createdByUserName: null }))
    }
    if (courseId) {
      if (withUserJoin) {
        return dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration",
            COALESCE(u.name, t.name) as "createdByUserName"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          LEFT JOIN "Teacher" t ON a."teacherId" = t.id
          WHERE a."courseId" = ${courseId}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
      }
      const rows = await dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration", t.name as "createdByUserName"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        LEFT JOIN "Teacher" t ON a."teacherId" = t.id
        WHERE a."courseId" = ${courseId}
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
      return rows as Record<string, unknown>[]
    }
    if (studentId) {
      if (withUserJoin) {
        return dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration", u.name as "createdByUserName"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          WHERE a."studentId" = ${studentId}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
      }
      const rows = await dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        WHERE a."studentId" = ${studentId}
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
      return rows.map((r: any) => ({ ...r, createdByUserName: null }))
    }
    if (date) {
      if (withUserJoin) {
        return dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration", u.name as "createdByUserName"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          WHERE a."date" = ${date}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
      }
      const rows = await dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        WHERE a."date" = ${date}
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
      return rows.map((r: any) => ({ ...r, createdByUserName: null }))
    }
    if (withUserJoin) {
      return dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration", u.name as "createdByUserName"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        LEFT JOIN "User" u ON a."createdByUserId" = u.id
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
    }
    const rows = await dbClient`
      SELECT a.*, c.name as "courseName", c.duration as "courseDuration"
      FROM "Attendance" a
      LEFT JOIN "Course" c ON a."courseId" = c.id
      ORDER BY a."date" DESC, a."createdAt" DESC
    `
    return rows.map((r: any) => ({ ...r, createdByUserName: null }))
  }

  try {
    await ensureAttendanceCampColumns(db)
    if (teacherId) {
      await ensureAttendanceHourKindColumn(db)
    }
    let result = (await runQuery(db, true)) as Record<string, unknown>[]
    if (teacherId && Array.isArray(result)) {
      result = await enrichTeacherAttendanceRowsWithRates(db, teacherId, result)
    }
    return Response.json(result)
  } catch (err: any) {
    if (err?.code === "42703" && String(err?.message || "").includes("createdByUserId")) {
      try {
        if (teacherId) await ensureAttendanceHourKindColumn(db)
        let result = (await runQuery(db, false)) as Record<string, unknown>[]
        if (teacherId && Array.isArray(result)) {
          result = await enrichTeacherAttendanceRowsWithRates(db, teacherId, result)
        }
        return Response.json(result)
      } catch (fallbackErr) {
        return handleDbError(fallbackErr, "GET /api/attendance")
      }
    }
    return handleDbError(err, "GET /api/attendance")
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    await ensureAttendanceCampColumns(db)
    await ensureAttendanceHourKindColumn(db)
    await ensureAttendanceUniqueIndexes(db)
    const body = await req.json()
    const { studentId, teacherId, courseId, date, status, notes, note, hours } = body
    const rawCampCell = (body as Record<string, unknown>).campMeetingCellId
    const campMeetingCellId =
      typeof rawCampCell === "string" && rawCampCell.trim() ? rawCampCell.trim() : null
    const hourKindStored: string | null =
      teacherId && !studentId && String((body as Record<string, unknown>).hourKind || "").toLowerCase() === "office"
        ? "office"
        : null
    const isAdmin = sessionRolesGrantFullAccess(session.roleKey, session.role)

    if (!studentId && !teacherId) return Response.json({ error: "studentId or teacherId is required" }, { status: 400 })
    if (!date || !status) return Response.json({ error: "date and status are required" }, { status: 400 })
    if (studentId && !courseId) return Response.json({ error: "courseId is required for student attendance" }, { status: 400 })
    // Teacher attendance is system-generated from student attendance; only admins may set it manually.
    if (teacherId && !studentId && !isAdmin) {
      return Response.json({ error: "Only admin can create/update teacher attendance manually" }, { status: 403 })
    }

    let courseRowForCamp: { courseType?: string | null } | undefined
    if (courseId) {
      const courseExists = await db`SELECT id, "courseType" FROM "Course" WHERE id = ${courseId}`
      if (courseExists.length === 0) return Response.json({ error: "Course not found" }, { status: 404 })
      courseRowForCamp = courseExists[0] as { courseType?: string | null }
    }

    const dateYmd = extractAttendanceDateYmd(date)

    if (studentId && courseId) {
      const crsRows = await db`
        SELECT "startDate", "endDate", "daysOfWeek" FROM "Course" WHERE id = ${courseId} LIMIT 1
      `
      const cr = crsRows[0] as
        | { startDate?: string | null; endDate?: string | null; daysOfWeek?: unknown }
        | undefined
      const start = normalizeCourseCalendarYmd(cr?.startDate)
      const end = normalizeCourseCalendarYmd(cr?.endDate)
      const dow = Array.isArray(cr?.daysOfWeek) ? (cr.daysOfWeek as string[]) : []
      if (start && end && dow.length > 0) {
        const allowed = listCampSessionDates(start, end, dow)
        if (!dateYmd || !allowed.includes(dateYmd)) {
          return Response.json(
            {
              error: "התאריך אינו יום מפגש של הקורס בטווח ובימי השבוע שהוגדרו",
              code: "attendance.invalid_course_date",
            },
            { status: 400 },
          )
        }
      }
    }
    if (studentId) {
      const studentExists = await db`SELECT id FROM "Student" WHERE id = ${studentId}`
      if (studentExists.length === 0) return Response.json({ error: "Student not found" }, { status: 404 })
    }
    if (teacherId) {
      const teacherExists = await db`SELECT id FROM "Teacher" WHERE id = ${teacherId}`
      if (teacherExists.length === 0) return Response.json({ error: "Teacher not found" }, { status: 404 })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const noteValue = notes || note || null
    const createdByUserId = session.id

    const isCampCourse =
      !!courseRowForCamp && isCampCourseType(String(courseRowForCamp.courseType || ""))

    const meetingForCamp =
      studentId && courseId && isCampCourse && dateYmd
        ? await loadCampMeetingDetailForSessionDate(db, courseId, dateYmd)
        : null

    let groupLabelForCamp: string | null = null
    if (studentId && courseId && isCampCourse) {
      const enr = await db`
        SELECT "campGroupLabel" FROM "Enrollment" WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} LIMIT 1
      `
      groupLabelForCamp = (enr[0] as { campGroupLabel?: string | null } | undefined)?.campGroupLabel ?? null
    }

    let actorTeacherIdForCampStudent: string | null = null
    if (studentId && courseId && isCampCourse) {
      if (!isAdmin) {
        const myTeacherId = await getTeacherIdForUserId(db, session.id)
        if (!myTeacherId) {
          return Response.json(
            {
              error: "בקורס קייטנה רק מורה משובץ בלוח המפגשים יכול לרשום נוכחות",
              code: "attendance.camp.teacher_only",
            },
            { status: 403 },
          )
        }
        if (!meetingForCamp) {
          return Response.json(
            {
              error: "אין מערכת מפגשים לתאריך זה — לא ניתן לרשום נוכחות",
              code: "attendance.camp.no_meeting",
            },
            { status: 400 },
          )
        }
        if (!campMeetingCellId) {
          return Response.json(
            {
              error: "יש לבחור שיעור במערכת הקייטנה (טאב לפי שעה) לפני רישום נוכחות",
              code: "attendance.camp.cell_required",
            },
            { status: 400 },
          )
        }
        if (!teacherTeachesCellForStudentGroup(meetingForCamp, campMeetingCellId, myTeacherId, groupLabelForCamp)) {
          return Response.json(
            {
              error: "אין שיבוץ שלך לתא/קבוצת התלמיד במפגש זה",
              code: "attendance.camp.not_assigned",
            },
            { status: 403 },
          )
        }
        actorTeacherIdForCampStudent = myTeacherId
      } else if (campMeetingCellId && meetingForCamp) {
        if (!findCampMeetingCell(meetingForCamp, campMeetingCellId)) {
          return Response.json({ error: "תא שיעור לא נמצא במפגש זה" }, { status: 400 })
        }
      }
    }

    let existing: { id: string; createdByUserId?: string | null }[] = []
    if (studentId) {
      if (campMeetingCellId) {
        existing = (await db`
          SELECT id, "createdByUserId" FROM "Attendance" 
          WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "date" = ${date}
            AND "campMeetingCellId" = ${campMeetingCellId}
        `) as { id: string; createdByUserId?: string | null }[]
      } else {
        existing = (await db`
          SELECT id, "createdByUserId" FROM "Attendance" 
          WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "date" = ${date}
            AND "campMeetingCellId" IS NULL
        `) as { id: string; createdByUserId?: string | null }[]
      }
    } else if (courseId) {
      if (campMeetingCellId) {
        existing = (await db`
          SELECT id, "createdByUserId" FROM "Attendance"
          WHERE "teacherId" = ${teacherId} AND "courseId" = ${courseId} AND "date" = ${date}
            AND "campMeetingCellId" = ${campMeetingCellId}
            AND "studentId" IS NULL
        `) as { id: string; createdByUserId?: string | null }[]
      } else {
        existing = (await db`
          SELECT id, "createdByUserId" FROM "Attendance"
          WHERE "teacherId" = ${teacherId} AND "courseId" = ${courseId} AND "date" = ${date}
            AND "campMeetingCellId" IS NULL
            AND "studentId" IS NULL
        `) as { id: string; createdByUserId?: string | null }[]
      }
    } else {
      existing = (await db`
        SELECT id, "createdByUserId" FROM "Attendance"
        WHERE "teacherId" = ${teacherId} AND "courseId" IS NULL AND "date" = ${date}
          AND "studentId" IS NULL
      `) as { id: string; createdByUserId?: string | null }[]
    }

    if (studentId && courseId && isCampCourse && !campMeetingCellId && !isAdmin && existing.length > 0) {
      const firstCreator = existing[0].createdByUserId
      if (firstCreator && firstCreator !== session.id) {
        return Response.json(
          {
            error: "רק המורה שרשם את הנוכחות לתלמיד זה יכול לעדכן",
            code: "attendance.camp.locked_creator",
          },
          { status: 403 },
        )
      }
    }

    const studentRowActorUserId =
      studentId && existing.length > 0 ? existing[0].createdByUserId ?? session.id : session.id

    if (existing.length > 0) {
      const rowUserId = studentId ? studentRowActorUserId : createdByUserId
      const teacherIdToStore =
        studentId && courseId && isCampCourse
          ? actorTeacherIdForCampStudent
          : (teacherId || null)
      const result = await db`
        UPDATE "Attendance"
        SET status = ${status},
            notes = ${noteValue},
            hours = ${hours || null},
            "hourKind" = ${hourKindStored},
            "createdByUserId" = ${rowUserId},
            "teacherId" = ${teacherIdToStore}
        WHERE id = ${existing[0].id}
        RETURNING *
      `
      const saved = result[0]
      if (studentId && courseId) {
        if (isCampCourse) {
          await resyncCampTeacherAttendanceForCourseDate(db, courseId, dateYmd, now)
        } else if (status === "present" || status === "נוכח") {
          await syncTeacherAttendanceForCourseDate(db, courseId, date, createdByUserId, now)
        }
      }
      await syncTeacherWeeklyActivityStatus(db)
      return Response.json(saved)
    }

    const insertCreatorUserId = studentId ? session.id : createdByUserId
    let saved: Record<string, unknown>
    const teacherIdToInsert =
      studentId && courseId && isCampCourse
        ? actorTeacherIdForCampStudent
        : (teacherId || null)
    try {
      const result = await db`
        INSERT INTO "Attendance" (
          id, "studentId", "teacherId", "courseId", date, status, notes, hours, "hourKind",
          "campMeetingCellId", "campLessonTitle", "campSlotStart", "campSlotEnd",
          "createdByUserId", "createdAt"
        )
        VALUES (
          ${id}, ${studentId || null}, ${teacherIdToInsert}, ${courseId || null}, ${date}, ${status}, ${noteValue},
          ${hours || null}, ${hourKindStored},
          ${campMeetingCellId}, null, null, null,
          ${insertCreatorUserId}, ${now}
        )
        RETURNING *
      `
      saved = result[0] as Record<string, unknown>
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== "23505") throw err
      // כפילות ב-DB: בקשה מקבילה כבר יצרה את השורה. מבצעים UPDATE במקום.
      let updated: Record<string, unknown>[] = []
      if (studentId) {
        updated = (await db`
          UPDATE "Attendance"
          SET status = ${status}, notes = ${noteValue}, hours = ${hours || null},
              "hourKind" = ${hourKindStored},
              "createdByUserId" = ${insertCreatorUserId},
              "teacherId" = ${teacherIdToInsert}
          WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "date" = ${date}
            AND COALESCE("campMeetingCellId", '') = ${campMeetingCellId || ''}
          RETURNING *
        `) as Record<string, unknown>[]
      } else if (teacherId && courseId) {
        updated = (await db`
          UPDATE "Attendance"
          SET status = ${status}, notes = ${noteValue}, hours = ${hours || null},
              "hourKind" = ${hourKindStored}, "createdByUserId" = ${insertCreatorUserId}
          WHERE "teacherId" = ${teacherId} AND "courseId" = ${courseId} AND "date" = ${date}
            AND COALESCE("campMeetingCellId", '') = ${campMeetingCellId || ''}
            AND "studentId" IS NULL
          RETURNING *
        `) as Record<string, unknown>[]
      } else if (teacherId) {
        updated = (await db`
          UPDATE "Attendance"
          SET status = ${status}, notes = ${noteValue}, hours = ${hours || null},
              "hourKind" = ${hourKindStored}, "createdByUserId" = ${insertCreatorUserId}
          WHERE "teacherId" = ${teacherId} AND "courseId" IS NULL AND "date" = ${date}
            AND "studentId" IS NULL
          RETURNING *
        `) as Record<string, unknown>[]
      }
      saved = updated[0] ?? ({} as Record<string, unknown>)
    }
    if (studentId && courseId) {
      if (isCampCourse) {
        await resyncCampTeacherAttendanceForCourseDate(db, courseId, dateYmd, now)
      } else if (status === "present" || status === "נוכח") {
        await syncTeacherAttendanceForCourseDate(db, courseId, date, createdByUserId, now)
      }
    }
    await syncTeacherWeeklyActivityStatus(db)
    return Response.json(saved, { status: 201 })
  } catch (err) {
    return handleDbError(err, "POST /api/attendance")
  }
})

async function syncTeacherAttendanceForCourseDate(
  db: ReturnType<typeof postgres>,
  courseId: string,
  date: string,
  createdByUserId: string | null,
  now: string
) {
  if (await courseIsCampType(db, courseId)) return
  const courses = await db`SELECT "teacherIds" FROM "Course" WHERE id = ${courseId}`
  const raw = courses[0]?.teacherIds
  let teacherIds: string[] = []
  if (Array.isArray(raw)) teacherIds = raw.filter((t): t is string => typeof t === "string")
  else if (typeof raw === "string" && raw) teacherIds = [raw]
  else if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try { teacherIds = (JSON.parse(raw) as string[]).filter((t) => typeof t === "string") } catch { /* ignore */ }
  }
  if (teacherIds.length === 0) return

  const presentStatus = "נוכח"
  await ensureAttendanceUniqueIndexes(db)
  for (const tid of teacherIds) {
    if (!tid) continue
    const existingTeacher = await db`
      SELECT id FROM "Attendance"
      WHERE "teacherId" = ${tid} AND "courseId" = ${courseId} AND "date" = ${date}
        AND "studentId" IS NULL
        AND "campMeetingCellId" IS NULL
    `
    if (existingTeacher.length > 0) {
      await db`
        UPDATE "Attendance"
        SET status = ${presentStatus}, "createdByUserId" = ${createdByUserId}
        WHERE id = ${(existingTeacher[0] as { id: string }).id}
      `
    } else {
      const teacherAttendanceId = crypto.randomUUID()
      try {
        await db`
          INSERT INTO "Attendance" (id, "studentId", "teacherId", "courseId", date, status, notes, hours, "createdByUserId", "createdAt")
          VALUES (${teacherAttendanceId}, null, ${tid}, ${courseId}, ${date}, ${presentStatus}, null, null, ${createdByUserId}, ${now})
        `
      } catch (err) {
        // If a concurrent request inserted the same row, silently update instead.
        const code = (err as { code?: string }).code
        if (code !== "23505") throw err
        await db`
          UPDATE "Attendance"
          SET status = ${presentStatus}, "createdByUserId" = ${createdByUserId}
          WHERE "teacherId" = ${tid} AND "courseId" = ${courseId} AND "date" = ${date}
            AND "studentId" IS NULL AND "campMeetingCellId" IS NULL
        `
      }
    }
  }
}

export const DELETE = withTenantAuth(async (req, _session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    await ensureAttendanceHourKindColumn(db)
    const { searchParams } = new URL(req.url)
    const id        = searchParams.get("id")
    const studentId = searchParams.get("studentId")
    const teacherId = searchParams.get("teacherId")
    const courseId  = searchParams.get("courseId")
    const date      = searchParams.get("date")
    const isAdmin = sessionRolesGrantFullAccess(_session.roleKey, _session.role)
    const canDelTeacherAtt = canDeleteTeacherAttendanceRecord(_session)

    if (id) {
      const existing = await db`SELECT "teacherId" FROM "Attendance" WHERE id = ${id} LIMIT 1`
      if (existing.length === 0) {
        return Response.json({ error: "Attendance not found" }, { status: 404 })
      }
      if (existing[0].teacherId && !canDelTeacherAtt) {
        return Response.json(
          { error: "אין הרשאה למחיקת נוכחות מורה", code: "attendance.delete_teacher.forbidden" },
          { status: 403 },
        )
      }
      await db`DELETE FROM "Attendance" WHERE id = ${id}`
      await syncTeacherWeeklyActivityStatus(db)
      return Response.json({ success: true })
    }
    if (studentId && courseId && date) {
      await ensureAttendanceCampColumns(db)
      const dateYmd = extractAttendanceDateYmd(date)
      const camp = await courseIsCampType(db, courseId)
      const cellDel = (searchParams.get("campMeetingCellId") || "").trim()
      if (camp && !isAdmin && !cellDel) {
        const row = await db`
          SELECT "createdByUserId" FROM "Attendance"
          WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "date" = ${date}
            AND "campMeetingCellId" IS NULL
          LIMIT 1
        `
        const creator = (row[0] as { createdByUserId?: string | null } | undefined)?.createdByUserId
        if (creator && creator !== _session.id) {
          return Response.json(
            { error: "רק המורה שרשם את הנוכחות יכול למחוק", code: "attendance.camp.locked_creator" },
            { status: 403 },
          )
        }
      }
      if (cellDel) {
        await db`
          DELETE FROM "Attendance"
          WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "date" = ${date}
            AND "campMeetingCellId" = ${cellDel}
        `
      } else {
        await db`
          DELETE FROM "Attendance"
          WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "date" = ${date}
            AND "campMeetingCellId" IS NULL
        `
      }
      if (camp && dateYmd) {
        const now = new Date().toISOString()
        await resyncCampTeacherAttendanceForCourseDate(db, courseId, dateYmd, now)
      }
      await syncTeacherWeeklyActivityStatus(db)
      return Response.json({ success: true })
    }
    if (teacherId && courseId && date) {
      if (!canDelTeacherAtt) {
        return Response.json(
          { error: "אין הרשאה למחיקת נוכחות מורה", code: "attendance.delete_teacher.forbidden" },
          { status: 403 },
        )
      }
      await db`DELETE FROM "Attendance" WHERE "teacherId" = ${teacherId} AND "courseId" = ${courseId} AND "date" = ${date}`
      await syncTeacherWeeklyActivityStatus(db)
      return Response.json({ success: true })
    }
    return Response.json({ error: "id or (studentId/teacherId + courseId + date) required" }, { status: 400 })
  } catch (err) {
    return handleDbError(err, "DELETE /api/attendance")
  }
})
