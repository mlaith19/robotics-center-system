import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { sessionRolesGrantFullAccess } from "@/lib/permissions"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { ensureCourseSessionTables } from "@/lib/course-session-feedback"

type Ctx = { params: Promise<{ id: string }> }

async function getTeacherIdForUser(db: any, userId: string) {
  const rows = await db`SELECT id FROM "Teacher" WHERE "userId" = ${userId} LIMIT 1`
  return rows.length > 0 ? String(rows[0].id) : null
}

export const POST = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  await ensureCourseSessionTables(db as any)
  const { id } = await params

  const body = await req.json()
  const feedbacks = Array.isArray(body.feedbacks) ? body.feedbacks : []

  const sessionRows = await db`SELECT * FROM "CourseSession" WHERE id = ${id} LIMIT 1`
  if (sessionRows.length === 0) return Response.json({ error: "Session not found" }, { status: 404 })
  const sessionRow = sessionRows[0] as any
  const isAdmin = sessionRolesGrantFullAccess(session.roleKey, session.role)
  if (!isAdmin) {
    const teacherId = await getTeacherIdForUser(db, session.id)
    if (!teacherId || String(sessionRow.teacherId || "") !== teacherId) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const now = new Date().toISOString()
  for (const item of feedbacks) {
    const studentId = String(item?.studentId || "").trim()
    const feedbackText = typeof item?.feedbackText === "string" ? item.feedbackText.trim() : ""
    if (!studentId) continue
    const existing = await db`
      SELECT id FROM "CourseSessionFeedback"
      WHERE "sessionId" = ${id} AND "studentId" = ${studentId}
      LIMIT 1
    `
    if (existing.length > 0) {
      await db`
        UPDATE "CourseSessionFeedback"
        SET "feedbackText" = ${feedbackText || null}, "updatedAt" = ${now}, "createdByUserId" = ${session.id}
        WHERE id = ${existing[0].id}
      `
    } else {
      const fid = crypto.randomUUID()
      await db`
        INSERT INTO "CourseSessionFeedback" (id, "sessionId", "studentId", "feedbackText", "createdByUserId", "createdAt", "updatedAt")
        VALUES (${fid}, ${id}, ${studentId}, ${feedbackText || null}, ${session.id}, ${now}, ${now})
      `
    }
  }

  return Response.json({ ok: true })
})

