import { NextResponse } from "next/server"
import { resolveTenant } from "@/lib/resolve-tenant"
import { getCenterIdByHost } from "@/lib/tenant"

/**
 * GET /api/_debug/tenant
 *
 * DEV-ONLY — returns resolved tenant info for the current request.
 * Useful for verifying that tenant resolution works correctly.
 *
 * Accepts ?center=<slug> or ?centerId=<uuid> for explicit override.
 *
 * Returns:
 * {
 *   hostname,
 *   resolvedCenterId,
 *   centerSlug,
 *   centerName,
 *   source,
 *   defaultDevCenter,
 *   headers: { hasCenterId, hasMiddlewareHeader, hasTenantIdCookie }
 * }
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  const url     = new URL(req.url)
  const host    = req.headers.get("host") ?? ""
  const qs      = url.searchParams

  // Collect diagnostic headers
  const hasCenterId        = !!(qs.get("centerId") ?? qs.get("center"))
  const hasMiddlewareHeader= !!(req.headers.get("x-tenant-center-id"))
  const hasExplicitHeader  = !!(req.headers.get("x-center-id"))

  // Parse tenant-id cookie
  const rawCookies = req.headers.get("cookie") ?? ""
  const tenantIdCookie = rawCookies.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("tenant-id="))
    ?.split("=")[1] ?? null

  // Resolve host to centerId (for diagnostic)
  let hostCenterId: string | null = null
  try { hostCenterId = await getCenterIdByHost(host) } catch { /* ignore */ }

  // Attempt full tenant resolution
  let resolved = null
  let error    = null
  try {
    resolved = await resolveTenant(req)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    hostname:          host,
    defaultDevCenter:  process.env.DEFAULT_DEV_CENTER ?? null,
    resolvedCenterId:  resolved?.centerId    ?? null,
    centerSlug:        resolved?.centerSlug  ?? null,
    centerName:        resolved?.centerName  ?? null,
    tenantDbName:      resolved?.tenantDbName ?? null,
    ok:                resolved !== null,
    error:             error,
    resolution: {
      queryParam:          qs.get("centerId") ?? qs.get("center") ?? null,
      xCenterIdHeader:     req.headers.get("x-center-id")         ?? null,
      xTenantCenterHeader: req.headers.get("x-tenant-center-id")  ?? null,
      tenantIdCookie:      tenantIdCookie,
      hostResolved:        hostCenterId,
    },
    hints: resolved ? null : {
      fix1: "Pass ?center=<slug> e.g. http://localhost:3000/login?center=dem",
      fix2: "Or set DEFAULT_DEV_CENTER=dem in .env.local and ensure Docker is running",
      fix3: "Or log in first — login sets tenant-id cookie for future requests",
      fix4: "Run: node scripts/dev-check-docker.js to diagnose Docker/DB connectivity",
    },
  })
}
