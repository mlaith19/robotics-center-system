/**
 * lib/tenant-api-auth.ts
 *
 * Higher-Order Function (HOC) for tenant API route authentication.
 *
 * USAGE — simple route:
 *   export const GET = withTenantAuth(async (req, session) => {
 *     return Response.json({ user: session.username })
 *   })
 *
 * USAGE — dynamic route with Next.js context (params):
 *   type Ctx = { params: Promise<{ id: string }> }
 *   export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
 *     const { id } = await params
 *     return Response.json({ id })
 *   })
 *
 * HOW IT WORKS:
 *   1. requireAuth(req)                      → 401 if missing/invalid/expired session
 *   2. sessionWithRefreshedActivity(session) → bumps lastActivity to now
 *   3. handler(req, session, ...ctx)         → runs route logic
 *   4. Appends Set-Cookie: tenant-session=<refreshed> to the Response
 *      (append, never overwrite existing Set-Cookie headers)
 *
 * SAFETY:
 *   – Never logs cookie values, only names.
 *   – Does NOT touch master-session or master routes.
 *   – Secure flag is set only in production.
 */

import {
  requireAuth,
  sessionWithRefreshedActivity,
  type SessionUser,
} from "@/lib/auth-server"
import { buildTenantSessionCookie, SESSION_ABSOLUTE_MS } from "@/lib/session-config"

export type { SessionUser }

/**
 * withTenantAuth<T>(handler) → (req, ...ctx: T) => Promise<Response>
 *
 * T captures any extra arguments Next.js passes to the route handler
 * (e.g. the second `{ params }` argument of dynamic routes).
 */
export function withTenantAuth<T extends unknown[]>(
  handler: (req: Request, session: SessionUser, ...rest: T) => Promise<Response>
): (req: Request, ...rest: T) => Promise<Response> {
  return async (req: Request, ...rest: T): Promise<Response> => {
    // ── 1. Validate tenant session ─────────────────────────────────────────────
    const [session, authErr] = await requireAuth(req)
    if (authErr) return authErr // 401 — no Set-Cookie on failed auth

    // ── 2. Refresh lastActivity timestamp ──────────────────────────────────────
    const refreshed = sessionWithRefreshedActivity(session)
    const cookieStr = await buildTenantSessionCookie(
      JSON.stringify(refreshed),
      Math.floor(SESSION_ABSOLUTE_MS / 1000)
    )

    // ── 3. Run the handler ─────────────────────────────────────────────────────
    const result = await handler(req, refreshed, ...rest)

    // ── 4. Append Set-Cookie (never overwrite existing headers) ────────────────
    const newHeaders = new Headers(result.headers)
    newHeaders.append("Set-Cookie", cookieStr)

    return new Response(result.body, {
      status:     result.status,
      statusText: result.statusText,
      headers:    newHeaders,
    })
  }
}
