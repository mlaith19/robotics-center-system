import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import { provisionCenter } from "@/lib/master-provision"
import * as crypto from "crypto"

export async function GET(req: NextRequest) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const { searchParams } = req.nextUrl
  const q = searchParams.get("q") ?? ""
  const status = searchParams.get("status") ?? ""
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")))
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (q) {
    params.push(`%${q}%`)
    conditions.push(`(c.name ILIKE $${paramIndex} OR c.subdomain ILIKE $${paramIndex})`)
    paramIndex++
  }
  if (status) {
    params.push(status)
    conditions.push(`c.status = $${paramIndex}`)
    paramIndex++
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const [rows, countRows] = await Promise.all([
    sql.unsafe(
      `SELECT c.id, c.name, c.subdomain, c.status, c.created_at,
              s.plan_id, s.is_trial, s.end_date,
              p.name AS plan_name
       FROM centers c
       LEFT JOIN LATERAL (
         SELECT plan_id, is_trial, end_date
         FROM subscriptions
         WHERE center_id = c.id
           AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
         ORDER BY created_at DESC
         LIMIT 1
       ) s ON true
       LEFT JOIN plans p ON p.id = s.plan_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    ),
    sql.unsafe(
      `SELECT count(*)::int AS total FROM centers c ${whereClause}`,
      params
    ),
  ])

  void session // used for guard only
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

  try {
    const body = await req.json() as {
      name?: string
      subdomain?: string
      tenantDbMode?: "existingUrl" | "autoCreate"
      tenantDbUrl?: string
      adminEmail?: string
      tempPassword?: string
      planId?: string
    }

    const { name, subdomain, tenantDbMode, tenantDbUrl, adminEmail, tempPassword, planId } = body

    if (!name || !subdomain || !adminEmail || !tempPassword) {
      return NextResponse.json({ error: "name, subdomain, adminEmail, tempPassword are required" }, { status: 400 })
    }
    if (tenantDbMode !== "existingUrl" && tenantDbMode !== "autoCreate") {
      return NextResponse.json({ error: "tenantDbMode must be 'existingUrl' or 'autoCreate'" }, { status: 400 })
    }
    if (tenantDbMode === "existingUrl" && !tenantDbUrl) {
      return NextResponse.json({ error: "tenantDbUrl is required for existingUrl mode" }, { status: 400 })
    }

    const result = await provisionCenter({
      name,
      subdomain,
      tenantDbUrl: tenantDbMode === "existingUrl" ? tenantDbUrl : undefined,
      autoCreate: tenantDbMode === "autoCreate",
      adminEmail,
      tempPassword,
      planId,
      masterUserId: session.id,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error("master/centers POST error:", err)
    const msg = err instanceof Error ? err.message : "Server error"
    if (msg.includes("Invalid subdomain")) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    if (msg.includes("tenantDbUrl is required")) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
