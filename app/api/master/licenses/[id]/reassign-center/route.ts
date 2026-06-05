import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes
  const { id } = await params

  const body = await req.json() as { centerId?: string }
  if (!body.centerId) return NextResponse.json({ error: "centerId is required" }, { status: 400 })

  const rows = await sql`SELECT id, status, center_id FROM license_keys WHERE id = ${id} LIMIT 1` as { id: string; status: string; center_id: string | null }[]
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (rows[0].status !== "active") {
    return NextResponse.json({ error: "Only active licenses can be reassigned" }, { status: 409 })
  }

  await sql`UPDATE license_keys SET center_id = ${body.centerId} WHERE id = ${id}`
  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'license_reassigned',
            ${JSON.stringify({ licenseId: id, fromCenter: rows[0].center_id, toCenter: body.centerId })}::jsonb, now())
  `
  return NextResponse.json({ ok: true })
}
