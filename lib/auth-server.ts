/**
 * Tenant Dashboard session guard.
 *
 * Reads TENANT_SESSION_COOKIE_NAME ("tenant-session") exclusively.
 * Master sessions ("master-session") are completely invisible here.
 */

import {
  TENANT_SESSION_COOKIE_NAME,
  SESSION_IDLE_MS,
  SESSION_ABSOLUTE_MS,
} from "./session-config"
import { verifyAndDecodeSession } from "./session-codec"
import { hasFullAccessRole } from "@/lib/permissions"

export interface SessionUser {
  id: string
  username: string
  full_name: string
  role: string
  roleKey?: string
  permissions?: string[]
  centerId?: string
  loginTime: string
  lastActivity: string
}

async function parseSessionCookie(req: Request): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get("cookie")
  if (!cookieHeader) return null

  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${TENANT_SESSION_COOKIE_NAME}=([^;]+)`)
  )
  if (!match) return null

  const session = await verifyAndDecodeSession(match[1].trim())
  if (!session) return null

  const id = session.id
  if (!id || typeof id !== "string") return null
  const loginTime    = typeof session.loginTime    === "string" ? session.loginTime    : ""
  const lastActivity = typeof session.lastActivity === "string" ? session.lastActivity : loginTime
  if (!loginTime) return null
  return {
    id,
    username:    String(session.username    ?? ""),
    full_name:   String(session.full_name   ?? ""),
    role:        String(session.role        ?? "user"),
    roleKey:     session.roleKey != null ? String(session.roleKey) : undefined,
    permissions: Array.isArray(session.permissions) ? session.permissions as string[] : undefined,
    centerId:    typeof session.centerId === "string" ? session.centerId : undefined,
    loginTime,
    lastActivity,
  }
}

export async function getSession(req: Request): Promise<SessionUser | null> {
  const session = await parseSessionCookie(req)
  if (!session) return null
  const now     = Date.now()
  const loginAt = new Date(session.loginTime).getTime()
  const lastAt  = new Date(session.lastActivity).getTime()
  if (Number.isNaN(loginAt) || Number.isNaN(lastAt)) return null
  if (now - lastAt  > SESSION_IDLE_MS)     return null
  if (now - loginAt > SESSION_ABSOLUTE_MS) return null
  return session
}

export async function getCurrentUserId(req: Request): Promise<string | null> {
  return (await getSession(req))?.id ?? null
}

export function sessionWithRefreshedActivity(session: SessionUser): SessionUser {
  return { ...session, lastActivity: new Date().toISOString() }
}

/** Returns only the cookie names present in the request (safe for logging). */
export function getCookieNames(req: Request): string[] {
  const raw = req.headers.get("cookie") ?? ""
  if (!raw) return []
  return raw.split(";").map((c) => c.trim().split("=")[0]).filter(Boolean)
}

// ── Structured auth inspection ─────────────────────────────────────────────

export type AuthFailReason =
  | "missing_cookie"   // no tenant-session cookie in header
  | "parse_error"      // cookie value could not be decoded / JSON-parsed
  | "no_id"            // parsed session object has no id field
  | "no_timestamps"    // missing loginTime in session
  | "idle_timeout"     // lastActivity too old
  | "absolute_timeout" // loginTime too old
  | "ok"               // session valid

export interface AuthInspection {
  hasTenantCookie: boolean
  authOk: boolean
  failureReason: AuthFailReason
  /** Minimal safe user info — only present when authOk=true */
  user?: { id: string; username: string; role: string; roleKey?: string }
}

/** Diagnoses exactly WHY auth fails without exposing cookie values. */
export async function inspectAuth(req: Request): Promise<AuthInspection> {
  const cookieHeader = req.headers.get("cookie") ?? ""
  const hasTenantCookie = new RegExp(
    `(?:^|;\\s*)${TENANT_SESSION_COOKIE_NAME}=([^;]+)`
  ).test(cookieHeader)

  if (!hasTenantCookie) {
    return { hasTenantCookie: false, authOk: false, failureReason: "missing_cookie" }
  }

  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${TENANT_SESSION_COOKIE_NAME}=([^;]+)`)
  )
  const raw = match?.[1]?.trim() ?? ""
  const session = await verifyAndDecodeSession(raw)

  if (!session) {
    return { hasTenantCookie: true, authOk: false, failureReason: "parse_error" }
  }
  if (!session.id || typeof session.id !== "string") {
    return { hasTenantCookie: true, authOk: false, failureReason: "no_id" }
  }
  const loginTime    = typeof session.loginTime    === "string" ? session.loginTime    : ""
  const lastActivity = typeof session.lastActivity === "string" ? session.lastActivity : loginTime
  if (!loginTime) {
    return { hasTenantCookie: true, authOk: false, failureReason: "no_timestamps" }
  }
  const now     = Date.now()
  const loginAt = new Date(loginTime).getTime()
  const lastAt  = new Date(lastActivity).getTime()
  if (Number.isNaN(loginAt) || Number.isNaN(lastAt)) {
    return { hasTenantCookie: true, authOk: false, failureReason: "no_timestamps" }
  }
  if (now - lastAt  > SESSION_IDLE_MS) {
    return { hasTenantCookie: true, authOk: false, failureReason: "idle_timeout" }
  }
  if (now - loginAt > SESSION_ABSOLUTE_MS) {
    return { hasTenantCookie: true, authOk: false, failureReason: "absolute_timeout" }
  }

  return {
    hasTenantCookie: true,
    authOk: true,
    failureReason: "ok",
    user: {
      id:       String(session.id),
      username: String(session.username ?? ""),
      role:     String(session.role     ?? "user"),
      roleKey:  session.roleKey != null ? String(session.roleKey) : undefined,
    },
  }
}

export async function requireAuth(req: Request): Promise<[SessionUser, null] | [null, Response]> {
  const session = await getSession(req)
  if (session) return [session, null]
  return [null, new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })]
}

const ADMIN_ROLE_KEYS = new Set([
  "super_admin", "admin", "administrator", "center_admin", "owner", "manager",
])

export function requireAdmin(session: SessionUser): Response | null {
  const key = (session.roleKey || session.role || "").toString().toLowerCase()
  if (ADMIN_ROLE_KEYS.has(key) || hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)) return null
  return new Response(JSON.stringify({ error: "errors.forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
}
