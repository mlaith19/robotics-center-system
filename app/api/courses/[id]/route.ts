import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { runAutoCompleteExpiredCourses } from "@/lib/course-status"
import { parseCourseDateForDb, parseCourseTimeForDb, courseTimeToDisplayValue } from "@/lib/course-db-fields"

type Ctx = { params: Promise<{ id: string }> }

function cleanStr(v: any): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length ? s : null
}

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id } = await params
  try {
    await runAutoCompleteExpiredCourses(db)
    const result = await db`
      SELECT
        c.*,
        to_char(c."startTime"::time, 'HH24:MI') as "startTime",
        to_char(c."endTime"::time, 'HH24:MI') as "endTime"
      FROM "Course" c
      WHERE c.id = ${id}
    `
    if (result.length === 0) return Response.json({ error: "Course not found" }, { status: 404 })
    const row = result[0] as Record<string, unknown>
    return Response.json({
      ...row,
      startTime: courseTimeToDisplayValue(row.startTime as string | null | undefined),
      endTime: courseTimeToDisplayValue(row.endTime as string | null | undefined),
    })
  } catch (err) {
    console.error("GET /api/courses/[id] error:", err)
    return Response.json({ error: "Failed to load course" }, { status: 500 })
  }
})

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id } = await params
  const body = await req.json()
  const name = cleanStr(body.name)
  if (!name) return Response.json({ error: "name is required" }, { status: 400 })

  try {
    const now = new Date().toISOString()
    const startDate = parseCourseDateForDb(body.startDate)
    const endDate = parseCourseDateForDb(body.endDate)
    const startTime = parseCourseTimeForDb(body.startTime)
    const endTime = parseCourseTimeForDb(body.endTime)
    // Use db.typed(value, 25) to send time strings as TEXT (OID 25) so postgres.js
    // does NOT apply its timestamp serializer (which would shift by local UTC offset).
    // PostgreSQL then casts TEXT → TIMESTAMP literally, with no timezone conversion.
    const startTimeVal = startTime !== null ? db.typed(startTime, 25) : null
    const endTimeVal   = endTime   !== null ? db.typed(endTime,   25) : null
    const result = await db`
      UPDATE "Course"
      SET name = ${name},
          description = ${cleanStr(body.description)},
          level = ${cleanStr(body.level) || "beginner"},
          duration = ${body.duration ? Number(body.duration) : null},
          price = ${body.price ? Number(body.price) : null},
          status = ${cleanStr(body.status) || "active"},
          "courseNumber" = ${cleanStr(body.courseNumber)},
          category = ${cleanStr(body.category)},
          "courseType" = ${cleanStr(body.courseType) || "regular"},
          location = ${cleanStr(body.location) || "center"},
          "startDate" = ${startDate},
          "endDate"   = ${endDate},
          "startTime" = ${startTimeVal}::timestamp,
          "endTime"   = ${endTimeVal}::timestamp,
          "daysOfWeek" = ${Array.isArray(body.daysOfWeek) ? body.daysOfWeek : []},
          "teacherIds" = ${Array.isArray(body.teacherIds) ? body.teacherIds : []},
          "schoolId"       = ${cleanStr(body.schoolId)},
          "gafanProgramId" = ${cleanStr(body.gafanProgramId)},
          "updatedAt" = ${now}
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return Response.json({ error: "Course not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("PUT /api/courses/[id] error:", err)
    return Response.json({ error: "Failed to update course" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id } = await params
  try {
    await db`DELETE FROM "Course" WHERE id = ${id}`
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/courses/[id] error:", err)
    return Response.json({ error: "Failed to delete course" }, { status: 500 })
  }
})
