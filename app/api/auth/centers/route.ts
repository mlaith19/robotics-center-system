/**
 * Public list of centers for the login page center selector.
 * Returns subdomain + name only (no secrets). No auth required.
 */

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    const rows = await sql`
      SELECT subdomain, name
      FROM centers
      WHERE status IN ('active', 'trial')
      ORDER BY name
    ` as { subdomain: string; name: string | null }[]
    return NextResponse.json(
      rows.map((r) => ({ subdomain: r.subdomain, name: r.name ?? r.subdomain }))
    )
  } catch (err) {
    console.error("GET /api/auth/centers error:", err)
    return NextResponse.json([], { status: 200 })
  }
}
