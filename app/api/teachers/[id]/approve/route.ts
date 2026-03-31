import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { getPermissionsForRole, hasFullAccessRole, hasPermission } from "@/lib/permissions"

type Ctx = { params: Promise<{ id: string }> }

export const POST = withTenantAuth(async (req, session, { params }: Ctx) => {
  const isPrivileged = hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)
  const perms = session.permissions || []
  const canApprove = isPrivileged || hasPermission(perms, "registration.view") || hasPermission(perms, "teachers.edit")
  if (!canApprove) {
    return Response.json({ error: "FORBIDDEN", need: "registration.view|teachers.edit" }, { status: 403 })
  }

  const { id } = await params
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db

  const now = new Date().toISOString()
  try {
    const existing = await db`SELECT id, "userId", status FROM "Teacher" WHERE id = ${id} LIMIT 1`
    if (!existing.length) return Response.json({ error: "Teacher not found" }, { status: 404 })

    const teacher = existing[0] as { userId?: string | null; status?: string | null }
    const nextStatus = (teacher.status || "").trim() === "מתעניין" ? "פעיל" : (teacher.status || "פעיל")

    const updatedTeacher = await db`
      UPDATE "Teacher"
      SET status = ${nextStatus}, "updatedAt" = ${now}
      WHERE id = ${id}
      RETURNING *
    `

    if (teacher.userId) {
      const defaultTeacherPerms = getPermissionsForRole("teacher")
      await db`
        UPDATE "User"
        SET status = 'active',
            role = 'teacher',
            permissions = ${JSON.stringify(defaultTeacherPerms)}::jsonb,
            "updatedAt" = ${now}
        WHERE id = ${teacher.userId}
      `
    }

    return Response.json(updatedTeacher[0] || { ok: true })
  } catch (err) {
    console.error("POST /api/teachers/[id]/approve error:", err)
    return Response.json({ error: "Failed to approve teacher" }, { status: 500 })
  }
})

