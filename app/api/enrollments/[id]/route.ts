import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { ensureCampTables, HEBREW_GROUP_LETTERS, isCampCourseType } from "@/lib/camp-kaytana"

type Ctx = { params: Promise<{ id: string }> }

async function ensureEnrollmentBillingPlanColumn(db: any) {
  try {
    await db`
      ALTER TABLE "Enrollment"
      ADD COLUMN IF NOT EXISTS "billingPlanChoice" TEXT
    `
  } catch (err) {
    console.warn("[enrollments/[id]] ensure billingPlanChoice skipped:", err)
  }
}

export const GET = withTenantAuth(async (req, _session, { params }: Ctx) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    await ensureEnrollmentBillingPlanColumn(db)
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
    await ensureEnrollmentBillingPlanColumn(db)
    const { id } = await params
    const body   = await req.json()
    const { sessionsLeft, status, campGroupLabel, campGroupId, billingPlanChoice } = body

    if (campGroupLabel !== undefined || campGroupId !== undefined) {
      const denied = requirePerm(session, "courses.edit")
      if (denied) return denied
      await ensureCampTables(db)
      const raw = campGroupLabel !== undefined ? campGroupLabel : campGroupId
      const groupVal =
        raw === null || raw === ""
          ? null
          : String(raw).trim()
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
      if (groupVal && !HEBREW_GROUP_LETTERS.includes(groupVal)) {
        return Response.json({ error: "Invalid camp group label. Expected one Hebrew letter א-ת" }, { status: 400 })
      }
      const result =
        await db`
          UPDATE "Enrollment" SET "campGroupLabel" = ${groupVal}, "campGroupId" = NULL WHERE id = ${id} RETURNING *
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
    if (billingPlanChoice !== undefined) {
      const normalizedBillingPlanChoice = String(billingPlanChoice || "").trim() || null
      const result = await db`
        UPDATE "Enrollment"
        SET "billingPlanChoice" = ${normalizedBillingPlanChoice}
        WHERE id = ${id}
        RETURNING *
      `
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
