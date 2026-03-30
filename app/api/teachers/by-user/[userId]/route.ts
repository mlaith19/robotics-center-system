import { handleDbError } from "@/lib/db"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"

type Ctx = { params: Promise<{ userId: string }> }

const PRIVILEGED = new Set(["super_admin", "center_admin", "admin", "administrator", "owner", "manager"])

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const { userId } = await params
  const role = (session.roleKey ?? session.role ?? "").toString().toLowerCase()
  if (!PRIVILEGED.has(role) && session.id !== userId) {
    return Response.json({ error: "errors.forbiddenUserData" }, { status: 403 })
  }
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    let teachers = await db`
      SELECT t.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', c.id, 'name', c.name, 'description', c.description,
            'startTime', c."startTime", 'endTime', c."endTime"
          ))
          FROM "Course" c
          WHERE c."teacherIds" IS NOT NULL AND c."teacherIds" @> jsonb_build_array(t.id)),
          '[]'
        ) as courses
      FROM "Teacher" t
      WHERE t."userId" = ${userId}
      LIMIT 1
    `
    if (teachers.length === 0) {
      const users = await db`SELECT name, email FROM "User" WHERE id = ${userId} LIMIT 1`
      const user = users[0] as { name?: string; email?: string } | undefined
      const userName = (user?.name ?? "").trim()
      const userEmail = (user?.email ?? "").trim()
      if (userName || userEmail) {
        const byNameOrEmail = await db`
          SELECT t.*,
            COALESCE(
              (SELECT json_agg(json_build_object(
                'id', c.id, 'name', c.name, 'description', c.description,
                'startTime', c."startTime", 'endTime', c."endTime"
              ))
              FROM "Course" c
              WHERE c."teacherIds" IS NOT NULL AND c."teacherIds" @> jsonb_build_array(t.id)),
              '[]'
            ) as courses
          FROM "Teacher" t
          WHERE (t."userId" IS NULL OR t."userId" = ${userId})
            AND (
              (${userName !== ""} AND TRIM(t.name) = ${userName})
              OR (${userEmail !== ""} AND t.email IS NOT NULL AND TRIM(t.email) = ${userEmail})
            )
          LIMIT 2
        `
        if (byNameOrEmail.length === 1) {
          const t = byNameOrEmail[0] as { id: string; userId?: string | null }
          await db`UPDATE "Teacher" SET "userId" = ${userId} WHERE id = ${t.id}`
          teachers = byNameOrEmail
        }
      }
    }
    if (teachers.length === 0) return Response.json({ error: "Teacher not found" }, { status: 404 })
    const teacher = teachers[0]
    const courses = teacher.courses || []
    const courseIds = courses.map((c: { id: string }) => c.id)
    return Response.json({
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      specialization: teacher.specialty,
      courseIds,
      courses,
    })
  } catch (error) {
    return handleDbError(error, "GET /api/teachers/by-user/[userId]")
  }
})
