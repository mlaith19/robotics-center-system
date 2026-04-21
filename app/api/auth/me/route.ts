import { NextResponse } from "next/server"
import { getSession, sessionWithRefreshedActivity } from "@/lib/auth-server"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import {
  buildTenantSessionCookie,
  clearTenantSessionCookie,
  purgeLegacyCookies,
  SESSION_ABSOLUTE_MS,
} from "@/lib/session-config"
import { getPermissionsForRole, type RoleType } from "@/lib/permissions"

export async function GET(request: Request) {
  const session = await getSession(request)
  if (!session) {
    const res = NextResponse.json({ error: "Session expired or invalid" }, { status: 401 })
    res.headers.set("Set-Cookie", clearTenantSessionCookie())
    purgeLegacyCookies(res)
    return res
  }

  const refreshed = sessionWithRefreshedActivity(session)
  const cookie = await buildTenantSessionCookie(
    JSON.stringify(refreshed),
    Math.floor(SESSION_ABSOLUTE_MS / 1000)
  )

  const MISSING = ["user", "", undefined, null]
  const isDev = process.env.NODE_ENV !== "production"
  const effectiveSessionRole = isDev && MISSING.includes(session.role as string | null | undefined) ? "admin" : session.role
  const effectiveSessionRoleKey = isDev && MISSING.includes(session.roleKey as string | null | undefined) ? "admin" : session.roleKey

  let effectiveRole = (effectiveSessionRoleKey || effectiveSessionRole || "").toString().trim()
  let permissions = refreshed.permissions ?? []

  // Always try to refresh role/permissions from tenant DB so changes in Users page
  // apply immediately without requiring logout/login.
  try {
    const [tenant, tenantErr] = await requireTenant(request)
    if (!tenantErr && tenant) {
      const mismatch = ensureSessionMatchesTenant(refreshed, tenant)
      if (!mismatch) {
        const rows = await tenant.db`
          SELECT role, permissions
          FROM "User"
          WHERE id = ${refreshed.id}
          LIMIT 1
        `
        if (rows.length > 0) {
          const row = rows[0] as { role?: string | null; permissions?: unknown }
          const dbRole = (row.role || "").toString().trim()
          if (dbRole) effectiveRole = dbRole
          let dbPerms: string[] = []
          if (Array.isArray(row.permissions)) {
            dbPerms = row.permissions.map((p) => String(p)).filter(Boolean)
          } else if (typeof row.permissions === "string") {
            try {
              const parsed = JSON.parse(row.permissions)
              if (Array.isArray(parsed)) dbPerms = parsed.map((p) => String(p)).filter(Boolean)
            } catch {}
          }
          // Keep existing session permissions if DB value is empty/missing
          // to avoid accidental lockout during transitions/migrations.
          if (dbPerms.length > 0) permissions = dbPerms
        }
      }
    }
  } catch (err) {
    console.warn("[auth/me] failed to refresh permissions from tenant DB:", err)
  }

  const fallbackRoleForDefaults = (effectiveSessionRoleKey || effectiveSessionRole || effectiveRole || "").toString()
  if (permissions.length === 0 && fallbackRoleForDefaults) {
    const roleDefaults = getPermissionsForRole(fallbackRoleForDefaults as RoleType)
    if (roleDefaults.length > 0) permissions = roleDefaults
  }

  const response = NextResponse.json({
    id:          session.id,
    username:    session.username,
    full_name:   session.full_name,
    role:        effectiveRole || effectiveSessionRole || null,
    roleKey:     effectiveRole || effectiveSessionRoleKey || null,
    permissions,
    loginTime:   session.loginTime,
    centerId:    (session as Record<string, unknown>).centerId    ?? null,
    centerSlug:  (session as Record<string, unknown>).centerSlug  ?? null,
    centerName:  (session as Record<string, unknown>).centerName  ?? null,
  })
  response.headers.set("Set-Cookie", cookie)
  purgeLegacyCookies(response)
  return response
}
