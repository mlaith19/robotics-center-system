import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"

type Ctx = { params: Promise<{ id: string }> }

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((v) => String(v))
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : []
    } catch {
      return []
    }
  }
  return []
}

export const POST = withTenantAuth(async (req, _session, { params }: Ctx) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id: studentId } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const requestedCourseId = typeof body.courseId === "string" ? body.courseId : null

    const studentRows = await db`SELECT id, status, "courseIds" FROM "Student" WHERE id = ${studentId} LIMIT 1`
    if (studentRows.length === 0) {
      return Response.json({ error: "Student not found" }, { status: 404 })
    }

    const student = studentRows[0] as { courseIds?: unknown }
    const courseIds = toStringArray(student.courseIds)
    const courseId = requestedCourseId || courseIds[0] || null
    if (!courseId) {
      return Response.json({ error: "No course selected for this registration" }, { status: 400 })
    }

    const courseRows = await db`SELECT id FROM "Course" WHERE id = ${courseId} LIMIT 1`
    if (courseRows.length === 0) {
      return Response.json({ error: "Course not found" }, { status: 404 })
    }

    const existingEnrollment = await db`
      SELECT id FROM "Enrollment"
      WHERE "studentId" = ${studentId} AND "courseId" = ${courseId}
      LIMIT 1
    `

    if (existingEnrollment.length === 0) {
      const enrollmentId = crypto.randomUUID()
      const now = new Date().toISOString()
      const enrollmentDate = now.split("T")[0]
      await db`
        INSERT INTO "Enrollment" (id, "studentId", "courseId", "enrollmentDate", status, "sessionsLeft", "createdAt")
        VALUES (${enrollmentId}, ${studentId}, ${courseId}, ${enrollmentDate}, 'active', 12, ${now})
      `
    }

    const now = new Date().toISOString()
    await db`
      UPDATE "Student"
      SET status = 'פעיל', "updatedAt" = ${now}
      WHERE id = ${studentId}
    `

    return Response.json({ ok: true, studentId, courseId })
  } catch (err) {
    console.error("POST /api/students/[id]/approve error:", err)
    return Response.json({ error: "Failed to approve registration" }, { status: 500 })
  }
})

