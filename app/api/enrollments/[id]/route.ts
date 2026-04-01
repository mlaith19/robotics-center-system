import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { ensureCampTables, isCampCourseType } from "@/lib/camp-kaytana"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withTenantAuth(async (req, _session, { params }: Ctx) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const { id } = await params
    const result = await db`
      SELECT e.*, s.name as "studentName", c.name as "courseName"
      FROM "Enrollment" e
      LEFT JOIN "Student" s ON e."studentId" = s.id
      LEFT JOIN "Course"  c ON e."courseId"  = c.id
      WHERE e.id = ${id}
    `
    if (result.length === 0) return Response.json({ error: "Enrollment not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("GET /api/enrollments/[id] error:", err)
    return Response.json({ error: "Failed to load enrollment" }, { status: 500 })
  }
})

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const { id } = await params
    const body   = await req.json()
    const { sessionsLeft, status, campGroupId } = body

    if (campGroupId !== undefined) {
      const denied = requirePerm(session, "courses.edit")
      if (denied) return denied
      await ensureCampTables(db)
      const groupVal =
        campGroupId === null || campGroupId === ""
          ? null
          : String(campGroupId).trim()
      const enr =
        (await db`
          SELECT e.id, e."courseId", c."courseType" as "courseType"
          FROM "Enrollment" e
          JOIN "Course" c ON e."courseId" = c.id
          WHERE e.id = ${id}
        `) || []
      if (enr.length === 0) return Response.json({ error: "Enrollment not found" }, { status: 404 })
      const courseType = String((enr[0] as { courseType?: string }).courseType || "")
      if (!isCampCourseType(courseType)) {
        return Response.json({ error: "Course is not camp type", code: "not_camp" }, { status: 400 })
      }
      const courseId = String((enr[0] as { courseId: string }).courseId)
      if (groupVal) {
        const g =
          (await db`
            SELECT id FROM "CampGroup" WHERE id = ${groupVal} AND "courseId" = ${courseId}
          `) || []
        if (g.length === 0) return Response.json({ error: "Invalid camp group for course" }, { status: 400 })
      }
      const result =
        await db`
          UPDATE "Enrollment" SET "campGroupId" = ${groupVal} WHERE id = ${id} RETURNING *
        `
      return Response.json(result[0])
    }

    if (sessionsLeft !== undefined) {
      const result = await db`UPDATE "Enrollment" SET "sessionsLeft" = ${sessionsLeft} WHERE id = ${id} RETURNING *`
      return Response.json(result[0])
    }
    if (status !== undefined) {
      const result = await db`UPDATE "Enrollment" SET status = ${status} WHERE id = ${id} RETURNING *`
      return Response.json(result[0])
    }
    return Response.json({ error: "No valid fields to update" }, { status: 400 })
  } catch (err) {
    console.error("PUT /api/enrollments/[id] error:", err)
    return Response.json({ error: "Failed to update enrollment" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, _session, { params }: Ctx) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const { id } = await params
    await db`DELETE FROM "Enrollment" WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/enrollments/[id] error:", err)
    return Response.json({ error: "Failed to delete enrollment" }, { status: 500 })
  }
})
