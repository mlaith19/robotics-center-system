import { randomUUID } from "crypto"
import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { campCourseTabCan, hasFullAccessRole, hasPermission } from "@/lib/permissions"
import { ensureCampTables, isCampCourseType, listCampSessionDates } from "@/lib/camp-kaytana"

type Ctx = { params: Promise<{ id: string }> }

function canEditCampStructure(session: { permissions?: string[]; roleKey?: string; role: string }): boolean {
  if (hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)) return true
  const perms = session.permissions ?? []
  if (!hasPermission(perms, "courses.edit")) return false
  return campCourseTabCan(perms, "campPlan", "edit", { isCampCourse: true })
}

export const POST = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) return featureErr
  const denied = requirePerm(session, "courses.edit")
  if (denied) return denied
  if (!canEditCampStructure(session)) {
    return Response.json({ error: "FORBIDDEN", need: "courses.tab.camp" }, { status: 403 })
  }
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id: courseId } = await params

  try {
    await ensureCampTables(db)
    const crs =
      (await db`
        SELECT id, "courseType", "startDate", "endDate", "daysOfWeek"
        FROM "Course" WHERE id = ${courseId}
      `) || []
    if (crs.length === 0) return Response.json({ error: "Course not found" }, { status: 404 })
    const row = crs[0] as {
      courseType?: string
      startDate?: string | null
      endDate?: string | null
      daysOfWeek?: string[] | unknown
    }
    if (!isCampCourseType(row.courseType)) {
      return Response.json({ error: "Not a camp course", code: "not_camp" }, { status: 400 })
    }
    const daysOfWeek = Array.isArray(row.daysOfWeek) ? (row.daysOfWeek as string[]) : []
    const dates = listCampSessionDates(row.startDate ?? undefined, row.endDate ?? undefined, daysOfWeek)
    let created = 0
    for (const sessionDate of dates) {
      const hit =
        (await db`
          SELECT id FROM "CampMeeting" WHERE "courseId" = ${courseId} AND "sessionDate" = ${sessionDate}
        `) || []
      if (hit.length) continue
      const id = randomUUID()
      await db`
        INSERT INTO "CampMeeting" (id, "courseId", "sessionDate", "sortOrder")
        VALUES (${id}, ${courseId}, ${sessionDate}, ${created + 1})
      `
      created += 1
    }
    return Response.json({ ok: true, created, dates: dates.length })
  } catch (err) {
    console.error("POST /api/courses/[id]/camp/generate-days error:", err)
    return Response.json({ error: "Failed to generate days" }, { status: 500 })
  }
})
