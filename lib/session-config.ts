/**
 * Session cookie configuration.
 *
 * Two fully isolated cookies:
 *   master-session   → Master Portal (OWNER / MASTER_ADMIN)
 *   tenant-session   → Tenant Dashboard (center users)
 *
 * Cookie security: HttpOnly, Secure (production), SameSite=Lax, Path=/.
 * Session payload must never contain password — only identity and permissions.
 *
 * Legacy "robotics-session" is actively purged from the browser on every
 * login/logout so it can never interfere.
 */
import { signAndEncodeSession } from "./session-codec"

// ── Timeouts ──────────────────────────────────────────────────────────────────
export const SESSION_IDLE_MS     = Number(process.env.SESSION_IDLE_MS)     || 60 * 60 * 1000   // 1 h tenant idle
export const SESSION_ABSOLUTE_MS = Number(process.env.SESSION_ABSOLUTE_MS) || 8  * 60 * 60 * 1000  // 8 h absolute

/** Master idle timeout is the same as absolute — master stays logged in as long as the tab is open. */
export const MASTER_SESSION_IDLE_MS     = Number(process.env.MASTER_SESSION_IDLE_MS)     || 8 * 60 * 60 * 1000
export const MASTER_SESSION_ABSOLUTE_MS = Number(process.env.MASTER_SESSION_ABSOLUTE_MS) || 8 * 60 * 60 * 1000

// ── Cookie names ──────────────────────────────────────────────────────────────
export const MASTER_SESSION_COOKIE_NAME = "master-session"
export const TENANT_SESSION_COOKIE_NAME = "tenant-session"

/** Legacy name — used ONLY to purge it. Never read for auth. */
export const LEGACY_COOKIE_NAME = "robotics-session"

/** @deprecated Alias for TENANT_SESSION_COOKIE_NAME — do not use in new code. */
export const SESSION_COOKIE_NAME = TENANT_SESSION_COOKIE_NAME

// ── Internal helpers ──────────────────────────────────────────────────────────
function isSecure(): boolean {
  const e = process.env.COOKIE_SECURE
  if (e === "true")  return true
  if (e === "false") return false
  return process.env.NODE_ENV === "production"
}

async function makeCookieHeader(
  name: string,
  value: string,
  maxAgeSeconds: number,
  path = "/"
): Promise<string> {
  // signAndEncodeSession: base64url(payload).hmac when SESSION_SECRET is set
  const encoded = await signAndEncodeSession(value)
  const parts = [
    `${name}=${encoded}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=Lax`,
    `HttpOnly`,
  ]
  if (isSecure()) parts.push("Secure")
  return parts.join("; ")
}

function makeClearHeader(name: string, path = "/"): string {
  const parts = [`${name}=`, `Path=${path}`, `Max-Age=0`, `SameSite=Lax`, `HttpOnly`]
  if (isSecure()) parts.push("Secure")
  return parts.join("; ")
}

// ── Master session ────────────────────────────────────────────────────────────
export async function buildMasterSessionCookie(value: string, maxAgeSeconds: number): Promise<string> {
  return makeCookieHeader(MASTER_SESSION_COOKIE_NAME, value, maxAgeSeconds, "/")
}
export function clearMasterSessionCookie(): string {
  return makeClearHeader(MASTER_SESSION_COOKIE_NAME, "/")
}

// ── Tenant session ────────────────────────────────────────────────────────────
export async function buildTenantSessionCookie(value: string, maxAgeSeconds: number): Promise<string> {
  return makeCookieHeader(TENANT_SESSION_COOKIE_NAME, value, maxAgeSeconds, "/")
}
export function clearTenantSessionCookie(): string {
  return makeClearHeader(TENANT_SESSION_COOKIE_NAME, "/")
}

// ── Legacy cookie purge ───────────────────────────────────────────────────────
/**
 * Returns a Set-Cookie header that deletes the legacy "robotics-session" cookie.
 * Call purgeLegacyCookies(response) after building any auth response to prevent
 * the old cookie from ever interfering with the new auth system.
 */
export function getLegacyPurgeCookieHeader(): string {
  return makeClearHeader(LEGACY_COOKIE_NAME, "/")
}

/**
 * Appends the legacy-purge Set-Cookie header to a Response/NextResponse.
 * Safe to call multiple times.
 */
export function purgeLegacyCookies(response: { headers: { append: (k: string, v: string) => void } }): void {
  response.headers.append("Set-Cookie", getLegacyPurgeCookieHeader())
}

// ── Backward-compat aliases ───────────────────────────────────────────────────
export const buildSessionCookie: (value: string, maxAgeSeconds: number) => Promise<string> = buildTenantSessionCookie
export const clearSessionCookie = clearTenantSessionCookie

/** @deprecated */
export function getSessionCookieOptions() {
  return { httpOnly: true, secure: isSecure(), sameSite: "lax" as const, path: "/", maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000) }
}
