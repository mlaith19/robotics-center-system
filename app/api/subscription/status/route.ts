import { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getTenantContext } from "@/lib/tenant"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/subscription/status
 * Returns current subscription status for the tenant (allowed in ACTIVATION_ONLY mode).
 */
export async function GET(req: NextRequest) {
  const centerId = req.headers.get("x-tenant-center-id")
  if (!centerId) {
    return NextResponse.json(
      { accessMode: "ACTIVATION_ONLY", subscription: null, plan: null },
      { status: 200 }
    )
  }
  const ctx = await getTenantContext(centerId)
  if (!ctx) {
    return NextResponse.json(
      { accessMode: "ACTIVATION_ONLY", subscription: null, plan: null },
      { status: 200 }
    )
  }
  return NextResponse.json({
    accessMode: ctx.accessMode,
    subscription: ctx.subscription,
    plan: ctx.plan,
    enabledFeatures: ctx.enabledFeatures,
  })
}
