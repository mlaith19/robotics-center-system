import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"

export async function GET(req: NextRequest) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const { searchParams } = req.nextUrl
  const q = searchParams.get("q") ?? ""
  const status = searchParams.get("status") ?? ""
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")))
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (q) {
    params.push(`%${q}%`)
    conditions.push(`(p.name ILIKE $${idx} OR c.name ILIKE $${idx})`)
    idx++
  }
  if (status) {
    params.push(status)
    conditions.push(`lk.status = $${idx}`)
    idx++
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const [rows, countRows] = await Promise.all([
    sql.unsafe(
      `SELECT lk.id, lk.status, lk.duration_days, lk.max_activations,
              lk.created_at, lk.center_id,
              c.name AS center_name,
              p.id AS plan_id, p.name AS plan_name
       FROM license_keys lk
       LEFT JOIN centers c ON c.id = lk.center_id
       LEFT JOIN plans p ON p.id = lk.plan_id
       ${whereClause}
       ORDER BY lk.created_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    ),
    sql.unsafe(
      `SELECT count(*)::int AS total
       FROM license_keys lk
       LEFT JOIN centers c ON c.id = lk.center_id
       LEFT JOIN plans p ON p.id = lk.plan_id
       ${whereClause}`,
      params
    ),
  ])

  return NextResponse.json({
    data: rows,
    total: (countRows[0] as { total: number }).total,
    page,
    pageSize,
  })
}

export async function POST(req: NextRequest) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const body = await req.json() as {
    planId?: string
    durationDays?: number
    maxActivations?: number
    centerId?: string
  }

  if (!body.planId || !body.durationDays) {
    return NextResponse.json({ error: "planId and durationDays are required" }, { status: 400 })
  }

  // Generate raw key (shown ONCE), store only its hash
  const rawKey = crypto.randomBytes(20).toString("hex")
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
  const id = crypto.randomUUID()

  await sql`
    INSERT INTO license_keys (id, key_hash, plan_id, duration_days, max_activations, status, center_id, created_at)
    VALUES (${id}, ${keyHash}, ${body.planId}, ${body.durationDays},
            ${body.maxActivations ?? 1}, 'active', ${body.centerId ?? null}, now())
  `

  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'license_created',
            ${JSON.stringify({ licenseId: id, planId: body.planId })}::jsonb, now())
  `

  // Return raw key once — never stored in plaintext
  return NextResponse.json({ id, rawKey }, { status: 201 })
}
