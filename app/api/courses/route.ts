import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { runAutoCompleteExpiredCourses } from "@/lib/course-status"
import { hasPermission, sessionRolesGrantFullAccess } from "@/lib/permissions"
import { parseCourseDateForDb, parseCourseTimeForDb, courseTimeToDisplayValue } from "@/lib/course-db-fields"
import { getCourseRegistrationVisibilityMap, setCourseRegistrationVisibility } from "@/lib/course-registration-visibility"
import { ensureSiblingDiscountTables } from "@/lib/sibling-discount"
import { syncCourseTeacherTariffs } from "@/lib/teacher-tariff-profiles"
import {
  ensureCourseSessionPricesColumn,
  ensureCourseNoAttendanceChargeColumn,
  normalizeSessionPricesMap,
  buildSessionPricesForCourseDates,
  courseTypeIsPerSession,
} from "@/lib/course-session-prices"

export const GET = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) {
    // Allow schedule page consumers to read course slots even when "courses" feature
    // is disabled in plan, as long as user explicitly has schedule visibility permission.
    const perms = session.permissions ?? []
    const canUseSchedule =
      sessionRolesGrantFullAccess(session.roleKey, session.role) ||
      hasPermission(perms, "schedule.view") ||
      hasPermission(perms, "nav.schedule")
    if (!canUseSchedule) return featureErr
  }
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    await ensureSiblingDiscountTables(db)
    await ensureCourseSessionPricesColumn(db)
    await ensureCourseNoAttendanceChargeColumn(db)
    // Avoid blocking/slowing every courses read request.
    // Keep status sync as best-effort background work.
    runAutoCompleteExpiredCourses(db).catch((e) => {
      console.warn("runAutoCompleteExpiredCourses skipped:", e)
    })

    let teacherScopeId: string | null = null
    const roleToken = (session.roleKey ?? session.role ?? "").toString().trim().toLowerCase()
    const isTeacherSession = roleToken === "teacher" || roleToken.includes("teacher") || roleToken.includes("מורה")
    if (!sessionRolesGrantFullAccess(session.roleKey, session.role)) {
      const tr = await db`
        SELECT id FROM "Teacher" WHERE "userId" = ${session.id} LIMIT 1
      `
      if (tr.length > 0) teacherScopeId = (tr[0] as { id: string }).id
      // Non-admin teacher without linked Teacher profile must not see all courses.
      if (!teacherScopeId && isTeacherSession) {
        return Response.json([])
      }
    }

    const { searchParams } = new URL(req.url)
    const schoolIdFilter = (searchParams.get("schoolId") || "").trim() || null

    const courseWhere =
      teacherScopeId != null && schoolIdFilter
        ? db`WHERE c."teacherIds" IS NOT NULL AND c."teacherIds" @> ${db.json([teacherScopeId])} AND c."schoolId" = ${schoolIdFilter}`
        : teacherScopeId != null
          ? db`WHERE c."teacherIds" IS NOT NULL AND c."teacherIds" @> ${db.json([teacherScopeId])}`
          : schoolIdFilter
            ? db`WHERE c."schoolId" = ${schoolIdFilter}`
            : db``

    const courses = await db`
      SELECT 
        c.*,
        COALESCE(enrollment_stats."enrollmentCount", 0) as "enrollmentCount",
        0 as "totalPaid",
        0 as "paidCount"
      FROM "Course" c
      LEFT JOIN (
        SELECT "courseId", COUNT(*) as "enrollmentCount"
        FROM "Enrollment"
        GROUP BY "courseId"
      ) enrollment_stats ON c.id = enrollment_stats."courseId"
      ${courseWhere}
      ORDER BY c."createdAt" DESC
    `
    const teachers = await db`SELECT id, name FROM "Teacher"`
    const teacherMap = new Map(teachers.map((t: any) => [t.id, t.name]))
    const visibilityMap = await getCourseRegistrationVisibilityMap(
      db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>,
      courses.map((course: any) => String(course.id))
    )
    const coursesWithTeachers = courses.map((course: any) => ({
      ...course,
      startTime: courseTimeToDisplayValue(course.startTime),
      endTime: courseTimeToDisplayValue(course.endTime),
      weekdays: course.daysOfWeek || [],
      showRegistrationLink: visibilityMap.get(String(course.id)) === true,
      teachers: (Array.isArray(course.teacherIds) ? course.teacherIds : []).map((id: string) => ({
        id,
        name: teacherMap.get(id) || "לא ידוע"
      }))
    }))
    return Response.json(coursesWithTeachers)
  } catch (err: any) {
    console.error("GET /api/courses error:", err)
    if (err.message?.includes("Too Many Requests") || err.message?.includes("rate limit")) {
      return Response.json({ error: "Too many requests, please try again" }, { status: 429 })
    }
    return Response.json({ error: "Failed to load courses" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    await ensureSiblingDiscountTables(db)
    await ensureCourseSessionPricesColumn(db)
    await ensureCourseNoAttendanceChargeColumn(db)
    const body = await req.json()
    const name = body.name ? String(body.name).trim() : null
    if (!name) return Response.json({ error: "name is required" }, { status: 400 })

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const description = body.description ? String(body.description).trim() : null
    const level = body.level ? String(body.level).trim() : "beginner"
    let duration = body.duration ? Number(body.duration) : null
    let price = body.price ? Number(body.price) : null
    const status = body.status ? String(body.status).trim() : "active"
    const courseNumber = body.courseNumber ? String(body.courseNumber).trim() : null
    const category = body.category ? String(body.category).trim() : null
    const courseType = body.courseType ? String(body.courseType).trim() : "regular"
    const location = body.location ? String(body.location).trim() : "center"
    const startDate = parseCourseDateForDb(body.startDate)
    const endDate = parseCourseDateForDb(body.endDate)
    const startTime = parseCourseTimeForDb(body.startTime)
    const endTime = parseCourseTimeForDb(body.endTime)
    const daysOfWeek = Array.isArray(body.daysOfWeek) ? body.daysOfWeek : []
    const teacherIds = Array.isArray(body.teacherIds) ? body.teacherIds : []
    const schoolId = body.schoolId ? String(body.schoolId).trim() : null
    const gafanProgramId = body.gafanProgramId ? String(body.gafanProgramId).trim() : null
    const siblingDiscountPackageId = body.siblingDiscountPackageId ? String(body.siblingDiscountPackageId).trim() : null
    const campChargeFirstSessionIfNoAttendance = body.campChargeFirstSessionIfNoAttendance === true
    const rawTariffPost = body.teacherTariffByTeacherId
    const tariffMapPost =
      rawTariffPost && typeof rawTariffPost === "object" && !Array.isArray(rawTariffPost)
        ? (Object.fromEntries(
            Object.entries(rawTariffPost as Record<string, unknown>).map(([k, v]) => [k, v != null ? String(v) : ""]),
          ) as Record<string, string>)
        : undefined
    if (tariffMapPost && teacherIds.length > 0) {
      for (const tid of teacherIds) {
        if (!String(tariffMapPost[tid] || "").trim()) {
          return Response.json(
            { error: "יש לבחור פרופיל תעריף לכל מורה משויך לקורס", code: "teacherTariff.missingProfile" },
            { status: 400 },
          )
        }
      }
    }
    // Force TEXT type (OID 25) so postgres.js skips its timestamp serializer
    const startTimeVal = startTime !== null ? db.typed(startTime, 25) : null
    const endTimeVal   = endTime   !== null ? db.typed(endTime,   25) : null

    let sessionPricesJson: Record<string, number> = {}
    if (courseTypeIsPerSession(courseType)) {
      const input = normalizeSessionPricesMap(body.sessionPrices)
      const fallback = price != null && !Number.isNaN(price) && price >= 0 ? price : 0
      sessionPricesJson = buildSessionPricesForCourseDates(startDate, endDate, daysOfWeek, input, fallback)
      const keys = Object.keys(sessionPricesJson)
      duration = keys.length
      price = Math.round(keys.reduce((s, k) => s + (sessionPricesJson[k] ?? 0), 0) * 100) / 100
    }

    const result = await db`
      INSERT INTO "Course" (
        id, name, description, level, duration, price, status, 
        "courseNumber", category, "courseType", location,
        "startDate", "endDate", "startTime", "endTime",
        "daysOfWeek", "teacherIds", "schoolId", "gafanProgramId", "siblingDiscountPackageId",
        "sessionPrices", "campChargeFirstSessionIfNoAttendance", "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${name}, ${description}, ${level}, ${duration}, ${price}, ${status},
        ${courseNumber}, ${category}, ${courseType}, ${location},
        ${startDate}, ${endDate}, ${startTimeVal}::timestamp, ${endTimeVal}::timestamp,
        ${daysOfWeek}, ${teacherIds}, ${schoolId}, ${gafanProgramId}, ${siblingDiscountPackageId},
        ${db.json(sessionPricesJson)}, ${campChargeFirstSessionIfNoAttendance}, ${now}, ${now}
      )
      RETURNING *
    `
    await setCourseRegistrationVisibility(
      db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>,
      id,
      body.showRegistrationLink === true
    )

    const sync = await syncCourseTeacherTariffs(db, id, teacherIds, tariffMapPost)
    if (!sync.ok) {
      return Response.json(
        { error: "יש לבחור פרופיל תעריף לכל מורה משויך לקורס", code: sync.error },
        { status: 400 },
      )
    }

    return Response.json(result[0], { status: 201 })
  } catch (err: any) {
    console.error("POST /api/courses error:", err)
    if (err.code === "23505") return Response.json({ error: "Duplicate unique field" }, { status: 409 })
    return Response.json({ error: "Failed to create course" }, { status: 500 })
  }
})
