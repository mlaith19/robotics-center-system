/**
 * proxy.ts — Next.js 16 middleware (replaces deprecated middleware.ts)
 *
 * Changes vs middleware.ts:
 *  - Filename changed from middleware.ts → proxy.ts (Next.js 16 convention)
 *  - Added ?center= / ?centerId= query param forwarding as x-tenant-center-id
 *    so login page can pass the center without relying solely on subdomain / host
 */
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getCenterIdByHost, getTenantContext } from "@/lib/tenant"
import { verifyAndDecodeSession, signAndEncodeSession } from "@/lib/session-codec"
import { isMasterRole } from "@/lib/master-roles"

// ── Cookie names ──────────────────────────────────────────────────────────────
const MASTER_COOKIE = "master-session"
const TENANT_COOKIE = "tenant-session"
const LEGACY_COOKIE = "robotics-session"

const TENANT_CENTER_ID_HEADER   = "x-tenant-center-id"
const TENANT_ACCESS_MODE_HEADER = "x-tenant-access-mode"

const MASTER_IDLE_MS     = Number(process.env.MASTER_SESSION_IDLE_MS)     || 8 * 60 * 60 * 1000
const MASTER_ABSOLUTE_MS = Number(process.env.MASTER_SESSION_ABSOLUTE_MS) || 8 * 60 * 60 * 1000
const TENANT_IDLE_MS     = Number(process.env.SESSION_IDLE_MS)             || 60 * 60 * 1000
const TENANT_ABSOLUTE_MS = Number(process.env.SESSION_ABSOLUTE_MS)         || 8 * 60 * 60 * 1000

const ACTIVATION_ONLY_ALLOWED = [
  "/api/activate",
  "/api/auth/",
  "/api/tenant/bootstrap",
  "/api/subscription/status",
  "/api/health/",
  "/api/_debug/",
]

// ── Types ─────────────────────────────────────────────────────────────────────

type FailReason =
  | "NO_COOKIE"
  | "PARSE_ERROR"
  | "ROLE_MISMATCH"
  | "IDLE_TIMEOUT"
  | "ABSOLUTE_TIMEOUT"
  | "INVALID_DATES"
  | "MISSING_TIMESTAMPS"

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: FailReason; detail?: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function checkTiming(
  session: Record<string, unknown>,
  idleMs: number,
  absoluteMs: number
): { ok: boolean; reason?: FailReason } {
  const loginTime    = typeof session.loginTime    === "string" ? session.loginTime    : null
  const lastActivity = typeof session.lastActivity === "string" ? session.lastActivity : loginTime
  if (!loginTime) return { ok: false, reason: "MISSING_TIMESTAMPS" }
  const now     = Date.now()
  const loginAt = new Date(loginTime).getTime()
  const lastAt  = lastActivity ? new Date(lastActivity).getTime() : NaN
  if (Number.isNaN(loginAt) || Number.isNaN(lastAt)) return { ok: false, reason: "INVALID_DATES" }
  if (now - lastAt  > idleMs)     return { ok: false, reason: "IDLE_TIMEOUT" }
  if (now - loginAt > absoluteMs) return { ok: false, reason: "ABSOLUTE_TIMEOUT" }
  return { ok: true }
}

async function validateMasterSession(req: NextRequest): Promise<ValidationResult> {
  const raw = req.cookies.get(MASTER_COOKIE)?.value
  if (!raw) return { valid: false, reason: "NO_COOKIE" }

  const session = await verifyAndDecodeSession(raw)
  if (!session) {
    console.error(`[PROXY] master-session PARSE_ERROR — raw length=${raw.length} first30="${raw.slice(0, 30)}"`)
    return { valid: false, reason: "PARSE_ERROR" }
  }

  const { ok, found } = isMasterRole(session)
  if (!ok) {
    console.warn(`[PROXY] master-session ROLE_MISMATCH — found="${found}" allowed=[OWNER,MASTER_ADMIN,SUPPORT]`)
    return { valid: false, reason: "ROLE_MISMATCH", detail: found }
  }

  const timing = checkTiming(session, MASTER_IDLE_MS, MASTER_ABSOLUTE_MS)
  if (!timing.ok) return { valid: false, reason: timing.reason! }

  return { valid: true }
}

async function validateTenantSession(req: NextRequest): Promise<ValidationResult> {
  const raw = req.cookies.get(TENANT_COOKIE)?.value
  if (!raw) return { valid: false, reason: "NO_COOKIE" }

  const session = await verifyAndDecodeSession(raw)
  if (!session) return { valid: false, reason: "PARSE_ERROR" }

  const timing = checkTiming(session, TENANT_IDLE_MS, TENANT_ABSOLUTE_MS)
  if (!timing.ok) return { valid: false, reason: timing.reason! }

  return { valid: true }
}

function logCookies(req: NextRequest, ctx: string): void {
  if (process.env.NODE_ENV === "production") return
  const all  = req.cookies.getAll().map((c) => c.name)
  const warn = all.includes(LEGACY_COOKIE) ? ` ⚠ legacy ${LEGACY_COOKIE} present` : ""
  console.log(`[PROXY:${ctx}] cookies=[${all.join(", ")}]${warn}`)
}

// ── Tenant-session cookie refresh ─────────────────────────────────────────────
async function refreshTenantCookieHeader(req: NextRequest): Promise<string | null> {
  const raw = req.cookies.get(TENANT_COOKIE)?.value
  if (!raw) return null

  const session = await verifyAndDecodeSession(raw)
  if (!session) return null

  const timing = checkTiming(session, TENANT_IDLE_MS, TENANT_ABSOLUTE_MS)
  if (!timing.ok) return null

  const refreshed = { ...session, lastActivity: new Date().toISOString() }
  const encoded   = await signAndEncodeSession(JSON.stringify(refreshed))
  const maxAge    = Math.floor(TENANT_ABSOLUTE_MS / 1000)
  const secure    = process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true"
  const parts     = [`${TENANT_COOKIE}=${encoded}`, `Path=/`, `Max-Age=${maxAge}`, `SameSite=Lax`, `HttpOnly`]
  if (secure) parts.push("Secure")
  return parts.join("; ")
}

// ── Extract center from query params (for dev: ?center=slug or ?centerId=uuid) ─
function getCenterIdFromQuery(req: NextRequest): string | null {
  if (process.env.NODE_ENV === "production") return null
  try {
    const qs = req.nextUrl.searchParams
    return qs.get("centerId") ?? qs.get("center") ?? null
  } catch {
    return null
  }
}

// ── Proxy (middleware) ────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const path   = req.nextUrl.pathname
  const method = req.method

  // /master/login — always allow (no session check)
  if (path === "/master/login") return NextResponse.next()

  // /master/* — validate ONLY master-session
  if (path.startsWith("/master/")) {
    logCookies(req, "MASTER")
    const result = await validateMasterSession(req)
    if (!result.valid) {
      const r = result as { valid: false; reason: string; detail?: string }
      console.warn(
        `[PROXY:MASTER] INVALID path=${path} reason=${r.reason}` +
        (r.detail ? ` detail="${r.detail}"` : "")
      )
      const url = new URL("/master/login", req.url)
      url.searchParams.set("expired", "1")
      url.searchParams.set("reason", r.reason)
      return NextResponse.redirect(url)
    }
    console.log(`[PROXY:MASTER] OK path=${path}`)
    return NextResponse.next()
  }

  // /api/master/* — bypass tenant logic; protected by requireMaster() in handlers
  if (path.startsWith("/api/master/")) return NextResponse.next()

  // ── Tenant resolution ──────────────────────────────────────────────────────
  const host = req.headers.get("host") ?? ""
  const requestHeaders = new Headers(req.headers)
  let centerId: string | null = null
  let accessMode: string | null = null
  let resolveSource = "none"

  // 1. Query param (dev only): ?center=slug or ?centerId=uuid
  const queryCenter = getCenterIdFromQuery(req)
  if (queryCenter) {
    centerId = queryCenter
    resolveSource = "query"
    console.log(`[PROXY:TENANT_RESOLVE] source=query center="${queryCenter}"`)
  }

  // 2. Host-based resolution (subdomain in prod, DEFAULT_DEV_CENTER in dev)
  if (!centerId && host) {
    centerId = await getCenterIdByHost(host)
    if (centerId) resolveSource = "host"
  }

  if (centerId) {
    requestHeaders.set(TENANT_CENTER_ID_HEADER, centerId)
    if (resolveSource !== "query") {
      console.log(`[PROXY:TENANT_RESOLVE] source=${resolveSource} centerId=${centerId}`)
    }

    const ctx = await getTenantContext(centerId)
    if (ctx) {
      accessMode = ctx.accessMode
      requestHeaders.set(TENANT_ACCESS_MODE_HEADER, accessMode)
    }
  } else {
    console.warn(`[PROXY:TENANT_RESOLVE] FAILED host=${host} — no centerId resolved (DB may be down)`)
  }

  // ── License engine ─────────────────────────────────────────────────────────
  if (path.startsWith("/api/") && accessMode) {
    const isWrite          = ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    const isReadOnly       = accessMode === "EXPIRED_READONLY"  || accessMode === "TRIAL_EXPIRED_READONLY"
    const isActivationOnly = accessMode === "ACTIVATION_ONLY"   || accessMode === "TRIAL_ACTIVATION_ONLY"

    if (isReadOnly && isWrite)
      return NextResponse.json({ error: "License expired: read-only mode." }, { status: 403 })
    if (isActivationOnly) {
      const allowed = ACTIVATION_ONLY_ALLOWED.some((p) =>
        p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(p + "/")
      )
      if (!allowed)
        return NextResponse.json({ error: "License expired: activation required." }, { status: 403 })
    }
  }

  // /dashboard/* — validate ONLY tenant-session; NEVER redirect to /master/login
  if (path.startsWith("/dashboard")) {
    logCookies(req, "TENANT")
    const result = await validateTenantSession(req)
    if (!result.valid) {
      const r = result as { valid: false; reason: string }
      console.warn(`[PROXY:TENANT] INVALID path=${path} reason=${r.reason}`)
      const url = new URL("/login", req.url)
      // "הפג תוקף" רק כשיהיה היה סשן שפג — לא כשאין קוקי (כניסה ראשונה)
      const hadSessionButExpired = r.reason !== "NO_COOKIE"
      if (hadSessionButExpired) url.searchParams.set("expired", "1")
      if (queryCenter) url.searchParams.set("center", queryCenter)
      return NextResponse.redirect(url)
    }
    console.log(`[PROXY:TENANT] OK path=${path}`)
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Auto-refresh tenant-session on every tenant API call
  if (
    path.startsWith("/api/") &&
    !path.startsWith("/api/master/") &&
    !path.startsWith("/api/auth/")
  ) {
    const refreshed = await refreshTenantCookieHeader(req)
    if (refreshed) response.headers.append("Set-Cookie", refreshed)
  }

  return response
}

// Also export as proxy for Next.js 16 compatibility
export { middleware as proxy }

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/master/:path*"],
}
