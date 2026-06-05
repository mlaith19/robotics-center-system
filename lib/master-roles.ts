/**
 * Centralised Master role constants.
 * Imported by: middleware, lib/master-auth.ts, app/api/master/auth/login.
 * Single source of truth — no string literals scattered across files.
 */

export const MASTER_ROLE_VALUES = ["OWNER", "MASTER_ADMIN", "SUPPORT"] as const
export type MasterRole = (typeof MASTER_ROLE_VALUES)[number]

export const MASTER_ROLES_SET = new Set<string>(MASTER_ROLE_VALUES)

/**
 * Normalise any role string to uppercase and check membership.
 * Also falls back to `role` field if `roleKey` is absent.
 */
export function isMasterRole(session: Record<string, unknown>): { ok: boolean; found: string } {
  const rk = typeof session.roleKey === "string" ? session.roleKey.trim().toUpperCase()
           : typeof session.role    === "string" ? session.role.trim().toUpperCase()
           : "(missing)"
  return { ok: MASTER_ROLES_SET.has(rk), found: rk }
}
