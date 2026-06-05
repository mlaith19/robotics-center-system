import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"

export async function GET(req: NextRequest) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const { searchParams } = req.nextUrl
  const action = searchParams.get("action") ?? ""
  const centerId = searchParams.get("centerId") ?? ""
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")))
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (action) {
    params.push(action)
    conditions.push(`al.action = $${idx++}`)
  }

  if (centerId) {
    params.push(centerId)
    conditions.push(`(al.details->>'centerId') = $${idx++}`)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const [rows, countRows] = await Promise.all([
    sql.unsafe(
      `SELECT al.id, al.action, al.details, al.created_at,
              mu.username AS master_username
       FROM audit_logs al
       LEFT JOIN master_users mu ON mu.id = al.master_user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    ),
    sql.unsafe(
      `SELECT count(*)::int AS total FROM audit_logs al ${whereClause}`,
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
