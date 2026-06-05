/**
 * requirePerm(session, permission) => null | Response(403)
 * Use after requireAuth. Returns 403 with FORBIDDEN, need: permission if session lacks the permission.
 */

import type { SessionUser } from "@/lib/auth-server"
import { hasFullAccessRole, hasPermission } from "@/lib/permissions"

export function requirePerm(session: SessionUser, permission: string): Response | null {
  const perms = session.permissions ?? []
  const roleKey = session.roleKey ?? ""
  const roleName = session.role ?? ""
  const username = (session.username ?? "").toString().trim().toLowerCase()
  if (hasFullAccessRole(roleKey) || hasFullAccessRole(roleName)) return null
  // Backward compatibility for legacy centers where admin users were provisioned
  // without a normalized role key in session but still use admin usernames.
  if (username === "admin" || username.endsWith("_admin")) return null
  if (hasPermission(perms, permission)) return null
  if (permission === "users.write" && (hasPermission(perms, "users.edit") || hasPermission(perms, "users.write"))) return null
  if (permission === "users.view" && (hasPermission(perms, "users.view") || hasPermission(perms, "users.read"))) return null
  return new Response(
    JSON.stringify({ error: "FORBIDDEN", need: permission }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  )
}

/** לפחות אחת מההרשאות (למשל צפייה בהגדרות או עריכת קורסים לרשימת פרופילי תעריף) */
export function requireAnyPerm(session: SessionUser, permissions: string[]): Response | null {
  const perms = session.permissions ?? []
  const roleKey = session.roleKey ?? ""
  const roleName = session.role ?? ""
  const username = (session.username ?? "").toString().trim().toLowerCase()
  if (hasFullAccessRole(roleKey) || hasFullAccessRole(roleName)) return null
  if (username === "admin" || username.endsWith("_admin")) return null
  if (permissions.some((p) => hasPermission(perms, p))) return null
  return new Response(
    JSON.stringify({ error: "FORBIDDEN", need: permissions }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  )
}
