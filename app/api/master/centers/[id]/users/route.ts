import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import { normalizeTenantDbUrl } from "@/lib/db/normalizeTenantDbUrl"
import postgres from "postgres"

/**
 * GET /api/master/centers/:id/users
 * Returns all users from the tenant database for a given center.
 * Master-only endpoint.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const { id } = await params

  // Get tenant DB URL from master DB
  const rows = await sql`
    SELECT tenant_db_url FROM centers WHERE id = ${id} LIMIT 1
  ` as { tenant_db_url: string | null }[]

  if (!rows.length) return NextResponse.json({ error: "Center not found" }, { status: 404 })
  const rawUrl = rows[0].tenant_db_url
  if (!rawUrl) return NextResponse.json({ error: "No tenant DB configured" }, { status: 400 })

  const tenantDbUrl = normalizeTenantDbUrl(rawUrl)
  const tenantSql = postgres(tenantDbUrl, { max: 1, connect_timeout: 5 })

  try {
    const users = await tenantSql`
      SELECT
        u.id,
        u.username,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.status,
        u."force_password_reset",
        u."locked_until",
        u."createdAt",
        u."updatedAt",
        r.name  AS role_name,
        r.key   AS role_key
      FROM "User" u
      LEFT JOIN "Role" r ON u."roleId" = r.id
      ORDER BY u."createdAt" ASC
    ` as {
      id: string
      username: string
      name: string | null
      email: string | null
      phone: string | null
      role: string | null
      status: string
      force_password_reset: boolean | null
      locked_until: string | null
      createdAt: string
      updatedAt: string
      role_name: string | null
      role_key: string | null
    }[]

    return NextResponse.json({ users })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[MASTER/USERS] Failed to fetch users for center ${id}: ${msg}`)
    return NextResponse.json({ error: "Failed to connect to tenant DB", detail: msg }, { status: 503 })
  } finally {
    await tenantSql.end()
  }
}

/**
 * PATCH /api/master/centers/:id/users
 * Update a user's role in the tenant DB (from Master Portal).
 * Body: { userId, role }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const { id } = await params
  const body = await req.json().catch(() => null)
  const { userId, role } = body ?? {}

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 })
  }

  const ALLOWED_ROLES = ["center_admin", "admin", "teacher", "student", "secretary", "coordinator"]
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}` }, { status: 400 })
  }

  const rows = await sql`
    SELECT tenant_db_url FROM centers WHERE id = ${id} LIMIT 1
  ` as { tenant_db_url: string | null }[]
  if (!rows.length) return NextResponse.json({ error: "Center not found" }, { status: 404 })
  const rawUrl = rows[0].tenant_db_url
  if (!rawUrl) return NextResponse.json({ error: "No tenant DB configured" }, { status: 400 })

  const tenantDbUrl = normalizeTenantDbUrl(rawUrl)
  const tenantSql = postgres(tenantDbUrl, { max: 1, connect_timeout: 5 })

  try {
    const updated = await tenantSql`
      UPDATE "User"
      SET role = ${role}, "updatedAt" = now()
      WHERE id = ${userId}
      RETURNING id, username, role
    ` as { id: string; username: string; role: string }[]

    if (!updated.length) return NextResponse.json({ error: "User not found" }, { status: 404 })
    return NextResponse.json({ ok: true, user: updated[0] })
  } finally {
    await tenantSql.end()
  }
}
