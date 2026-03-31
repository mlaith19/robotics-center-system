import bcrypt from "bcryptjs"
import { getCookieNames } from "@/lib/auth-server"
import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { ensureProfileImageColumns, resolveProfileImageWithFallback } from "@/lib/profile-image"

const PRIVILEGED_ROLES = ["owner", "admin", "administrator", "manager", "super_admin", "center_admin"]
const ALLOWED_ROLES    = [...PRIVILEGED_ROLES, "teacher", "student"]

function normalizeBirthDateInput(raw: unknown): string | null {
  const value = typeof raw === "string" ? raw.trim() : ""
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const m = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/)
  if (!m) return null
  const dd = m[1].padStart(2, "0")
  const mm = m[2].padStart(2, "0")
  const yyyy = m[3]
  return `${yyyy}-${mm}-${dd}`
}

function resolveRoleKey(session: { role?: string; roleKey?: string }): string {
  return (session.roleKey || session.role || "").toLowerCase()
}

function isPrivileged(session: { role?: string; roleKey?: string } | null): boolean {
  if (!session) return false
  if (!session.role && !session.roleKey && process.env.NODE_ENV !== "production") return true
  return PRIVILEGED_ROLES.includes(resolveRoleKey(session))
}

function checkRoleAllowed(session: { role?: string; roleKey?: string }): Response | null {
  if (!session.role && !session.roleKey && process.env.NODE_ENV !== "production") return null
  const role = resolveRoleKey(session)
  if (ALLOWED_ROLES.includes(role)) return null
  console.warn(`students:role_forbidden role=${role}`)
  return new Response(
    JSON.stringify({ error: "Forbidden", role, allowedRoles: ALLOWED_ROLES }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  )
}

export const GET = withTenantAuth(async (req, session) => {
  console.log("students:enter")
  const url      = new URL(req.url)
  const page     = url.searchParams.get("page")     ?? "1"
  const pageSize = url.searchParams.get("pageSize") ?? "all"
  console.log(`students:params_parsed page=${page} pageSize=${pageSize}`)
  console.log(`students:cookies_names [${getCookieNames(req).join(", ")}]`)
  console.log("students:after_auth ok=true")

  const roleErr = checkRoleAllowed(session)
  if (roleErr) return roleErr

  if (!isPrivileged(session)) {
    let fgTid: ReturnType<typeof setTimeout>
    const fgTimeout = new Promise<never>((_, reject) => {
      fgTid = setTimeout(() => reject(new Error("db_resolve_timeout")), 1500)
    })
    try {
      const featureErr = await Promise.race([
        requireFeatureFromRequest(req, "students", session),
        fgTimeout,
      ])
      clearTimeout(fgTid!)
      if (featureErr) return featureErr
    } catch (err) {
      clearTimeout(fgTid!)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === "db_resolve_timeout") {
        console.error("students:DB_RESOLVE_TIMEOUT")
        return new Response(JSON.stringify({ error: "db_resolve_timeout" }), {
          status: 504, headers: { "content-type": "application/json" },
        })
      }
      console.error(`students:feature_gate_error msg=${msg}`)
      return Response.json({ error: "Failed to check feature access" }, { status: 500 })
    }
  }

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  console.log("students:before_db")
  let queryTid: ReturnType<typeof setTimeout>
  const queryTimeout = new Promise<never>((_, reject) => {
    queryTid = setTimeout(() => reject(new Error("students_query_timeout")), 1500)
  })

  let students: unknown[]
  try {
    students = await Promise.race([
      db`SELECT * FROM "Student" ORDER BY "createdAt" DESC` as Promise<unknown[]>,
      queryTimeout,
    ])
    clearTimeout(queryTid!)
  } catch (err) {
    clearTimeout(queryTid!)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === "students_query_timeout") {
      console.error("students:QUERY_TIMEOUT")
      return new Response(JSON.stringify({ error: "students_query_timeout" }), {
        status: 504, headers: { "content-type": "application/json" },
      })
    }
    console.error(`students:query_error msg=${msg}`)
    return Response.json({ error: "Failed to load students" }, { status: 500 })
  }

  console.log(`students:after_query rows=${(students as any[]).length}`)
  return Response.json(students)
})

export const POST = withTenantAuth(async (req, session) => {
  if (!isPrivileged(session)) {
    const featureErr = await requireFeatureFromRequest(req, "students", session)
    if (featureErr) return featureErr
  }

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db

  try {
    const body = await req.json()
    await ensureProfileImageColumns(db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>)
    if (!body.name) return Response.json({ error: "name is required" }, { status: 400 })
    const profileImage = resolveProfileImageWithFallback(body.profileImage)

    const createUserAccount = body.createUserAccount === true
    const idNumberForAutoUser = body.idNumber ? String(body.idNumber).trim() : ""
    const phoneForAutoPassword = body.phone ? String(body.phone).trim() : ""
    const username = body.username
      ? String(body.username).trim()
      : (createUserAccount ? idNumberForAutoUser : null)
    const password = body.password
      ? String(body.password)
      : (createUserAccount ? phoneForAutoPassword : null)

    if (createUserAccount) {
      if (!username) return Response.json({ error: "username is required for user account" }, { status: 400 })
      if (!password || password.length < 4) return Response.json({ error: "password must be at least 4 characters" }, { status: 400 })
      const existingByUsername = await db`SELECT id FROM "User" WHERE username = ${username}`
      if (existingByUsername.length > 0) return Response.json({ error: "שם המשתמש כבר קיים במערכת" }, { status: 409 })
      const email = body.email ? String(body.email).trim() : null
      if (email) {
        const existingByEmail = await db`SELECT id FROM "User" WHERE email = ${email}`
        if (existingByEmail.length > 0) return Response.json({ error: "כתובת המייל כבר קיימת במערכת" }, { status: 409 })
      }
    }

    const studentId = crypto.randomUUID()
    const now       = new Date().toISOString()
    let userId: string | null = null

    if (createUserAccount && username && password) {
      userId = crypto.randomUUID()
      const hashedPassword = await bcrypt.hash(password, 10)
      await db`
        INSERT INTO "User" (id, name, email, username, password, phone, status, role, permissions, "createdAt", "updatedAt")
        VALUES (${userId}, ${body.name}, ${body.email || null}, ${username}, ${hashedPassword},
                ${body.phone || null}, 'active', 'student',
                ${JSON.stringify(["settings.home", "schedule.view"])}, ${now}, ${now})
      `
    }

    const result = await db`
      INSERT INTO "Student" (
        id, name, email, phone, address, city, status, "birthDate",
        "idNumber", father, mother, "additionalPhone", "healthFund", allergies,
        "totalSessions", "courseIds", "courseSessions", "profileImage", "userId", "createdAt", "updatedAt"
      )
      VALUES (
        ${studentId}, ${body.name}, ${body.email || null}, ${body.phone || null},
        ${body.address || null}, ${body.city || null},
        ${body.status || 'מתעניין'}, ${normalizeBirthDateInput(body.birthDate)},
        ${body.idNumber || null}, ${body.father || null}, ${body.mother || null},
        ${body.additionalPhone || null}, ${body.healthFund || null}, ${body.allergies || null},
        ${body.totalSessions || 12},
        ${JSON.stringify(body.courseIds || [])}::jsonb,
        ${JSON.stringify(body.courseSessions || {})}::jsonb,
        ${profileImage}, ${userId}, ${now}, ${now}
      )
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err: any) {
    console.error("POST /api/students error:", err)
    const code = err?.code
    const constraint = err?.constraint_name ?? err?.constraint
    if (code === "23505") {
      if (constraint === "User_email_key")
        return Response.json({ error: "כתובת המייל כבר קיימת במערכת" }, { status: 409 })
      if (constraint === "User_username_key")
        return Response.json({ error: "שם המשתמש כבר קיים במערכת" }, { status: 409 })
      return Response.json({ error: "הערך כבר קיים במערכת (שדה ייחודי)" }, { status: 409 })
    }
    return Response.json({ error: err?.message || "Failed to create student" }, { status: 500 })
  }
})
