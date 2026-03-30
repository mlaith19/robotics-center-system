import bcrypt from "bcryptjs"
import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"

type Ctx = { params: Promise<{ id: string }> }

function resolveRoleKey(session: { role?: string; roleKey?: string }): string {
  return (session.roleKey || session.role || "").toLowerCase()
}

// תפקידים שצריכים גישה מלאה לכל התלמידים (קריאה + עריכה)
const PRIVILEGED_ROLES = [
  "owner",
  "admin",
  "administrator",
  "manager",
  "super_admin",
  "center_admin",
  "secretary",
  "coordinator",
  "teacher",
]

function isPrivileged(session: { role?: string; roleKey?: string } | null): boolean {
  if (!session) return false
  const role = resolveRoleKey(session)
  return PRIVILEGED_ROLES.includes(role)
}

function canAccessStudent(session: { id: string; role?: string; roleKey?: string }, studentUserId: string | null): boolean {
  // אדמין / מנהל מרכז / סופר אדמין רואים כל תלמיד
  if (isPrivileged(session)) return true

  const role = resolveRoleKey(session)

  // תלמיד רואה רק את עצמו (student profile מחובר ל-userId)
  if (role === "student" && studentUserId != null && session.id === studentUserId) return true

  // ברירת מחדל – חסום
  return false
}

function toArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  if (typeof val === "string") {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

function toObject(val: unknown): Record<string, unknown> {
  if (val && typeof val === "object" && !Array.isArray(val)) return val as Record<string, unknown>
  if (typeof val === "string") {
    try { const p = JSON.parse(val); return p && typeof p === "object" && !Array.isArray(p) ? p : {} } catch { return {} }
  }
  return {}
}

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "students", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id } = await params
  try {
    const result = await db`SELECT * FROM "Student" WHERE id = ${id}`
    if (result.length === 0) return Response.json({ error: "Student not found" }, { status: 404 })
    const row = result[0] as Record<string, unknown>
    const userId = row?.userId != null ? String(row.userId) : null
    if (!canAccessStudent(session, userId)) {
      return Response.json({ error: "errors.forbiddenStudent" }, { status: 403 })
    }
    return Response.json({
      ...row,
      courseIds: toArray(row?.courseIds),
      courseSessions: toObject(row?.courseSessions),
    })
  } catch (err) {
    console.error("GET /api/students/[id] error:", err)
    return Response.json({ error: "Failed to load student" }, { status: 500 })
  }
})

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "students", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id } = await params
  const body = await req.json()

  try {
    const existing = await db`SELECT "userId" FROM "Student" WHERE id = ${id}`
    if (existing.length > 0) {
      const userId = (existing[0] as { userId: string | null })?.userId ?? null
      if (!canAccessStudent(session, userId)) {
        return Response.json({ error: "errors.forbiddenStudent" }, { status: 403 })
      }
    }
    const now = new Date().toISOString()
    const createUserAccount = body.createUserAccount === true
    const username = body.username ? String(body.username).trim() : null
    const password = body.password ? String(body.password) : null
    let userId = null

    if (createUserAccount && username && password) {
      const existingUser = await db`SELECT id FROM "User" WHERE username = ${username}`
      if (existingUser.length > 0) return Response.json({ error: "שם המשתמש כבר קיים במערכת" }, { status: 409 })
      userId = crypto.randomUUID()
      const hashedPassword = await bcrypt.hash(password, 10)
      await db`
        INSERT INTO "User" (id, name, email, username, password, phone, status, role, permissions, "createdAt", "updatedAt")
        VALUES (${userId}, ${body.name}, ${body.email || null}, ${username}, ${hashedPassword}, ${body.phone || null}, 'active', 'student', ${JSON.stringify(["settings.home", "schedule.view"])}, ${now}, ${now})
      `
    }

    const result = await db`
      UPDATE "Student"
      SET 
        name = ${body.name || null}, 
        email = ${body.email || null}, 
        phone = ${body.phone || null},
        address = ${body.address || null},
        city = ${body.city || null},
        status = ${body.status || 'פעיל'},
        "birthDate" = ${body.birthDate || null},
        "idNumber" = ${body.idNumber || null},
        father = ${body.father || null},
        mother = ${body.mother || null},
        "additionalPhone" = ${body.additionalPhone || null},
        "healthFund" = ${body.healthFund || null},
        allergies = ${body.allergies || null},
        "totalSessions" = ${body.totalSessions || 12},
        "courseIds" = ${JSON.stringify(body.courseIds || [])}::jsonb,
        "courseSessions" = ${JSON.stringify(body.courseSessions || {})}::jsonb,
        "userId" = COALESCE(${userId}, "userId"),
        "updatedAt" = ${now}
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return Response.json({ error: "Student not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("PUT /api/students/[id] error:", err)
    return Response.json({ error: "Failed to update student" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "students", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id } = await params
  try {
    const existing = await db`SELECT "userId" FROM "Student" WHERE id = ${id}`
    if (existing.length > 0) {
      const userId = (existing[0] as { userId: string | null })?.userId ?? null
      if (!canAccessStudent(session, userId)) {
        return Response.json({ error: "errors.forbiddenStudent" }, { status: 403 })
      }
    }
    await db`DELETE FROM "Enrollment" WHERE "studentId" = ${id}`
    await db`DELETE FROM "Attendance" WHERE "studentId" = ${id}`
    await db`DELETE FROM "Payment" WHERE "studentId" = ${id}`
    const result = await db`DELETE FROM "Student" WHERE id = ${id} RETURNING id`
    if (result.length === 0) return Response.json({ error: "Student not found" }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/students/[id] error:", err)
    return Response.json({ error: "Failed to delete student" }, { status: 500 })
  }
})
