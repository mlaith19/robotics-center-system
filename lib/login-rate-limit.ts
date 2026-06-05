/**
 * In-memory rate limit for login attempts (per IP).
 * For multi-instance deployment, replace with Redis or similar.
 */
const FAILURE_COUNT_MAX = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

const attempts = new Map<string, { count: number; firstAt: number }>()

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

export function recordLoginFailure(req: Request): void {
  const ip = getClientIp(req)
  const now = Date.now()
  const cur = attempts.get(ip)
  if (!cur) {
    attempts.set(ip, { count: 1, firstAt: now })
    return
  }
  cur.count += 1
  cur.firstAt = cur.firstAt || now
}

export function clearLoginFailure(req: Request): void {
  attempts.delete(getClientIp(req))
}

export function isLoginRateLimited(req: Request): boolean {
  const ip = getClientIp(req)
  const cur = attempts.get(ip)
  if (!cur) return false
  const now = Date.now()
  if (now - cur.firstAt > LOCKOUT_MS) {
    attempts.delete(ip)
    return false
  }
  return cur.count >= FAILURE_COUNT_MAX
}

export function getRemainingLockoutMs(req: Request): number {
  const ip = getClientIp(req)
  const cur = attempts.get(ip)
  if (!cur || cur.count < FAILURE_COUNT_MAX) return 0
  const elapsed = Date.now() - cur.firstAt
  return Math.max(0, LOCKOUT_MS - elapsed)
}
