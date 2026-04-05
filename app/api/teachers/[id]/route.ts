import { handleDbError } from "@/lib/db"
import bcrypt from "bcryptjs"
import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { hasFullAccessRole, hasPermission } from "@/lib/permissions"
import { ensureProfileImageColumns, resolveProfileImageWithFallback } from "@/lib/profile-image"
import { ensureTeacherPricingColumns } from "@/lib/teacher-pricing"
import { ensureTeacherTariffTables, resolveHourlyRateForAttendance } from "@/lib/teacher-tariff-profiles"

type Ctx = { params: Promise<{ id: string }> }

const TEACHER_PRIVILEGED_ROLES = ["super_admin", "center_admin", "admin", "administrator", "owner", "manager", "secretary", "coordinator"]

function canAccessTeacher(
  session: { id: string; roleKey?: string; role?: string; permissions?: string[] },
  teacherUserId: string | null,
  requiredPermission?: string
): boolean {
  const role = (session.roleKey ?? session.role ?? "").toString().trim().toLowerCase()
  const perms = Array.isArray(session.permissions) ? session.permissions : []
  if (hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)) return true
  if (TEACHER_PRIVILEGED_ROLES.includes(role)) return true
  if (role.includes("admin") || role.includes("מנהל") || role === "אדמין") return true
  if (requiredPermission && hasPermission(perms, requiredPermission)) return true
  return teacherUserId != null && session.id === teacherUserId
}

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const { id } = await params
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    await ensureTeacherPricingColumns(db)
    await ensureTeacherTariffTables(db)
    const result = await db`SELECT * FROM "Teacher" WHERE id = ${id}`
    if (result.length === 0) return Response.json({ error: "Teacher not found" }, { status: 404 })
    const row = result[0] as { userId?: string | null }
    const userId = row?.userId != null ? String(row.userId) : null
    if (!canAccessTeacher(session, userId, "teachers.view")) {
      return Response.json({ error: "errors.forbiddenTeacher" }, { status: 403 })
    }

    const teacherIdParam = String(id)
    const courses = await db`
      SELECT 
        c.id, c.name, c."daysOfWeek", c."startTime", c."endTime",
        c."startDate", c."endDate", c.price, c.status, c.location,
        COALESCE(enrollment_stats."enrollmentCount", 0) as "enrollmentCount",
        ctt."tariffProfileId" as "tariffProfileId",
        p.name as "tariffProfileName",
        p."pricingMethod" as "tp_pricingMethod",
        p."centerHourlyRate" as "tp_centerHourlyRate",
        p."travelRate" as "tp_travelRate",
        p."externalCourseRate" as "tp_externalCourseRate",
        p."officeHourlyRate" as "tp_officeHourlyRate",
        p."studentTierRates" as "tp_studentTierRates",
        p."bonusEnabled" as "tp_bonusEnabled",
        p."bonusMinStudents" as "tp_bonusMinStudents",
        p."bonusPerHour" as "tp_bonusPerHour"
      FROM "Course" c
      LEFT JOIN (
        SELECT "courseId", COUNT(*) as "enrollmentCount"
        FROM "Enrollment"
        GROUP BY "courseId"
      ) enrollment_stats ON c.id = enrollment_stats."courseId"
      LEFT JOIN "CourseTeacherTariff" ctt ON ctt."courseId" = c.id AND ctt."teacherId" = ${teacherIdParam}
      LEFT JOIN "TeacherTariffProfile" p ON p.id = ctt."tariffProfileId"
      WHERE c."teacherIds" IS NOT NULL
        AND jsonb_array_length(c."teacherIds") > 0
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(c."teacherIds") AS elem
          WHERE elem = (${teacherIdParam})::text
        )
      ORDER BY c.name
    `

    const teacherRow = result[0] as Record<string, unknown>
    const teacher = {
      ...result[0],
      teacherCourses: courses.map((c: any) => {
        const profileRow =
          c.tariffProfileId && c.tp_pricingMethod != null
            ? ({
                pricingMethod: c.tp_pricingMethod,
                centerHourlyRate: c.tp_centerHourlyRate,
                travelRate: c.tp_travelRate,
                externalCourseRate: c.tp_externalCourseRate,
                officeHourlyRate: c.tp_officeHourlyRate,
                studentTierRates: c.tp_studentTierRates,
                bonusEnabled: c.tp_bonusEnabled,
                bonusMinStudents: c.tp_bonusMinStudents,
                bonusPerHour: c.tp_bonusPerHour,
              } as Record<string, unknown>)
            : null
        const enrollmentCount = Number(c.enrollmentCount || 0)
        const effectiveHourlyRate = resolveHourlyRateForAttendance({
          tariffProfileRow: profileRow,
          teacherRow,
          location: c.location != null ? String(c.location) : null,
          enrollmentCount,
        })
        const baseCourse = {
          id: c.id,
          name: c.name,
          daysOfWeek: c.daysOfWeek,
          startTime: c.startTime,
          endTime: c.endTime,
          startDate: c.startDate,
          endDate: c.endDate,
          price: c.price,
          status: c.status,
          location: c.location,
          enrollmentCount,
          tariffProfileId: c.tariffProfileId ?? null,
          tariffProfileName: c.tariffProfileName ?? null,
          pricingMethod: profileRow
            ? String(c.tp_pricingMethod) === "per_student_tier"
              ? "per_student_tier"
              : "standard"
            : String(teacherRow.pricingMethod || "standard") === "per_student_tier"
              ? "per_student_tier"
              : "standard",
          effectiveHourlyRate,
        }
        return { course: baseCourse }
      }),
    }
    return Response.json(teacher)
  } catch (err) {
    return handleDbError(err, "GET /api/teachers/[id]")
  }
})

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "teachers", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id } = await params
  const body = await req.json()

  const existingTeacher = await db`SELECT "userId" FROM "Teacher" WHERE id = ${id}`
  if (existingTeacher.length > 0) {
    const userId = (existingTeacher[0] as { userId: string | null })?.userId ?? null
    if (!canAccessTeacher(session, userId, "teachers.edit")) {
      return Response.json({ error: "errors.forbiddenTeacher" }, { status: 403 })
    }
  }

  try {
    await ensureProfileImageColumns(db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>)
    const name = String(body.name ?? "").trim()
    const email = body.email ? String(body.email).trim() : null
    const phone = body.phone ? String(body.phone).trim() : null
    const idNumber = body.idNumber ? String(body.idNumber).trim() : null
    const birthDate = body.birthDate || null
    const city = body.city ? String(body.city).trim() : null
    const specialty = body.specialization ? String(body.specialization).trim() : null
    const status = body.status ? String(body.status).trim() : null
    const bio = body.bio ? String(body.bio).trim() : null
    const profileImage = resolveProfileImageWithFallback(body.profileImage)
    const now = new Date().toISOString()

    const createUserAccount = body.createUserAccount === true
    const username = body.username ? String(body.username).trim() : null
    const password = body.password ? String(body.password) : null
    let userId: string | null = null

    if (createUserAccount && username && password) {
      const existingUser = await db`SELECT id FROM "User" WHERE username = ${username}`
      if (existingUser.length > 0) return Response.json({ error: "שם המשתמש כבר קיים במערכת" }, { status: 409 })
      userId = crypto.randomUUID()
      const hashedPassword = await bcrypt.hash(password, 10)
      await db`
        INSERT INTO "User" (id, name, email, username, password, phone, status, role, permissions, "force_password_reset", "createdAt", "updatedAt")
        VALUES (${userId}, ${name}, ${email}, ${username}, ${hashedPassword}, ${phone}, 'active', 'teacher', ${JSON.stringify([
          "courses.view", "students.view", "teachers.view", "schedule.view",
          "attendance.view", "attendance.edit", "settings.home",
        ])}, false, ${now}, ${now})
      `
    }

    const result = await db`
      UPDATE "Teacher"
      SET 
        name = ${name}, email = ${email}, phone = ${phone},
        "idNumber" = ${idNumber}, "birthDate" = ${birthDate}, city = ${city},
        specialty = ${specialty}, status = ${status}, bio = ${bio},
        "profileImage" = ${profileImage},
        "userId" = COALESCE(${userId}, "userId"),
        "updatedAt" = ${now}
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return Response.json({ error: "Teacher not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    return handleDbError(err, "PUT /api/teachers/[id]")
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "teachers", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id } = await params

  const existing = await db`SELECT "userId" FROM "Teacher" WHERE id = ${id}`
  if (existing.length > 0) {
    const userId = (existing[0] as { userId: string | null })?.userId ?? null
    if (!canAccessTeacher(session, userId, "teachers.delete")) {
      return Response.json({ error: "errors.forbiddenTeacher" }, { status: 403 })
    }
  }

  try {
    const row = await db`SELECT "userId" FROM "Teacher" WHERE id = ${id} LIMIT 1`
    const userId = row.length > 0 ? ((row[0] as { userId?: string | null }).userId ?? null) : null
    await db`
      UPDATE "Course" c
      SET "teacherIds" = COALESCE((
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements_text(COALESCE(c."teacherIds", '[]'::jsonb)) AS elem
        WHERE elem <> ${id}
      ), '[]'::jsonb)
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(c."teacherIds", '[]'::jsonb)) AS elem
        WHERE elem = ${id}
      )
    `
    await db`DELETE FROM "Attendance" WHERE "teacherId" = ${id}`
    await db`DELETE FROM "Teacher" WHERE id = ${id}`
    if (userId) {
      await db`DELETE FROM "User" WHERE id = ${userId}`
    }
    return new Response(null, { status: 204 })
  } catch (err) {
    return handleDbError(err, "DELETE /api/teachers/[id]")
  }
})
