import { handleDbError } from "@/lib/db"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"

type Ctx = { params: Promise<{ userId: string }> }

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const { userId } = await params
  if (session.roleKey !== "super_admin" && session.id !== userId) {
    return Response.json({ error: "errors.forbiddenUserData" }, { status: 403 })
  }
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  try {
    const students = await db`SELECT * FROM "Student" WHERE "userId" = ${userId}`
    if (students.length === 0) return Response.json({ error: "Student not found" }, { status: 404 })

    const student = students[0] as Record<string, unknown>
    let courseIdsRaw = student.courseIds
    if (typeof courseIdsRaw === "string") {
      try {
        courseIdsRaw = JSON.parse(courseIdsRaw as string)
      } catch {
        courseIdsRaw = []
      }
    }
    const courseIds = Array.isArray(courseIdsRaw) ? courseIdsRaw : []
    let courses: { id: string; name: string; description: string | null }[] = []
    if (courseIds.length > 0) {
      courses = await db`SELECT id, name, description FROM "Course" WHERE id = ANY(${courseIds})`
    }
    return Response.json({ ...student, courses })
  } catch (err) {
    return handleDbError(err, "GET /api/students/by-user/[userId]")
  }
})
