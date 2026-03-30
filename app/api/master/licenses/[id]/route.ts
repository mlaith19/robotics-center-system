import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"

/** GET /api/master/licenses/:id — צפייה ברישיון בודד */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const { id } = await params

  const rows = await sql`
    SELECT lk.id, lk.status, lk.duration_days, lk.max_activations,
           lk.created_at, lk.center_id,
           c.name AS center_name, c.subdomain AS center_subdomain,
           p.id AS plan_id, p.name AS plan_name
    FROM license_keys lk
    LEFT JOIN centers c ON c.id = lk.center_id
    LEFT JOIN plans p ON p.id = lk.plan_id
    WHERE lk.id = ${id}
    LIMIT 1
  ` as {
    id: string
    status: string
    duration_days: number
    max_activations: number
    created_at: string
    center_id: string | null
    center_name: string | null
    center_subdomain: string | null
    plan_id: string
    plan_name: string
  }[]

  if (!rows.length) return NextResponse.json({ error: "רישיון לא נמצא" }, { status: 404 })
  const row = rows[0]
  return NextResponse.json({
    id: row.id,
    status: row.status,
    duration_days: row.duration_days,
    max_activations: row.max_activations,
    created_at: row.created_at,
    center_id: row.center_id,
    center_name: row.center_name,
    center_subdomain: row.center_subdomain,
    plan_id: row.plan_id,
    plan_name: row.plan_name,
  })
}

/** PATCH /api/master/licenses/:id — עריכת רישיון (מרכז, ימים, מקס הפעלות) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const { id } = await params
  const body = await req.json() as {
    center_id?: string | null
    duration_days?: number
    max_activations?: number
  }

  const rows = await sql`SELECT id, status, center_id FROM license_keys WHERE id = ${id} LIMIT 1` as { id: string; status: string; center_id: string | null }[]
  if (!rows.length) return NextResponse.json({ error: "רישיון לא נמצא" }, { status: 404 })
  if (rows[0].status !== "active") {
    return NextResponse.json({ error: "ניתן לערוך רק רישיון פעיל" }, { status: 409 })
  }

  const updates: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (body.center_id !== undefined) {
    values.push(body.center_id || null)
    updates.push(`center_id = $${idx++}`)
  }
  if (typeof body.duration_days === "number" && body.duration_days > 0) {
    values.push(body.duration_days)
    updates.push(`duration_days = $${idx++}`)
  }
  if (typeof body.max_activations === "number" && body.max_activations >= 0) {
    values.push(body.max_activations)
    updates.push(`max_activations = $${idx++}`)
  }

  if (updates.length === 0) return NextResponse.json({ error: "אין שינויים לעדכון" }, { status: 400 })

  values.push(id)
  const setClause = updates.join(", ")
  await sql.unsafe(
    `UPDATE license_keys SET ${setClause} WHERE id = $${idx}`,
    values
  )

  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'license_updated',
            ${JSON.stringify({ licenseId: id, updates: body })}::jsonb, now())
  `

  return NextResponse.json({ ok: true })
}
