import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import { normalizeTenantDbUrl } from "@/lib/db/normalizeTenantDbUrl"
import postgres from "postgres"
import bcrypt from "bcryptjs"
import * as crypto from "crypto"

function generateTempPassword(): string {
  return crypto.randomBytes(6).toString("hex") // 12-char hex
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes
  const { id } = await params

  const rows = await sql`SELECT tenant_db_url FROM centers WHERE id = ${id} LIMIT 1` as { tenant_db_url: string }[]
  if (!rows.length) return NextResponse.json({ error: "Center not found" }, { status: 404 })
  const rawUrl = rows[0].tenant_db_url
  if (!rawUrl) return NextResponse.json({ error: "No tenant DB configured for this center" }, { status: 400 })

  const tenantDbUrl = normalizeTenantDbUrl(rawUrl)
  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const tenantSql = postgres(tenantDbUrl, { max: 1 })
  try {
    // Prefer user with admin_username from master centers table (most reliable)
    const centerAdminRows = await sql`SELECT admin_username FROM centers WHERE id = ${id} LIMIT 1` as { admin_username: string | null }[]
    const adminUsername = centerAdminRows[0]?.admin_username ?? null

    let updated: { username: string; email: string }[] = []

    if (adminUsername) {
      // Reset the specific admin user — also ensure role is set correctly
      updated = await tenantSql`
        UPDATE "User"
        SET password = ${passwordHash}, force_password_reset = true,
            role = COALESCE(NULLIF(role, ''), 'center_admin'),
            "updatedAt" = now()
        WHERE username = ${adminUsername} AND status = 'active'
        RETURNING username, email
      ` as { username: string; email: string }[]
    }

    // Fallback: first active user ordered by creation (original behavior)
    if (!updated.length) {
      updated = await tenantSql`
        UPDATE "User"
        SET password = ${passwordHash}, force_password_reset = true,
            role = COALESCE(NULLIF(role, ''), 'center_admin'),
            "updatedAt" = now()
        WHERE id = (
          SELECT id FROM "User"
          WHERE status = 'active'
          ORDER BY "createdAt" ASC
          LIMIT 1
        )
        RETURNING username, email
      ` as { username: string; email: string }[]
    }

    if (!updated.length) {
      return NextResponse.json({ error: "No admin user found in tenant DB" }, { status: 404 })
    }

    await sql`
      INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
      VALUES (${crypto.randomUUID()}, ${session.id}, 'center_admin_password_reset',
              ${JSON.stringify({ centerId: id, username: updated[0].username })}::jsonb, now())
    `

    return NextResponse.json({ tempPassword, username: updated[0].username, email: updated[0].email })
  } finally {
    await tenantSql.end()
  }
}
