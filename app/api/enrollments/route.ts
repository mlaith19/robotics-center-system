import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { applySiblingAndAttendancePricingToEnrollmentRows } from "@/lib/enrollment-effective-price"
import { ensureCourseSessionPricesColumn } from "@/lib/course-session-prices"
import { sessionRolesGrantFullAccess } from "@/lib/permissions"
import { isCampCourseType } from "@/lib/camp-kaytana"
import {
  getTeacherIdForUserId,
  loadCampMeetingDetailForSessionDate,
  teacherCoversCampGroupOnMeeting,
  findCampMeetingCell,
  normCampGroupLabel,
} from "@/lib/camp-attendance"

function isMissingColumnError(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  return code === "42703"
}

async function ensureEnrollmentAuditColumns(db: any) {
  const safe = async (q: Promise<unknown>) => {
    try {
      await q
    } catch (err) {
      console.warn("[enrollments] ensure column skipped:", err)
    }
  }
  await safe(
    db`
      ALTER TABLE "Enrollment"
      ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT
    `
  )
}

export const GET = withTenantAuth(async (req, session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { searchParams } = new URL(req.url)
  const courseId  = searchParams.get("courseId")
  const studentId = searchParams.get("studentId")
  const forCampAttendanceDate = searchParams.get("forCampAttendanceDate")
  const forCampMeetingCellId = (searchParams.get("forCampMeetingCellId") || "").trim()

  const runWithUserJoin = async () => {
    if (courseId && studentId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", c."courseType", c."startDate", c."endDate", c."daysOfWeek", c."sessionPrices", u.name as "createdByUserName"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        LEFT JOIN "User" u ON e."createdByUserId" = u.id
        WHERE e."courseId" = ${courseId} AND e."studentId" = ${studentId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    if (courseId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", c."courseType", c."startDate", c."endDate", c."daysOfWeek", c."sessionPrices", u.name as "createdByUserName"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        LEFT JOIN "User" u ON e."createdByUserId" = u.id
        WHERE e."courseId" = ${courseId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    if (studentId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", c."courseType", c."startDate", c."endDate", c."daysOfWeek", c."sessionPrices", u.name as "createdByUserName"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        LEFT JOIN "User" u ON e."createdByUserId" = u.id
        WHERE e."studentId" = ${studentId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    return db`
      SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", c."courseType", c."startDate", c."endDate", c."daysOfWeek", c."sessionPrices", u.name as "createdByUserName"
      FROM "Enrollment" e
      LEFT JOIN "Student" s ON e."studentId" = s.id
      LEFT JOIN "Course" c ON e."courseId" = c.id
      LEFT JOIN "User" u ON e."createdByUserId" = u.id
      ORDER BY e."enrollmentDate" DESC
    `
  }

  const runWithoutUserJoin = async () => {
    if (courseId && studentId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", c."courseType", c."startDate", c."endDate", c."daysOfWeek", c."sessionPrices"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        WHERE e."courseId" = ${courseId} AND e."studentId" = ${studentId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    if (courseId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", c."courseType", c."startDate", c."endDate", c."daysOfWeek", c."sessionPrices"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        WHERE e."courseId" = ${courseId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    if (studentId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", c."courseType", c."startDate", c."endDate", c."daysOfWeek", c."sessionPrices"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        WHERE e."studentId" = ${studentId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    return db`
      SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", c."courseType", c."startDate", c."endDate", c."daysOfWeek", c."sessionPrices"
      FROM "Enrollment" e
      LEFT JOIN "Student" s ON e."studentId" = s.id
      LEFT JOIN "Course" c ON e."courseId" = c.id
      ORDER BY e."enrollmentDate" DESC
    `
  }

  try {
    await ensureEnrollmentAuditColumns(db)
    await ensureCourseSessionPricesColumn(db)
    let result: Record<string, unknown>[]
    try {
      result = (await runWithUserJoin()) as Record<string, unknown>[]
    } catch (firstErr) {
      if (isMissingColumnError(firstErr)) {
        const rows = (await runWithoutUserJoin()) as Record<string, unknown>[]
        result = rows.map((r) => ({ ...r, createdByUserName: null }))
      } else {
        throw firstErr
      }
    }
    const rows = result as Record<string, unknown>[]
    let finalRows = await applySiblingAndAttendancePricingToEnrollmentRows(db, rows)

    if (courseId && forCampAttendanceDate && /^\d{4}-\d{2}-\d{2}$/.test(forCampAttendanceDate)) {
      const crs = await db`SELECT "courseType" FROM "Course" WHERE id = ${courseId} LIMIT 1`
      if (crs.length && isCampCourseType(String((crs[0] as { courseType?: string }).courseType || ""))) {
        const isPrivileged = sessionRolesGrantFullAccess(session.roleKey, session.role)
        const tid = await getTeacherIdForUserId(db, session.id)
        const meeting = await loadCampMeetingDetailForSessionDate(db, courseId, forCampAttendanceDate)

        if (forCampMeetingCellId) {
          if (!meeting) {
            finalRows = []
          } else {
            const found = findCampMeetingCell(meeting, forCampMeetingCellId)
            if (!found) {
              finalRows = []
            } else if (!isPrivileged && (!tid || !found.cell.teacherIds.includes(tid))) {
              finalRows = []
            } else {
              const labels = new Set(
                found.cell.groupLabels.map((x) => normCampGroupLabel(x)).filter(Boolean),
              )
              finalRows = finalRows.filter((e) => {
                const g = normCampGroupLabel((e as { campGroupLabel?: string | null }).campGroupLabel)
                return g.length > 0 && labels.has(g)
              })
            }
          }
        } else if (!isPrivileged && tid && meeting) {
          finalRows = finalRows.filter((e) =>
            teacherCoversCampGroupOnMeeting(
              meeting,
              tid,
              (e as { campGroupLabel?: string | null }).campGroupLabel,
            ),
          )
        }
      }
    }

    return Response.json(finalRows)
  } catch (err) {
    console.error("GET /api/enrollments error:", err)
    return Response.json({ error: "Failed to load enrollments" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    await ensureEnrollmentAuditColumns(db)
    const body = await req.json()
    const { studentId, courseId, status, sessionsLeft } = body

    if (!studentId || !courseId) return Response.json({ error: "studentId and courseId are required" }, { status: 400 })

    const existing = await db`SELECT id FROM "Enrollment" WHERE "studentId" = ${studentId} AND "courseId" = ${courseId}`
    if (existing.length > 0) return Response.json({ error: "Enrollment already exists" }, { status: 409 })

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const enrollmentDate = new Date().toISOString().split('T')[0]
    const sessions = sessionsLeft ?? 12
    const createdByUserId = session.id

    let result: { id: string; studentId: string; courseId: string; [k: string]: unknown }[]
    try {
      result = await db`
        INSERT INTO "Enrollment" (id, "studentId", "courseId", "enrollmentDate", status, "sessionsLeft", "createdByUserId", "createdAt")
        VALUES (${id}, ${studentId}, ${courseId}, ${enrollmentDate}, ${status || 'active'}, ${sessions}, ${createdByUserId}, ${now})
        RETURNING *
      `
    } catch (insertErr) {
      if (isMissingColumnError(insertErr)) {
        result = await db`
          INSERT INTO "Enrollment" (id, "studentId", "courseId", "enrollmentDate", status, "sessionsLeft", "createdAt")
          VALUES (${id}, ${studentId}, ${courseId}, ${enrollmentDate}, ${status || 'active'}, ${sessions}, ${now})
          RETURNING *
        `
      } else {
        throw insertErr
      }
    }
    const row = result[0] ?? {}
    return Response.json({ ...row, createdByUserId: row.createdByUserId ?? createdByUserId }, { status: 201 })
  } catch (err) {
    console.error("POST /api/enrollments error:", err)
    return Response.json({ error: "Failed to create enrollment" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, _session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get("studentId")
    const courseId  = searchParams.get("courseId")

    if (!studentId || !courseId) return Response.json({ error: "studentId and courseId are required" }, { status: 400 })

    await db`DELETE FROM "Enrollment" WHERE "studentId" = ${studentId} AND "courseId" = ${courseId}`
    return Response.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/enrollments error:", err)
    return Response.json({ error: "Failed to delete enrollment" }, { status: 500 })
  }
})
