import bcrypt from "bcryptjs"
import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { ensureProfileImageColumns, resolveProfileImageWithFallback } from "@/lib/profile-image"
import { ensureTeacherPricingColumns, normalizeStudentTierRates, resolveTeacherHourlyRate } from "@/lib/teacher-pricing"

export const GET = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "teachers", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    await ensureTeacherPricingColumns(db)
    const [teachers, expenses, attendances, enrollments] = await Promise.all([
      db`SELECT * FROM "Teacher" ORDER BY "createdAt" DESC`,
      db`SELECT "teacherId", SUM(amount) as total_paid FROM "Expense" WHERE "teacherId" IS NOT NULL GROUP BY "teacherId"`,
      db`
        SELECT a."teacherId", a.status, a.hours, c.id as "courseId", c.location, c."startTime", c."endTime"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        WHERE a."teacherId" IS NOT NULL
      `,
      db`SELECT "courseId", COUNT(*)::int as cnt FROM "Enrollment" GROUP BY "courseId"`,
    ])

    const paidMap = new Map<string, number>()
    ;(expenses as any[]).forEach((r) => paidMap.set(String(r.teacherId), Number(r.total_paid || 0)))
    const enrollmentMap = new Map<string, number>()
    ;(enrollments as any[]).forEach((r) => enrollmentMap.set(String(r.courseId), Number(r.cnt || 0)))
    const teacherMap = new Map<string, any>()
    ;(teachers as any[]).forEach((t) => teacherMap.set(String(t.id), t))

    const owedMap = new Map<string, number>()
    ;(attendances as any[]).forEach((a) => {
      const teacherId = String(a.teacherId || "")
      if (!teacherId) return
      const status = String(a.status || "").toLowerCase()
      if (!(status === "נוכח" || status === "present")) return

      let hours = Number(a.hours || 0)
      if (!(Number.isFinite(hours) && hours > 0)) {
        const start = a.startTime ? new Date(a.startTime) : null
        const end = a.endTime ? new Date(a.endTime) : null
        if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          const diff = (end.getTime() - start.getTime()) / 3600000
          hours = diff > 0 ? diff : 0
        } else {
          hours = 0
        }
      }
      if (hours <= 0) return

      const teacher = teacherMap.get(teacherId)
      if (!teacher) return
      const rate = resolveTeacherHourlyRate({
        pricingMethod: (teacher.pricingMethod as any) || "standard",
        centerHourlyRate: Number(teacher.centerHourlyRate || 0),
        externalCourseRate: Number(teacher.externalCourseRate || 0),
        studentTierRates: normalizeStudentTierRates(teacher.studentTierRates),
        bonusEnabled: teacher.bonusEnabled === true,
        bonusMinStudents: teacher.bonusMinStudents != null ? Number(teacher.bonusMinStudents) : null,
        bonusPerHour: teacher.bonusPerHour != null ? Number(teacher.bonusPerHour) : 0,
        location: a.location ? String(a.location) : null,
        enrollmentCount: a.courseId ? enrollmentMap.get(String(a.courseId)) ?? 0 : 0,
      })
      const owed = (owedMap.get(teacherId) || 0) + rate * hours
      owedMap.set(teacherId, owed)
    })

    const out = (teachers as any[]).map((t) => {
      const totalPaid = paidMap.get(String(t.id)) || 0
      const totalOwed = owedMap.get(String(t.id)) || 0
      return {
        ...t,
        totalPaid,
        totalOwed,
        balance: totalPaid - totalOwed,
      }
    })
    return Response.json(out)
  } catch (err) {
    console.error("GET /api/teachers error:", err)
    return Response.json({ error: "Failed to load teachers" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "teachers", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const body = await req.json()
    await ensureProfileImageColumns(db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>)
    await ensureTeacherPricingColumns(db)
    const name = String(body.name ?? "").trim()
    const email = body.email ? String(body.email).trim() : null
    const phone = body.phone ? String(body.phone).trim() : null
    const idNumber = body.idNumber ? String(body.idNumber).trim() : null
    const birthDate = body.birthDate || null
    const city = body.city ? String(body.city).trim() : null
    const specialty = body.specialization ? String(body.specialization).trim() : null
    const status = body.status ? String(body.status).trim() : "פעיל"
    const bio = body.bio ? String(body.bio).trim() : null
    const centerHourlyRate = body.centerHourlyRate ?? null
    const travelRate = body.travelRate ?? null
    const externalCourseRate = body.externalCourseRate ?? null
    const pricingMethod = body.pricingMethod === "per_student_tier" ? "per_student_tier" : "standard"
    const studentTierRates = normalizeStudentTierRates(body.studentTierRates)
    const bonusEnabled = body.bonusEnabled === true
    const bonusMinStudents = body.bonusMinStudents != null && body.bonusMinStudents !== "" ? Number(body.bonusMinStudents) : null
    const bonusPerHour = body.bonusPerHour != null && body.bonusPerHour !== "" ? Number(body.bonusPerHour) : 0
    const profileImage = resolveProfileImageWithFallback(body.profileImage)

    const createUserAccount = body.createUserAccount === true
    const username = body.username ? String(body.username).trim() : null
    const password = body.password ? String(body.password) : null

    if (!name) return Response.json({ error: "name is required" }, { status: 400 })

    if (createUserAccount) {
      if (!username) return Response.json({ error: "username is required for user account" }, { status: 400 })
      if (!password || password.length < 4) return Response.json({ error: "password must be at least 4 characters" }, { status: 400 })
      const existingUser = await db`SELECT id FROM "User" WHERE username = ${username}`
      if (existingUser.length > 0) return Response.json({ error: "שם המשתמש כבר קיים במערכת" }, { status: 409 })
    }

    const teacherId = crypto.randomUUID()
    const now = new Date().toISOString()
    let userId = null

    if (createUserAccount && username && password) {
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
      INSERT INTO "Teacher" (
        id, name, email, phone, "idNumber", "birthDate", city, specialty, status, bio,
        "centerHourlyRate", "travelRate", "externalCourseRate", "pricingMethod", "studentTierRates", "bonusEnabled", "bonusMinStudents", "bonusPerHour", "profileImage", "userId", "createdAt", "updatedAt"
      )
      VALUES (
        ${teacherId}, ${name}, ${email}, ${phone}, ${idNumber}, ${birthDate}, ${city}, ${specialty}, ${status}, ${bio},
        ${centerHourlyRate}, ${travelRate}, ${externalCourseRate}, ${pricingMethod}, ${JSON.stringify(studentTierRates)}::jsonb, ${bonusEnabled}, ${bonusMinStudents}, ${bonusPerHour}, ${profileImage}, ${userId}, ${now}, ${now}
      )
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/teachers error:", err)
    return Response.json({ error: "Failed to create teacher" }, { status: 500 })
  }
})
