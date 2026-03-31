import bcrypt from "bcryptjs"
import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { ensureProfileImageColumns, resolveProfileImageWithFallback } from "@/lib/profile-image"

export const GET = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "teachers", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const teachers = await db`
      SELECT t.*,
        COALESCE(expenses.total_paid, 0) as "totalPaid",
        COALESCE(attendance.total_owed, 0) as "totalOwed",
        COALESCE(expenses.total_paid, 0) - COALESCE(attendance.total_owed, 0) as "balance"
      FROM "Teacher" t
      LEFT JOIN (
        SELECT "teacherId", SUM(amount) as total_paid
        FROM "Expense"
        WHERE "teacherId" IS NOT NULL
        GROUP BY "teacherId"
      ) expenses ON t.id = expenses."teacherId"
      LEFT JOIN (
        SELECT 
          a."teacherId",
          SUM(
            CASE 
              WHEN LOWER(a.status) IN ('נוכח', 'present') THEN
                COALESCE(
                  a.hours,
                  EXTRACT(EPOCH FROM (c."endTime" - c."startTime")) / 3600
                ) * COALESCE(
                  CASE 
                    WHEN LOWER(c.location) LIKE '%מרכז%' OR c.location IS NULL OR c.location = '' THEN t."centerHourlyRate"
                    ELSE t."externalCourseRate"
                  END,
                  0
                )
              ELSE 0
            END
          ) as total_owed
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        LEFT JOIN "Teacher" t ON a."teacherId" = t.id
        WHERE a."teacherId" IS NOT NULL
        GROUP BY a."teacherId"
      ) attendance ON t.id = attendance."teacherId"
      ORDER BY t."createdAt" DESC
    `
    return Response.json(teachers)
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
        "centerHourlyRate", "travelRate", "externalCourseRate", "profileImage", "userId", "createdAt", "updatedAt"
      )
      VALUES (
        ${teacherId}, ${name}, ${email}, ${phone}, ${idNumber}, ${birthDate}, ${city}, ${specialty}, ${status}, ${bio},
        ${centerHourlyRate}, ${travelRate}, ${externalCourseRate}, ${profileImage}, ${userId}, ${now}, ${now}
      )
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/teachers error:", err)
    return Response.json({ error: "Failed to create teacher" }, { status: 500 })
  }
})
