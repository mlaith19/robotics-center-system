import { NextRequest, NextResponse } from "next/server"
import { resolveTenant } from "@/lib/resolve-tenant"
import { buildTenantSessionCookie, purgeLegacyCookies, SESSION_ABSOLUTE_MS } from "@/lib/session-config"

/**
 * DEV-ONLY: Finds the first active admin-role user in the resolved tenant DB
 * and sets a valid tenant-session cookie — so QA scripts can authenticate
 * without needing real credentials.
 *
 * POST /api/_debug/login-as-seed-admin
 * POST /api/_debug/login-as-seed-admin?centerId=<uuid>
 *
 * Returns: { ok, userId, username, role } + Set-Cookie: tenant-session
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  // Resolve tenant (supports ?centerId= for dev multi-tenant testing)
  const tenant = await resolveTenant(req)
  if (!tenant) {
    return NextResponse.json(
      { error: "TENANT_NOT_RESOLVED", hint: "Pass ?centerId=<uuid> or set DEFAULT_DEV_CENTER in .env.local" },
      { status: 400 }
    )
  }

  const { centerId, db } = tenant

  // Find first active user with a privileged role
  const ADMIN_ROLES = ["admin", "owner", "super_admin", "center_admin", "manager",
                       "מנהל", "אדמין", "administrator"]

  let user: {
    id: string; username: string; name: string; email: string | null
    role: string | null; role_key: string | null
  } | null = null

  // Try role-based lookup first
  for (const role of ADMIN_ROLES) {
    const rows = await db`
      SELECT u.id, u.username, u.name, u.email,
             u.role as role,
             r.key as role_key
      FROM "User" u
      LEFT JOIN "Role" r ON u."roleId" = r.id
      WHERE u.status = 'active'
        AND (
          lower(u.role) = lower(${role})
          OR lower(r.key) = lower(${role})
        )
      ORDER BY u."createdAt"
      LIMIT 1
    ` as typeof user[]
    if (rows.length) { user = rows[0]; break }
  }

  // Fallback: any active user with force_password_reset=false (created by provisioner)
  if (!user) {
    const rows = await db`
      SELECT u.id, u.username, u.name, u.email,
             u.role as role,
             r.key as role_key
      FROM "User" u
      LEFT JOIN "Role" r ON u."roleId" = r.id
      WHERE u.status = 'active'
      ORDER BY u."createdAt"
      LIMIT 1
    ` as typeof user[]
    if (rows.length) user = rows[0]
  }

  if (!user) {
    return NextResponse.json(
      { error: "NO_USERS_FOUND", hint: "Run tenant migrations + seed or create an admin user first." },
      { status: 404 }
    )
  }

  const now = new Date().toISOString()
  const resolvedRole   = user.role    ?? "admin"
  const resolvedRoleKey = user.role_key ?? "admin"

  const sessionPayload = JSON.stringify({
    id:           user.id,
    username:     user.username,
    full_name:    user.name,
    role:         resolvedRole,
    roleKey:      resolvedRoleKey,
    permissions:  [],
    centerId,
    loginTime:    now,
    lastActivity: now,
  })

  const cookie = await buildTenantSessionCookie(
    sessionPayload,
    Math.floor(SESSION_ABSOLUTE_MS / 1000)
  )

  const response = NextResponse.json({
    ok: true,
    userId:   user.id,
    username: user.username,
    role:     resolvedRole,
    roleKey:  resolvedRoleKey,
    centerId,
    hint: "tenant-session cookie set. Now call /api/students to verify.",
  })
  response.headers.append("Set-Cookie", cookie)
  purgeLegacyCookies(response)
  return response
}
