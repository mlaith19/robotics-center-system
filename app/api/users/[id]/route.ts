import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { withTenantAuth } from "@/lib/tenant-api-auth"

type Ctx = { params: Promise<{ id: string }> }

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

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const { id } = await params
  const self = session.id === id
  if (!self) {
    const permErr = requirePerm(session, "users.view")
    if (permErr) return permErr
  }

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const rows = await db`SELECT * FROM "User" WHERE id = ${id} LIMIT 1`
    if (rows.length === 0) return NextResponse.json({ error: "NOT_FOUND", reason: "user_not_found" }, { status: 404 })
    return NextResponse.json(sanitizeUser(rows[0] as Record<string, unknown>))
  } catch (err) {
    console.error("GET /api/users/[id] error:", err)
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 })
  }
})

export const PATCH = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "users.write")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const body = await req.json()
    const { id } = await params
    const now = new Date().toISOString()

    // Validate unique constraints before building the update
    if (body.email !== undefined) {
      const email = (body.email ?? "").trim() || null
      if (email) {
        const existingEmail = await db`SELECT id FROM "User" WHERE email = ${email} AND id != ${id}`
        if (existingEmail.length > 0) return NextResponse.json({ error: "האימייל כבר קיים במערכת", reason: "CONFLICT" }, { status: 409 })
      }
    }
    if (body.username !== undefined) {
      const username = (body.username ?? "").trim()
      if (!username) return NextResponse.json({ error: "שם משתמש לא יכול להיות ריק" }, { status: 400 })
      const existing = await db`SELECT id FROM "User" WHERE username = ${username} AND id != ${id}`
      if (existing.length > 0) return NextResponse.json({ error: "שם המשתמש כבר קיים במערכת", reason: "CONFLICT" }, { status: 409 })
    }

    // Build update using postgres tagged template (no db.unsafe)
    // Only fields present in body are updated; undefined fields are left untouched.
    const newName        = body.name        !== undefined ? ((body.name ?? "").trim() || null)       : undefined
    const newEmail       = body.email       !== undefined ? ((body.email ?? "").trim() || null)      : undefined
    const newUsername    = body.username    !== undefined ? (body.username ?? "").trim()              : undefined
    const newPhone       = body.phone       !== undefined ? (body.phone?.trim() || null)             : undefined
    const newStatus      = body.status      !== undefined ? (body.status || "active")                : undefined
    const newRole        = body.role        !== undefined ? body.role                                : undefined
    const newPermissions = body.permissions !== undefined
      ? JSON.stringify([...new Set(Array.isArray(body.permissions) ? body.permissions : [])])
      : undefined
    const newPassword    = (body.password != null && String(body.password).trim().length >= 4)
      ? await bcrypt.hash(String(body.password).trim(), 10)
      : undefined

    const result = await db`
      UPDATE "User" SET
        name        = CASE WHEN ${newName        !== undefined} THEN ${newName        ?? null} ELSE name        END,
        email       = CASE WHEN ${newEmail       !== undefined} THEN ${newEmail       ?? null} ELSE email       END,
        username    = CASE WHEN ${newUsername    !== undefined} THEN ${newUsername    ?? null} ELSE username    END,
        phone       = CASE WHEN ${newPhone       !== undefined} THEN ${newPhone       ?? null} ELSE phone       END,
        status      = CASE WHEN ${newStatus      !== undefined} THEN ${newStatus      ?? null} ELSE status      END,
        role        = CASE WHEN ${newRole        !== undefined} THEN ${newRole        ?? null} ELSE role        END,
        permissions = CASE WHEN ${newPermissions !== undefined} THEN ${newPermissions ?? null}::jsonb ELSE permissions END,
        password    = CASE WHEN ${newPassword    !== undefined} THEN ${newPassword    ?? null} ELSE password    END,
        "updatedAt" = ${now}
      WHERE id = ${id}
      RETURNING *
    `
    const row = Array.isArray(result) ? result[0] : result
    return NextResponse.json(sanitizeUser(row as Record<string, unknown>))
  } catch (err: unknown) {
    console.error("PATCH /api/users/[id] error:", err)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "users.write")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const { id } = await params
    const linkedStudent = await db`SELECT id FROM "Student" WHERE "userId" = ${id} LIMIT 1`
    const linkedTeacher = await db`SELECT id FROM "Teacher" WHERE "userId" = ${id} LIMIT 1`

    if (linkedStudent.length > 0) {
      const studentId = String((linkedStudent[0] as { id: string }).id)
      await db`DELETE FROM "Enrollment" WHERE "studentId" = ${studentId}`
      await db`DELETE FROM "Attendance" WHERE "studentId" = ${studentId}`
      await db`DELETE FROM "Payment" WHERE "studentId" = ${studentId}`
      await db`DELETE FROM "Student" WHERE id = ${studentId}`
    }

    if (linkedTeacher.length > 0) {
      const teacherId = String((linkedTeacher[0] as { id: string }).id)
      await db`
        UPDATE "Course" c
        SET "teacherIds" = COALESCE((
          SELECT jsonb_agg(elem)
          FROM jsonb_array_elements_text(COALESCE(c."teacherIds", '[]'::jsonb)) AS elem
          WHERE elem <> ${teacherId}
        ), '[]'::jsonb)
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(c."teacherIds", '[]'::jsonb)) AS elem
          WHERE elem = ${teacherId}
        )
      `
      await db`DELETE FROM "Attendance" WHERE "teacherId" = ${teacherId}`
      await db`DELETE FROM "Teacher" WHERE id = ${teacherId}`
    }

    await db`DELETE FROM "User" WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("DELETE /api/users/[id] error:", err)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
})
