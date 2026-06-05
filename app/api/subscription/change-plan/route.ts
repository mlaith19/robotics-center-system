import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/auth-server"
import { withTenantAuth } from "@/lib/tenant-api-auth"

/**
 * POST /api/subscription/change-plan
 * Body: { planId: string }
 * Requires x-tenant-center-id (tenant context). In production, restrict to master admin or payment flow.
 * Downgrade does NOT delete any tenant data; only plan and features change.
 */
export const POST = withTenantAuth(async (req: NextRequest, session) => {
  const adminErr = requireAdmin(session)
  if (adminErr) return adminErr

  const centerId = req.headers.get("x-tenant-center-id")
  if (!centerId) {
    return NextResponse.json({ error: "Missing tenant context" }, { status: 400 })
  }
  let body: { planId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const newPlanId = body?.planId
  if (!newPlanId || typeof newPlanId !== "string") {
    return NextResponse.json({ error: "planId is required" }, { status: 400 })
  }

  try {
    const subs = await sql`
      SELECT id, plan_id FROM subscriptions
      WHERE center_id = ${centerId}
      ORDER BY created_at DESC
      LIMIT 1
    `
    if (subs.length === 0) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 })
    }
    const currentPlanId = (subs[0] as { plan_id: string }).plan_id
    const subId = (subs[0] as { id: string }).id
    if (currentPlanId === newPlanId) {
      return NextResponse.json({ success: true, message: "Already on this plan" })
    }

    const planCheck = await sql`SELECT id FROM plans WHERE id = ${newPlanId} LIMIT 1`
    if (planCheck.length === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 400 })
    }

    await sql`UPDATE subscriptions SET plan_id = ${newPlanId} WHERE id = ${subId}`
    const historyId = crypto.randomUUID()
    await sql`
      INSERT INTO subscription_change_history (id, center_id, from_plan_id, to_plan_id, changed_at)
      VALUES (${historyId}, ${centerId}, ${currentPlanId}, ${newPlanId}, now())
    `
    return NextResponse.json({ success: true, fromPlanId: currentPlanId, toPlanId: newPlanId })
  } catch (err) {
    console.error("change-plan error:", err)
    return NextResponse.json({ error: "Failed to change plan" }, { status: 500 })
  }
})
