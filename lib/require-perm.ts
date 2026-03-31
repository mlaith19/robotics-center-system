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
  if (hasFullAccessRole(roleKey) || hasFullAccessRole(roleName)) return null
  if (hasPermission(perms, permission)) return null
  if (permission === "users.write" && (hasPermission(perms, "users.edit") || hasPermission(perms, "users.write"))) return null
  if (permission === "users.view" && (hasPermission(perms, "users.view") || hasPermission(perms, "users.read"))) return null
  return new Response(
    JSON.stringify({ error: "FORBIDDEN", need: permission }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  )
}
