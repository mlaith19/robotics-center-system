/**
 * requirePerm(session, permission) => null | Response(403)
 * Use after requireAuth. Returns 403 with FORBIDDEN, need: permission if session lacks the permission.
 */

import type { SessionUser } from "@/lib/auth-server"
import { hasFullAccessRole } from "@/lib/permissions"

export function requirePerm(session: SessionUser, permission: string): Response | null {
  const perms = session.permissions ?? []
  const roleKey = session.roleKey ?? ""
  const roleName = session.role ?? ""
  if (hasFullAccessRole(roleKey) || hasFullAccessRole(roleName)) return null
  if (perms.includes(permission)) return null
  if (permission === "users.write" && (perms.includes("users.edit") || perms.includes("users.write"))) return null
  if (permission === "users.view" && (perms.includes("users.view") || perms.includes("users.read"))) return null
  return new Response(
    JSON.stringify({ error: "FORBIDDEN", need: permission }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  )
}
