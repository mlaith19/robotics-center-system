import type postgres from "postgres"
import { handleDbError } from "@/lib/db"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { sessionRolesGrantFullAccess } from "@/lib/permissions"

export const GET = withTenantAuth(async (req, _session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { searchParams } = new URL(req.url)
  const courseId  = searchParams.get("courseId")
  const studentId = searchParams.get("studentId")
  const teacherId = searchParams.get("teacherId")
  const date      = searchParams.get("date")

  const runQuery = async (dbClient: ReturnType<typeof postgres>, withUserJoin: boolean) => {
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
        return dbClient`
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration", u.name as "createdByUserName"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          WHERE a."courseId" = ${courseId} AND a."date" = ${date}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
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
          SELECT a.*, c.name as "courseName", c.duration as "courseDuration", u.name as "createdByUserName"
          FROM "Attendance" a
          LEFT JOIN "Course" c ON a."courseId" = c.id
          LEFT JOIN "User" u ON a."createdByUserId" = u.id
          WHERE a."courseId" = ${courseId}
          ORDER BY a."date" DESC, a."createdAt" DESC
        `
      }
      const rows = await dbClient`
        SELECT a.*, c.name as "courseName", c.duration as "courseDuration"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        WHERE a."courseId" = ${courseId}
        ORDER BY a."date" DESC, a."createdAt" DESC
      `
      return rows.map((r: any) => ({ ...r, createdByUserName: null }))
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
    const result = await runQuery(db, true)
    return Response.json(result)
  } catch (err: any) {
    if (err?.code === "42703" && String(err?.message || "").includes("createdByUserId")) {
      try {
        const result = await runQuery(db, false)
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
    const body = await req.json()
    const { studentId, teacherId, courseId, date, status, notes, note, hours } = body
    const isAdmin = sessionRolesGrantFullAccess(session.roleKey, session.role)

    if (!studentId && !teacherId) return Response.json({ error: "studentId or teacherId is required" }, { status: 400 })
    if (!date || !status) return Response.json({ error: "date and status are required" }, { status: 400 })
    if (studentId && !courseId) return Response.json({ error: "courseId is required for student attendance" }, { status: 400 })
    // Teacher attendance is system-generated from student attendance; only admins may set it manually.
    if (teacherId && !studentId && !isAdmin) {
      return Response.json({ error: "Only admin can create/update teacher attendance manually" }, { status: 403 })
    }

    if (courseId) {
      const courseExists = await db`SELECT id FROM "Course" WHERE id = ${courseId}`
      if (courseExists.length === 0) return Response.json({ error: "Course not found" }, { status: 404 })
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

    let existing
    if (studentId) {
      existing = await db`
        SELECT id FROM "Attendance" 
        WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "date" = ${date}
      `
    } else if (courseId) {
      existing = await db`
        SELECT id FROM "Attendance" 
        WHERE "teacherId" = ${teacherId} AND "courseId" = ${courseId} AND "date" = ${date}
      `
    } else {
      existing = await db`
        SELECT id FROM "Attendance" 
        WHERE "teacherId" = ${teacherId} AND "courseId" IS NULL AND "date" = ${date}
      `
    }

    if (existing.length > 0) {
      const result = await db`
        UPDATE "Attendance"
        SET status = ${status}, notes = ${noteValue}, hours = ${hours || null}, "createdByUserId" = ${createdByUserId}
        WHERE id = ${existing[0].id}
        RETURNING *
      `
      const saved = result[0]
      if (studentId && courseId && (status === "present" || status === "נוכח")) {
        await syncTeacherAttendanceForCourseDate(db, courseId, date, createdByUserId, now)
      }
      return Response.json(saved)
    }

    const result = await db`
      INSERT INTO "Attendance" (id, "studentId", "teacherId", "courseId", date, status, notes, hours, "createdByUserId", "createdAt")
      VALUES (${id}, ${studentId || null}, ${teacherId || null}, ${courseId || null}, ${date}, ${status}, ${noteValue}, ${hours || null}, ${createdByUserId}, ${now})
      RETURNING *
    `
    const saved = result[0]
    if (studentId && courseId && (status === "present" || status === "נוכח")) {
      await syncTeacherAttendanceForCourseDate(db, courseId, date, createdByUserId, now)
    }
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
  for (const tid of teacherIds) {
    if (!tid) continue
    const existingTeacher = await db`
      SELECT id FROM "Attendance"
      WHERE "teacherId" = ${tid} AND "courseId" = ${courseId} AND "date" = ${date}
    `
    if (existingTeacher.length > 0) {
      await db`
        UPDATE "Attendance"
        SET status = ${presentStatus}, "createdByUserId" = ${createdByUserId}
        WHERE "teacherId" = ${tid} AND "courseId" = ${courseId} AND "date" = ${date}
      `
    } else {
      const teacherAttendanceId = crypto.randomUUID()
      await db`
        INSERT INTO "Attendance" (id, "studentId", "teacherId", "courseId", date, status, notes, hours, "createdByUserId", "createdAt")
        VALUES (${teacherAttendanceId}, null, ${tid}, ${courseId}, ${date}, ${presentStatus}, null, null, ${createdByUserId}, ${now})
      `
    }
  }
}

export const DELETE = withTenantAuth(async (req, _session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const { searchParams } = new URL(req.url)
    const id        = searchParams.get("id")
    const studentId = searchParams.get("studentId")
    const teacherId = searchParams.get("teacherId")
    const courseId  = searchParams.get("courseId")
    const date      = searchParams.get("date")
    const isAdmin = sessionRolesGrantFullAccess(_session.roleKey, _session.role)

    if (id) {
      const existing = await db`SELECT "teacherId" FROM "Attendance" WHERE id = ${id} LIMIT 1`
      if (existing.length === 0) {
        return Response.json({ error: "Attendance not found" }, { status: 404 })
      }
      if (existing[0].teacherId && !isAdmin) {
        return Response.json({ error: "Only admin can delete teacher attendance" }, { status: 403 })
      }
      await db`DELETE FROM "Attendance" WHERE id = ${id}`
      return Response.json({ success: true })
    }
    if (studentId && courseId && date) {
      await db`DELETE FROM "Attendance" WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "date" = ${date}`
      return Response.json({ success: true })
    }
    if (teacherId && courseId && date) {
      if (!isAdmin) {
        return Response.json({ error: "Only admin can delete teacher attendance manually" }, { status: 403 })
      }
      await db`DELETE FROM "Attendance" WHERE "teacherId" = ${teacherId} AND "courseId" = ${courseId} AND "date" = ${date}`
      return Response.json({ success: true })
    }
    return Response.json({ error: "id or (studentId/teacherId + courseId + date) required" }, { status: 400 })
  } catch (err) {
    return handleDbError(err, "DELETE /api/attendance")
  }
})
