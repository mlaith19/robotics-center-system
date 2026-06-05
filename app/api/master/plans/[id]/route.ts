import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes
  const { id } = await params

  const rows = await sql`
    SELECT p.id, p.name, p.monthly_price, p.created_at,
           coalesce(array_agg(pf.feature_key) FILTER (WHERE pf.feature_key IS NOT NULL), '{}') AS features
    FROM plans p
    LEFT JOIN plan_features pf ON pf.plan_id = p.id
    WHERE p.id = ${id}
    GROUP BY p.id
  `
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes
  const { id } = await params

  const body = await req.json() as { name?: string; monthly_price?: number; features?: string[] }

  if (body.name !== undefined) {
    await sql`UPDATE plans SET name = ${body.name} WHERE id = ${id}`
  }
  if (body.monthly_price !== undefined) {
    await sql`UPDATE plans SET monthly_price = ${body.monthly_price} WHERE id = ${id}`
  }
  if (body.features !== undefined) {
    await sql`DELETE FROM plan_features WHERE plan_id = ${id}`
    for (const fk of body.features) {
      await sql`INSERT INTO plan_features (plan_id, feature_key) VALUES (${id}, ${fk}) ON CONFLICT DO NOTHING`
    }
  }

  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'plan_updated',
            ${JSON.stringify({ planId: id, changes: body })}::jsonb, now())
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes
  const { id } = await params

  // Check if any centers use this plan
  const using = await sql`SELECT count(*)::int AS n FROM subscriptions WHERE plan_id = ${id}` as { n: number }[]
  if (using[0].n > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${using[0].n} subscription(s) are using this plan` },
      { status: 409 }
    )
  }

  await sql`DELETE FROM plan_features WHERE plan_id = ${id}`
  await sql`DELETE FROM plans WHERE id = ${id}`

  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'plan_deleted',
            ${JSON.stringify({ planId: id })}::jsonb, now())
  `
  return NextResponse.json({ ok: true })
}
