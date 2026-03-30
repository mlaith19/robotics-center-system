import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import bcrypt from "bcryptjs"
import * as crypto from "crypto"
import { buildMasterSessionCookie, purgeLegacyCookies, MASTER_SESSION_ABSOLUTE_MS } from "@/lib/session-config"
import { MASTER_ROLES_SET } from "@/lib/master-roles"

// ── In-memory rate limiting for master login (per IP, 5 attempts → 15 min lockout) ──
const MASTER_MAX_FAILURES = 5
const MASTER_LOCKOUT_MS   = 15 * 60 * 1000
const masterAttempts = new Map<string, { count: number; firstAt: number }>()

function getMasterClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

function isMasterRateLimited(req: NextRequest): boolean {
  const ip  = getMasterClientIp(req)
  const cur = masterAttempts.get(ip)
  if (!cur) return false
  if (Date.now() - cur.firstAt > MASTER_LOCKOUT_MS) { masterAttempts.delete(ip); return false }
  return cur.count >= MASTER_MAX_FAILURES
}

function getMasterRemainingMs(req: NextRequest): number {
  const ip  = getMasterClientIp(req)
  const cur = masterAttempts.get(ip)
  if (!cur) return 0
  return Math.max(0, MASTER_LOCKOUT_MS - (Date.now() - cur.firstAt))
}

function recordMasterFailure(req: NextRequest): void {
  const ip  = getMasterClientIp(req)
  const now = Date.now()
  const cur = masterAttempts.get(ip)
  if (!cur) { masterAttempts.set(ip, { count: 1, firstAt: now }); return }
  cur.count += 1
}

function clearMasterFailure(req: NextRequest): void {
  masterAttempts.delete(getMasterClientIp(req))
}

export async function POST(req: NextRequest) {
  // Rate limiting check
  if (isMasterRateLimited(req)) {
    const remaining = Math.ceil(getMasterRemainingMs(req) / 1000)
    console.warn(`[MASTER_LOGIN] RATE_LIMITED ip=${getMasterClientIp(req)}`)
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${remaining} seconds.`, retryAfterSeconds: remaining },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const { username, password } = body as { username?: string; password?: string }
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 })
    }

    const rows = await sql`
      SELECT id, username, email, password_hash, role, force_password_reset
      FROM master_users
      WHERE username = ${username}
      LIMIT 1
    ` as { id: string; username: string; email: string; password_hash: string; role: string; force_password_reset: boolean }[]

    if (!rows.length) {
      recordMasterFailure(req)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    const user = rows[0]
    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      recordMasterFailure(req)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    clearMasterFailure(req)

    // Normalise role: store uppercase so middleware MASTER_ROLES_SET.has() always matches
    const roleKey = (user.role ?? "").toUpperCase()
    if (!MASTER_ROLES_SET.has(roleKey)) {
      console.error(`[MASTER_LOGIN] ROLE_MISMATCH user="${user.username}" role="${user.role}" normalised="${roleKey}" allowed=[${[...MASTER_ROLES_SET].join(",")}]`)
      return NextResponse.json({ error: "Account role not permitted for master access" }, { status: 403 })
    }

    const now = new Date().toISOString()
    const sessionPayload = JSON.stringify({
      id:           user.id,
      username:     user.username,
      email:        user.email ?? "",
      roleKey,               // always uppercase: "OWNER" / "MASTER_ADMIN"
      role:         roleKey,
      loginTime:    now,
      lastActivity: now,
    })

    const maxAgeSeconds = Math.floor(MASTER_SESSION_ABSOLUTE_MS / 1000)
    const cookieHeader  = await buildMasterSessionCookie(sessionPayload, maxAgeSeconds)

    console.log(`[MASTER_LOGIN] SUCCESS username="${user.username}" roleKey="${roleKey}"`)

    await sql`
      INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
      VALUES (${crypto.randomUUID()}, ${user.id}, 'master_login',
              ${JSON.stringify({ username: user.username, roleKey })}::jsonb, now())
    `

    const response = NextResponse.json({
      ok: true,
      role: roleKey,
      forcePasswordReset: user.force_password_reset,
    })
    // Set the new master-session cookie
    response.headers.set("Set-Cookie", cookieHeader)
    // Purge legacy robotics-session so it can never interfere
    purgeLegacyCookies(response)
    return response
  } catch (err) {
    console.error("[MASTER_LOGIN] error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
