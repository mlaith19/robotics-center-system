import { NextRequest, NextResponse } from "next/server"
import { inspectAuth, getCookieNames } from "@/lib/auth-server"
import { resolveTenantBySubdomain } from "@/lib/tenant/resolve-tenant"

/**
 * DEV-ONLY: Auth + tenant resolution debug.
 * GET /api/_debug/auth
 * Returns: host, centerSlugResolved, centerIdResolved, cookieNames, hasTenantSessionCookie, authOk, authFailureReason
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  const host = req.headers.get("host") ?? ""
  const cookieNames = getCookieNames(req)
  const inspection = inspectAuth(req)
  const hasTenantSessionCookie = cookieNames.includes("tenant-session")

  let centerSlugResolved: string | null = null
  let centerIdResolved: string | null = null
  const resolved = await resolveTenantBySubdomain(req)
  if (resolved.ok) {
    centerSlugResolved = resolved.subdomain
    centerIdResolved = resolved.centerId
  }

  return NextResponse.json({
    host,
    centerSlugResolved,
    centerIdResolved,
    cookieNames,
    hasTenantSessionCookie,
    authOk: inspection.authOk,
    authFailureReason: inspection.authOk ? null : inspection.failureReason,
    now: new Date().toISOString(),
  })
}
