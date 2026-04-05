import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { runAutoCompleteExpiredCourses } from "@/lib/course-status"
import { parseCourseDateForDb, parseCourseTimeForDb, courseTimeToDisplayValue } from "@/lib/course-db-fields"
import { getCourseRegistrationVisibilityMap, setCourseRegistrationVisibility } from "@/lib/course-registration-visibility"
import { ensureSiblingDiscountTables } from "@/lib/sibling-discount"
import { ensureTeacherTariffTables, loadCourseTeacherTariffMap, syncCourseTeacherTariffs } from "@/lib/teacher-tariff-profiles"
import {
  ensureCourseSessionPricesColumn,
  normalizeSessionPricesMap,
  buildSessionPricesForCourseDates,
  courseTypeIsPerSession,
} from "@/lib/course-session-prices"

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
    await ensureSiblingDiscountTables(db)
    await ensureCourseSessionPricesColumn(db)
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
    const visibilityMap = await getCourseRegistrationVisibilityMap(
      db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>,
      [String(id)]
    )
    const teacherTariffByTeacherId = await loadCourseTeacherTariffMap(db, String(id))
    return Response.json({
      ...row,
      startTime: courseTimeToDisplayValue(row.startTime as string | null | undefined),
      endTime: courseTimeToDisplayValue(row.endTime as string | null | undefined),
      showRegistrationLink: visibilityMap.get(String(id)) === true,
      teacherTariffByTeacherId,
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
    await ensureSiblingDiscountTables(db)
    await ensureCourseSessionPricesColumn(db)
    const teacherIdsPre = Array.isArray(body.teacherIds) ? body.teacherIds.map((x: unknown) => String(x)) : []
    const rawTariffPre = body.teacherTariffByTeacherId
    const tariffMapPre =
      rawTariffPre && typeof rawTariffPre === "object" && !Array.isArray(rawTariffPre)
        ? (Object.fromEntries(
            Object.entries(rawTariffPre as Record<string, unknown>).map(([k, v]) => [k, v != null ? String(v) : ""]),
          ) as Record<string, string>)
        : undefined
    if (tariffMapPre && teacherIdsPre.length > 0) {
      for (const tid of teacherIdsPre) {
        if (!String(tariffMapPre[tid] || "").trim()) {
          return Response.json(
            { error: "יש לבחור פרופיל תעריף (מהגדרות המרכז) לכל מורה משויך לקורס", code: "teacherTariff.missingProfile" },
            { status: 400 },
          )
        }
      }
    }
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
    const courseTypePut = cleanStr(body.courseType) || "regular"
    const daysOfWeekPut = Array.isArray(body.daysOfWeek) ? body.daysOfWeek : []
    let durationPut = body.duration ? Number(body.duration) : null
    let pricePut = body.price != null ? Number(body.price) : null
    let sessionPricesPut: Record<string, number> = {}
    if (courseTypeIsPerSession(courseTypePut)) {
      const input = normalizeSessionPricesMap(body.sessionPrices)
      const fallback = pricePut != null && !Number.isNaN(pricePut) && pricePut >= 0 ? pricePut : 0
      sessionPricesPut = buildSessionPricesForCourseDates(startDate, endDate, daysOfWeekPut, input, fallback)
      const keys = Object.keys(sessionPricesPut)
      durationPut = keys.length
      pricePut = Math.round(keys.reduce((s, k) => s + (sessionPricesPut[k] ?? 0), 0) * 100) / 100
    }
    const result = await db`
      UPDATE "Course"
      SET name = ${name},
          description = ${cleanStr(body.description)},
          level = ${cleanStr(body.level) || "beginner"},
          duration = ${durationPut},
          price = ${pricePut},
          status = ${cleanStr(body.status) || "active"},
          "courseNumber" = ${cleanStr(body.courseNumber)},
          category = ${cleanStr(body.category)},
          "courseType" = ${courseTypePut},
          location = ${cleanStr(body.location) || "center"},
          "startDate" = ${startDate},
          "endDate"   = ${endDate},
          "startTime" = ${startTimeVal}::timestamp,
          "endTime"   = ${endTimeVal}::timestamp,
          "daysOfWeek" = ${daysOfWeekPut},
          "teacherIds" = ${Array.isArray(body.teacherIds) ? body.teacherIds : []},
          "schoolId"       = ${cleanStr(body.schoolId)},
          "gafanProgramId" = ${cleanStr(body.gafanProgramId)},
          "siblingDiscountPackageId" = ${cleanStr(body.siblingDiscountPackageId)},
          "sessionPrices" = ${db.json(sessionPricesPut)},
          "updatedAt" = ${now}
      WHERE id = ${id}
      RETURNING *
    `
    await setCourseRegistrationVisibility(
      db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>,
      String(id),
      body.showRegistrationLink === true
    )
    if (result.length === 0) return Response.json({ error: "Course not found" }, { status: 404 })

    const sync = await syncCourseTeacherTariffs(db, String(id), teacherIdsPre, tariffMapPre)
    if (!sync.ok) {
      return Response.json(
        { error: "יש לבחור פרופיל תעריף (מהגדרות המרכז) לכל מורה משויך לקורס", code: sync.error },
        { status: 400 },
      )
    }

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
    await ensureTeacherTariffTables(db)
    await db`DELETE FROM "CourseTeacherTariff" WHERE "courseId" = ${id}`
    await db`DELETE FROM "Course" WHERE id = ${id}`
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/courses/[id] error:", err)
    return Response.json({ error: "Failed to delete course" }, { status: 500 })
  }
})
