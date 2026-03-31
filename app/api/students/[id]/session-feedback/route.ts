import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { sessionRolesGrantFullAccess } from "@/lib/permissions"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { ensureCourseSessionTables } from "@/lib/course-session-feedback"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "students", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  await ensureCourseSessionTables(db as any)
  const { id } = await params

  const isAdmin = sessionRolesGrantFullAccess(session.roleKey, session.role)
  if (!isAdmin) {
    const rows = await db`SELECT id FROM "Student" WHERE id = ${id} AND "userId" = ${session.id} LIMIT 1`
    if (rows.length === 0) return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const rows = await db`
    SELECT
      f.id,
      f."feedbackText",
      f."createdAt",
      s.id as "sessionId",
      s."sessionDate",
      s."generalTopic",
      c.id as "courseId",
      c.name as "courseName",
      t.name as "teacherName"
    FROM "CourseSessionFeedback" f
    INNER JOIN "CourseSession" s ON s.id = f."sessionId"
    INNER JOIN "Course" c ON c.id = s."courseId"
    LEFT JOIN "Teacher" t ON t.id = s."teacherId"
    WHERE f."studentId" = ${id}
    ORDER BY s."sessionDate" DESC, f."createdAt" DESC
  `
  return Response.json(rows)
})

