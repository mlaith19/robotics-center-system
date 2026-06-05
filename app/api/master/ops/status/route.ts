import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"

export async function GET(req: NextRequest) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  // Last run of each type
  const rows = await sql`
    SELECT DISTINCT ON (type)
      id, type, status, started_at, finished_at, details
    FROM ops_runs
    ORDER BY type, started_at DESC
  `
  return NextResponse.json(rows)
}
