import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"

function sanitizeUser(u: Record<string, unknown>): Record<string, unknown> {
  const out = { ...u }
  delete out.password
  if (out.permissions === null || out.permissions === undefined) {
    out.permissions = []
  } else if (!Array.isArray(out.permissions)) {
    try {
      out.permissions = typeof out.permissions === "string" ? JSON.parse(out.permissions as string) : []
    } catch {
      out.permissions = []
    }
  }
  return out
}

export const GET = withTenantAuth(async (req, session) => {
  const permErr = requirePerm(session, "users.view")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") ?? ""
    const status = searchParams.get("status") ?? ""
    const search = q ? `%${q}%` : ""

    const users = await db`
      SELECT * FROM "User"
      WHERE 1=1
      ${status ? db`AND status = ${status}` : db``}
      ${q ? db`AND (name ILIKE ${search} OR email ILIKE ${search} OR phone ILIKE ${search} OR username ILIKE ${search})` : db``}
      ORDER BY "createdAt" DESC
    `
    const list = Array.isArray(users) ? users : []
    return NextResponse.json(list.map((u: Record<string, unknown>) => sanitizeUser(u)))
  } catch (err) {
    console.error("GET /api/users error:", err)
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const permErr = requirePerm(session, "users.write")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const body = await req.json()
    if (!body.name || !body.email) return NextResponse.json({ error: "name and email are required" }, { status: 400 })
    if (!body.username || !body.password) return NextResponse.json({ error: "username and password are required" }, { status: 400 })

    const perms = Array.isArray(body.permissions) ? [...new Set(body.permissions)] : []
    const roleKey = (body.role ?? "other").toString().toLowerCase()
    const role = body.role ?? "other"

    const existingUser = await db`SELECT id FROM "User" WHERE username = ${body.username.trim()}`
    if (existingUser.length > 0) return NextResponse.json({ error: "Username already exists", reason: "USERNAME_EXISTS" }, { status: 409 })

    const hashedPassword = await bcrypt.hash(body.password, 10)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const result = await db`
      INSERT INTO "User" (id, name, email, username, password, phone, status, role, permissions, "force_password_reset", "createdAt", "updatedAt")
      VALUES (
        ${id}, ${body.name.trim()}, ${body.email.trim()}, ${body.username.trim()},
        ${hashedPassword}, ${body.phone?.trim() || null},
        ${body.status || "active"}, ${role},
        ${JSON.stringify(perms)}, false,
        ${now}, ${now}
      )
      RETURNING *
    `
    const row = Array.isArray(result) ? result[0] : result
    const out = sanitizeUser(row as Record<string, unknown>)
    if (!("roleKey" in out)) (out as Record<string, unknown>).roleKey = roleKey
    return NextResponse.json(out, { status: 201 })
  } catch (err: unknown) {
    console.error("POST /api/users error:", err)
    const code = (err as { code?: string })?.code
    if (code === "23505") return NextResponse.json({ error: "Email or username already exists", reason: "CONFLICT" }, { status: 409 })
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
})
