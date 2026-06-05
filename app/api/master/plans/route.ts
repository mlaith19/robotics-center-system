import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"

export async function GET(req: NextRequest) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const rows = await sql`
    SELECT p.id, p.name, p.monthly_price, p.created_at,
           coalesce(array_agg(pf.feature_key) FILTER (WHERE pf.feature_key IS NOT NULL), '{}') AS features
    FROM plans p
    LEFT JOIN plan_features pf ON pf.plan_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at ASC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const body = await req.json() as { name?: string; monthly_price?: number; features?: string[] }
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 })

  const id = crypto.randomUUID()
  await sql`INSERT INTO plans (id, name, monthly_price, created_at) VALUES (${id}, ${body.name}, ${body.monthly_price ?? 0}, now())`

  if (body.features?.length) {
    for (const fk of body.features) {
      await sql`INSERT INTO plan_features (plan_id, feature_key) VALUES (${id}, ${fk}) ON CONFLICT DO NOTHING`
    }
  }

  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'plan_created',
            ${JSON.stringify({ planId: id, name: body.name })}::jsonb, now())
  `

  return NextResponse.json({ id }, { status: 201 })
}
