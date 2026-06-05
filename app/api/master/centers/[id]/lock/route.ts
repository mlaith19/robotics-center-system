import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes
  const { id } = await params
  await sql`UPDATE centers SET status = 'locked', updated_at = now() WHERE id = ${id}`
  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'center_locked',
            ${JSON.stringify({ centerId: id })}::jsonb, now())
  `
  return NextResponse.json({ ok: true })
}
