import { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getCenterIdByHost, getTenantContext } from "@/lib/tenant"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/tenant/bootstrap
 * Returns tenant context for the request's host (subdomain resolution).
 * Frontend calls this to get centerId, plan, enabledFeatures, subscription, accessMode.
 */
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? req.headers.get("x-forwarded-host") ?? ""
  if (!host) {
    return NextResponse.json(
      { error: "Missing host header" },
      { status: 400 }
    )
  }

  const centerId = await getCenterIdByHost(host)
  if (!centerId) {
    return NextResponse.json(
      { centerId: null, plan: null, enabledFeatures: [], subscription: null, accessMode: "ACTIVATION_ONLY", tenantDbUrl: null },
      { status: 200 }
    )
  }

  const context = await getTenantContext(centerId)
  if (!context) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({
    centerId: context.centerId,
    plan: context.plan,
    enabledFeatures: context.enabledFeatures,
    subscription: context.subscription,
    accessMode: context.accessMode,
    tenantDbUrl: context.tenantDbUrl,
  })
}
