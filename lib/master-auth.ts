/**
 * Master Portal AuthZ guard.
 *
 * Reads MASTER_SESSION_COOKIE_NAME ("master-session") exclusively.
 * Uses parseSessionCookieValue (base64url / JSON / %-encoded tri-parse)
 * so the encoding format never causes silent validation failure.
 */

import { MASTER_SESSION_COOKIE_NAME } from "./session-config"
import { verifyAndDecodeSession }      from "./session-codec"
import { isMasterRole, MASTER_ROLES_SET } from "./master-roles"

const IDLE_MS     = Number(process.env.MASTER_SESSION_IDLE_MS)     || 8 * 60 * 60 * 1000
const ABSOLUTE_MS = Number(process.env.MASTER_SESSION_ABSOLUTE_MS) || 8 * 60 * 60 * 1000

export interface MasterSessionUser {
  id:           string
  username:     string
  email:        string
  role:         string
  loginTime:    string
  lastActivity: string
}

function extractCookieValue(cookieHeader: string, name: string): string | null {
  const re    = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)
  const match = cookieHeader.match(re)
  return match ? match[1].trim() : null
}

async function parseMasterSession(req: Request): Promise<MasterSessionUser | null> {
  const cookieHeader = req.headers.get("cookie")
  if (!cookieHeader) return null

  const raw = extractCookieValue(cookieHeader, MASTER_SESSION_COOKIE_NAME)
  if (!raw) return null

  const session = await verifyAndDecodeSession(raw)
  if (!session) {
    console.error(`[MASTER_AUTH] PARSE_ERROR — raw length=${raw.length} first30="${raw.slice(0, 30)}"`)
    return null
  }

  const { ok, found } = isMasterRole(session)
  if (!ok) {
    console.warn(`[MASTER_AUTH] ROLE_MISMATCH — found="${found}" allowed=[${[...MASTER_ROLES_SET].join(",")}]`)
    return null
  }

  const loginTime    = typeof session.loginTime    === "string" ? session.loginTime    : ""
  const lastActivity = typeof session.lastActivity === "string" ? session.lastActivity : loginTime
  if (!loginTime) {
    console.warn("[MASTER_AUTH] MISSING_TIMESTAMPS")
    return null
  }

  return {
    id:           String(session.id       ?? ""),
    username:     String(session.username ?? ""),
    email:        String(session.email    ?? ""),
    role:         found,
    loginTime,
    lastActivity,
  }
}

export async function getMasterSession(req: Request): Promise<MasterSessionUser | null> {
  const session = await parseMasterSession(req)
  if (!session) return null

  const now     = Date.now()
  const loginAt = new Date(session.loginTime).getTime()
  const lastAt  = new Date(session.lastActivity).getTime()
  if (Number.isNaN(loginAt) || Number.isNaN(lastAt)) return null
  if (now - lastAt  > IDLE_MS)     { console.warn("[MASTER_AUTH] IDLE_TIMEOUT");     return null }
  if (now - loginAt > ABSOLUTE_MS) { console.warn("[MASTER_AUTH] ABSOLUTE_TIMEOUT"); return null }
  return session
}

/**
 * Use in /api/master/* route handlers.
 * Returns [session, null] on success or [null, Response] with 401/403.
 */
export async function requireMaster(req: Request): Promise<[MasterSessionUser, null] | [null, Response]> {
  const cookieHeader = req.headers.get("cookie") ?? ""

  if (process.env.NODE_ENV !== "production") {
    const names = cookieHeader.split(";").map((c) => c.trim().split("=")[0]).filter(Boolean)
    console.log(`[MASTER_AUTH] cookies=[${names.join(", ")}]`)
  }

  if (!cookieHeader.includes(MASTER_SESSION_COOKIE_NAME)) {
    console.warn(`[MASTER_AUTH] NO_COOKIE — ${MASTER_SESSION_COOKIE_NAME} absent`)
    return [null, new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })]
  }

  const session = await getMasterSession(req)
  if (!session) {
    return [null, new Response(JSON.stringify({ error: "Forbidden: master access only" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })]
  }

  return [session, null]
}
