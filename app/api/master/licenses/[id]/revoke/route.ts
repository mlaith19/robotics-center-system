import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes
  const { id } = await params

  const rows = await sql`SELECT id, status FROM license_keys WHERE id = ${id} LIMIT 1` as { id: string; status: string }[]
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (rows[0].status === "revoked") return NextResponse.json({ error: "Already revoked" }, { status: 409 })

  await sql`UPDATE license_keys SET status = 'revoked' WHERE id = ${id}`
  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'license_revoked',
            ${JSON.stringify({ licenseId: id })}::jsonb, now())
  `
  return NextResponse.json({ ok: true })
}
