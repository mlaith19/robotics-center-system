import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const { id } = await params
  const rows = await sql`
    SELECT c.id, c.name, c.subdomain, c.status, c.tenant_db_url, c.admin_username,
           c.created_at, c.updated_at,
           array_agg(DISTINCT d.host) FILTER (WHERE d.host IS NOT NULL) AS domains,
           s.plan_id, s.is_trial, s.start_date, s.end_date,
           p.name AS plan_name
    FROM centers c
    LEFT JOIN domains d ON d.center_id = c.id
    LEFT JOIN LATERAL (
      SELECT plan_id, is_trial, start_date, end_date
      FROM subscriptions
      WHERE center_id = c.id
        AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 1
    ) s ON true
    LEFT JOIN plans p ON p.id = s.plan_id
    WHERE c.id = ${id}
    GROUP BY c.id, s.plan_id, s.is_trial, s.start_date, s.end_date, p.name
    LIMIT 1
  `
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const { id } = await params
  const body = await req.json() as {
    name?: string
    status?: string
    planId?: string
  }
  const updates: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (body.name) { updates.push(`name = $${idx++}`); values.push(body.name) }
  if (body.status) { updates.push(`status = $${idx++}`); values.push(body.status) }
  updates.push(`updated_at = now()`)

  if (updates.length === 1) {
    // only updated_at
  }

  values.push(id)
  await sql.unsafe(
    `UPDATE centers SET ${updates.join(", ")} WHERE id = $${idx}`,
    values
  )

  if (body.planId) {
    // Upsert subscription
    const subId = crypto.randomUUID()
    const startDate = new Date().toISOString().slice(0, 10)
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await sql`
      INSERT INTO subscriptions (id, center_id, plan_id, start_date, end_date, is_trial, created_at)
      VALUES (${subId}, ${id}, ${body.planId}, ${startDate}, ${endDate}, false, now())
    `
  }

  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'center_updated',
            ${JSON.stringify({ centerId: id, changes: body })}::jsonb, now())
  `

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  // Only OWNER can permanently delete a center
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only OWNER can delete centers" }, { status: 403 })
  }

  const { id } = await params

  const centerRows = await sql`SELECT id, name, subdomain FROM centers WHERE id = ${id} LIMIT 1`
  if (!centerRows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const center = centerRows[0] as { id: string; name: string; subdomain: string }

  // Manually remove rows that lack ON DELETE CASCADE before deleting the center
  await sql`DELETE FROM subscription_change_history WHERE center_id = ${id}`
  await sql`DELETE FROM notification_logs WHERE center_id = ${id}`
  await sql`UPDATE license_activations SET center_id = NULL WHERE center_id = ${id}`
  await sql`UPDATE license_keys SET center_id = NULL WHERE center_id = ${id}`

  // Delete the center — CASCADE will remove: domains, subscriptions, center_feature_overrides
  await sql`DELETE FROM centers WHERE id = ${id}`

  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'center_deleted',
            ${JSON.stringify({ centerId: id, name: center.name, subdomain: center.subdomain })}::jsonb, now())
  `

  return NextResponse.json({ ok: true })
}
