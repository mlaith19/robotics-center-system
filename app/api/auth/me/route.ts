import { NextResponse } from "next/server"
import { getSession, sessionWithRefreshedActivity } from "@/lib/auth-server"
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
  const effectiveRole    = isDev && MISSING.includes(session.role    as string | null | undefined) ? "admin" : session.role
  const effectiveRoleKey = isDev && MISSING.includes(session.roleKey as string | null | undefined) ? "admin" : session.roleKey

  let permissions = session.permissions ?? []
  if (permissions.length === 0 && effectiveRoleKey) {
    const roleDefaults = getPermissionsForRole(effectiveRoleKey as RoleType)
    if (roleDefaults.length > 0) permissions = roleDefaults
  }

  const response = NextResponse.json({
    id:          session.id,
    username:    session.username,
    full_name:   session.full_name,
    role:        effectiveRole,
    roleKey:     effectiveRoleKey,
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
