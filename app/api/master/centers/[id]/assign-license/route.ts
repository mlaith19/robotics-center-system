import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const { id } = await params
  const body = await req.json() as { planId?: string; months?: number }

  const { planId, months } = body
  if (!planId) return NextResponse.json({ error: "planId is required" }, { status: 400 })
  if (!months || ![1, 3, 6, 9, 12].includes(months)) {
    return NextResponse.json({ error: "months must be one of: 1, 3, 6, 9, 12" }, { status: 400 })
  }

  // Verify center exists
  const centerRows = await sql`SELECT id, name FROM centers WHERE id = ${id} LIMIT 1`
  if (!centerRows.length) return NextResponse.json({ error: "Center not found" }, { status: 404 })

  // Verify plan exists
  const planRows = await sql`SELECT id, name FROM plans WHERE id = ${planId} LIMIT 1`
  if (!planRows.length) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const startDate = new Date().toISOString().slice(0, 10)
  const endDate = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    return d.toISOString().slice(0, 10)
  })()

  const subId = crypto.randomUUID()

  // Insert new subscription (overlapping is allowed — latest one is used)
  await sql`
    INSERT INTO subscriptions (id, center_id, plan_id, start_date, end_date, is_trial, created_at)
    VALUES (${subId}, ${id}, ${planId}, ${startDate}, ${endDate}, false, now())
  `

  const center = centerRows[0] as { name: string }
  const plan = planRows[0] as { name: string }

  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (
      ${crypto.randomUUID()}, ${session.id}, 'license_assigned',
      ${JSON.stringify({ centerId: id, centerName: center.name, planId, planName: plan.name, months, startDate, endDate })}::jsonb,
      now()
    )
  `

  return NextResponse.json({ ok: true, startDate, endDate, months, planName: plan.name })
}
