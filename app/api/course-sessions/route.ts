import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { sessionRolesGrantFullAccess } from "@/lib/permissions"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { ensureCourseSessionTables } from "@/lib/course-session-feedback"

async function getTeacherIdForUser(db: any, userId: string) {
  const rows = await db`SELECT id FROM "Teacher" WHERE "userId" = ${userId} LIMIT 1`
  return rows.length > 0 ? String(rows[0].id) : null
}

export const GET = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { searchParams } = new URL(req.url)
  const courseId = String(searchParams.get("courseId") || "").trim()
  if (!courseId) return Response.json([])

  await ensureCourseSessionTables(db as any)

  const isAdmin = sessionRolesGrantFullAccess(session.roleKey, session.role)
  const role = (session.roleKey || session.role || "").toString().toLowerCase()
  const isStudent = role === "student"
  const isTeacher = role === "teacher"

  let viewerStudentId: string | null = null
  if (isStudent && !isAdmin) {
    const studentRows = await db`SELECT id FROM "Student" WHERE "userId" = ${session.id} LIMIT 1`
    if (studentRows.length === 0) return Response.json([])
    viewerStudentId = String(studentRows[0].id)
  }

  if (isTeacher && !isAdmin) {
    const teacherId = await getTeacherIdForUser(db, session.id)
    if (!teacherId) return Response.json([])
    const linked = await db`SELECT id FROM "Course" WHERE id = ${courseId} AND "teacherIds" @> ${db.json([teacherId])} LIMIT 1`
    if (linked.length === 0) return Response.json([])
  }

  const sessions = await db`
    SELECT s.*, t.name as "teacherName"
    FROM "CourseSession" s
    LEFT JOIN "Teacher" t ON s."teacherId" = t.id
    WHERE s."courseId" = ${courseId}
    ORDER BY s."sessionDate" DESC, s."createdAt" DESC
  ` as any[]

  if (!sessions.length) return Response.json([])

  const sessionIds = sessions.map((s) => String(s.id))
  const feedbackRows = viewerStudentId
    ? await db`
        SELECT f.*
        FROM "CourseSessionFeedback" f
        WHERE f."sessionId" = ANY(${sessionIds}) AND f."studentId" = ${viewerStudentId}
      `
    : await db`
        SELECT f.*
        FROM "CourseSessionFeedback" f
        WHERE f."sessionId" = ANY(${sessionIds})
      `

  const map = new Map<string, any[]>()
  for (const row of feedbackRows as any[]) {
    const k = String(row.sessionId)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(row)
  }

  return Response.json(
    sessions.map((s) => ({
      ...s,
      feedback: map.get(String(s.id)) || [],
    }))
  )
})

export const POST = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  await ensureCourseSessionTables(db as any)

  const body = await req.json()
  const courseId = String(body.courseId || "").trim()
  const sessionDate = String(body.sessionDate || "").trim()
  const generalTopic = typeof body.generalTopic === "string" ? body.generalTopic.trim() : null
  if (!courseId || !sessionDate) return Response.json({ error: "courseId and sessionDate are required" }, { status: 400 })

  const isAdmin = sessionRolesGrantFullAccess(session.roleKey, session.role)
  let teacherId: string | null = null
  if (!isAdmin) {
    teacherId = await getTeacherIdForUser(db, session.id)
    if (!teacherId) return Response.json({ error: "Teacher profile not found" }, { status: 403 })
    const linked = await db`SELECT id FROM "Course" WHERE id = ${courseId} AND "teacherIds" @> ${db.json([teacherId])} LIMIT 1`
    if (linked.length === 0) return Response.json({ error: "Not allowed for this course" }, { status: 403 })
  } else {
    teacherId = typeof body.teacherId === "string" ? body.teacherId : null
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const rows = await db`
    INSERT INTO "CourseSession" (id, "courseId", "teacherId", "sessionDate", "generalTopic", "createdByUserId", "createdAt", "updatedAt")
    VALUES (${id}, ${courseId}, ${teacherId}, ${sessionDate}, ${generalTopic}, ${session.id}, ${now}, ${now})
    RETURNING *
  `
  return Response.json(rows[0], { status: 201 })
})

