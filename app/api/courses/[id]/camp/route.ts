import { randomUUID } from "crypto"
import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { hasFullAccessRole, hasPermission } from "@/lib/permissions"
import { ensureCampTables, HEBREW_GROUP_LETTERS, isCampCourseType } from "@/lib/camp-kaytana"

type Ctx = { params: Promise<{ id: string }> }

function cleanStr(v: unknown): string {
  return String(v ?? "").trim()
}

function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

function canViewCampStructure(session: { permissions?: string[]; roleKey?: string; role: string }): boolean {
  if (hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)) return true
  const perms = session.permissions ?? []
  return hasPermission(perms, "courses.view") && hasPermission(perms, "courses.tab.camp")
}

function canEditCampStructure(session: { permissions?: string[]; roleKey?: string; role: string }): boolean {
  if (hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)) return true
  const perms = session.permissions ?? []
  return hasPermission(perms, "courses.edit") && hasPermission(perms, "courses.tab.camp")
}

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) return featureErr
  if (!canViewCampStructure(session)) {
    return Response.json({ error: "FORBIDDEN", need: "courses.tab.camp" }, { status: 403 })
  }
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { id: courseId } = await params

  try {
    await ensureCampTables(db)
    const crs = await db`SELECT id, "courseType" FROM "Course" WHERE id = ${courseId}`
    if (crs.length === 0) return Response.json({ error: "Course not found" }, { status: 404 })
    const courseType = String((crs[0] as { courseType?: string }).courseType || "")
    if (!isCampCourseType(courseType)) {
      return Response.json({ error: "Not a camp course", code: "not_camp" }, { status: 400 })
    }

    const settings = (await db`SELECT camp_classrooms_count FROM center_settings WHERE id = 1`) || []
    const classroomsCount = Math.max(1, Math.min(12, Number((settings[0] as { camp_classrooms_count?: number } | undefined)?.camp_classrooms_count || 6)))
    const teachers =
      (await db`
        SELECT id, name FROM "Teacher"
        ORDER BY name
      `) || []
    const slots =
      (await db`
        SELECT id, "courseId", "sortOrder", "startTime", "endTime", "isBreak", "breakTitle"
        FROM "CampSlot"
        WHERE "courseId" = ${courseId}
        ORDER BY "sortOrder", "startTime"
      `) || []
    const daysRows =
      (await db`
        SELECT id, "courseId", "sessionDate"
        FROM "CampDay"
        WHERE "courseId" = ${courseId}
        ORDER BY "sessionDate"
      `) || []

    const days: {
      id: string
      sessionDate: string
      assignments: {
        id: string
        slotSortOrder: number
        classroomNo: number
        lessonTitle: string
        groupLabels: string[]
        teacherIds: string[]
      }[]
    }[] = []

    for (const d of daysRows as { id: string; sessionDate: string }[]) {
      const assignsRows =
        (await db`
          SELECT id, "slotSortOrder", "classroomNo", "lessonTitle"
          FROM "CampClassAssignment"
          WHERE "campDayId" = ${d.id}
          ORDER BY "slotSortOrder", "classroomNo"
        `) || []
      const assigns: {
        id: string
        slotSortOrder: number
        classroomNo: number
        lessonTitle: string
        groupLabels: string[]
        teacherIds: string[]
      }[] = []
      for (const a of assignsRows as { id: string; slotSortOrder: number; classroomNo: number; lessonTitle: string }[]) {
        const groupsRows =
          (await db`SELECT "groupLabel" FROM "CampClassAssignmentGroup" WHERE "assignmentId" = ${a.id} ORDER BY "groupLabel"`) || []
        const teacherRows =
          (await db`SELECT "teacherId" FROM "CampClassAssignmentTeacher" WHERE "assignmentId" = ${a.id}`) || []
        assigns.push({
          id: a.id,
          slotSortOrder: Number(a.slotSortOrder),
          classroomNo: Number(a.classroomNo),
          lessonTitle: String(a.lessonTitle || ""),
          groupLabels: (groupsRows as { groupLabel: string }[]).map((x) => String(x.groupLabel)),
          teacherIds: (teacherRows as { teacherId: string }[]).map((x) => String(x.teacherId)),
        })
      }
      days.push({
        id: d.id,
        sessionDate: d.sessionDate,
        assignments: assigns,
      })
    }

    return Response.json({
      courseId,
      classroomsCount,
      teachers,
      groupLetters: HEBREW_GROUP_LETTERS,
      slots: (slots as { id: string; sortOrder: number; startTime: string; endTime: string; isBreak?: boolean; breakTitle?: string }[]).map((s) => ({
        ...s,
        sortOrder: Number(s.sortOrder),
        isBreak: Boolean(s.isBreak),
        breakTitle: String(s.breakTitle || ""),
      })),
      days,
      editable: canEditCampStructure(session),
    })
  } catch (err) {
    console.error("GET /api/courses/[id]/camp error:", err)
    return Response.json({ error: "Failed to load camp data" }, { status: 500 })
  }
})

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
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
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid body" }, { status: 400 })

  try {
    await ensureCampTables(db)
    const crs = await db`SELECT id, "courseType" FROM "Course" WHERE id = ${courseId}`
    if (crs.length === 0) return Response.json({ error: "Course not found" }, { status: 404 })
    const courseType = String((crs[0] as { courseType?: string }).courseType || "")
    if (!isCampCourseType(courseType)) {
      return Response.json({ error: "Not a camp course", code: "not_camp" }, { status: 400 })
    }

    const slotsIn = Array.isArray(body.slots) ? body.slots : []
    const daysIn = Array.isArray(body.days) ? body.days : []

    await db.begin(async (sql) => {
      const sIds = slotsIn.map((s: { id?: string }) => cleanStr(s.id)).filter((x: string) => x && isUuidLike(x))
      const existingS =
        (await sql`
          SELECT id FROM "CampSlot" WHERE "courseId" = ${courseId}
        `) || []
      for (const row of existingS as { id: string }[]) {
        if (!sIds.includes(row.id)) {
          await sql`DELETE FROM "CampSlot" WHERE id = ${row.id} AND "courseId" = ${courseId}`
        }
      }
      for (const s of slotsIn) {
        const startTime = cleanStr((s as { startTime?: string }).startTime)
        const endTime = cleanStr((s as { endTime?: string }).endTime)
        if (!startTime || !endTime) continue
        const sortOrder = Number((s as { sortOrder?: number }).sortOrder) || 0
        const isBreak = Boolean((s as { isBreak?: boolean }).isBreak)
        const breakTitle = cleanStr((s as { breakTitle?: string }).breakTitle)
        let sid = cleanStr((s as { id?: string }).id)
        if (sid && isUuidLike(sid)) {
          const hit =
            (await sql`SELECT id FROM "CampSlot" WHERE id = ${sid} AND "courseId" = ${courseId}`) || []
          if (hit.length) {
            await sql`
              UPDATE "CampSlot"
              SET "sortOrder" = ${sortOrder}, "startTime" = ${startTime}, "endTime" = ${endTime}, "isBreak" = ${isBreak}, "breakTitle" = ${breakTitle}
              WHERE id = ${sid} AND "courseId" = ${courseId}
            `
            continue
          }
        }
        sid = randomUUID()
        await sql`
          INSERT INTO "CampSlot" (id, "courseId", "sortOrder", "startTime", "endTime", "isBreak", "breakTitle")
          VALUES (${sid}, ${courseId}, ${sortOrder}, ${startTime}, ${endTime}, ${isBreak}, ${breakTitle})
        `
      }

      const dIds = daysIn.map((d: { id?: string }) => cleanStr(d.id)).filter((x: string) => x && isUuidLike(x))
      const existingD =
        (await sql`
          SELECT id FROM "CampDay" WHERE "courseId" = ${courseId}
        `) || []
      for (const row of existingD as { id: string }[]) {
        if (!dIds.includes(row.id)) {
          await sql`DELETE FROM "CampDay" WHERE id = ${row.id} AND "courseId" = ${courseId}`
        }
      }

      for (const d of daysIn) {
        const sessionDate = cleanStr((d as { sessionDate?: string }).sessionDate)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) continue
        let dayId = cleanStr((d as { id?: string }).id)
        if (dayId && isUuidLike(dayId)) {
          const hit =
            (await sql`SELECT id FROM "CampDay" WHERE id = ${dayId} AND "courseId" = ${courseId}`) || []
          if (!hit.length) dayId = ""
        } else dayId = ""

        if (!dayId) {
          const byDate =
            (await sql`
              SELECT id FROM "CampDay" WHERE "courseId" = ${courseId} AND "sessionDate" = ${sessionDate}
            `) || []
          if (byDate.length) {
            dayId = (byDate[0] as { id: string }).id
          } else {
            dayId = randomUUID()
            await sql`
              INSERT INTO "CampDay" (id, "courseId", "sessionDate")
              VALUES (${dayId}, ${courseId}, ${sessionDate})
            `
          }
        } else {
          await sql`
            UPDATE "CampDay" SET "sessionDate" = ${sessionDate}
            WHERE id = ${dayId} AND "courseId" = ${courseId}
          `
        }

        const oldAssign = (await sql`SELECT id FROM "CampClassAssignment" WHERE "campDayId" = ${dayId}`) || []
        for (const a of oldAssign as { id: string }[]) {
          await sql`DELETE FROM "CampClassAssignmentGroup" WHERE "assignmentId" = ${a.id}`
          await sql`DELETE FROM "CampClassAssignmentTeacher" WHERE "assignmentId" = ${a.id}`
        }
        await sql`DELETE FROM "CampClassAssignment" WHERE "campDayId" = ${dayId}`

        const assigns = Array.isArray((d as { assignments?: unknown }).assignments)
          ? (d as { assignments: unknown[] }).assignments
          : []
        for (const a of assigns) {
          const slotSortOrder = Number((a as { slotSortOrder?: number }).slotSortOrder)
          const classroomNo = Number((a as { classroomNo?: number }).classroomNo)
          const groupLabels = Array.isArray((a as { groupLabels?: unknown[] }).groupLabels)
            ? (a as { groupLabels: unknown[] }).groupLabels.map((g) => String(g || "").trim()).filter((g) => HEBREW_GROUP_LETTERS.includes(g))
            : []
          const teacherIds = Array.isArray((a as { teacherIds?: unknown[] }).teacherIds)
            ? (a as { teacherIds: unknown[] }).teacherIds.map((t) => String(t || "").trim()).filter((t) => isUuidLike(t))
            : []
          const lessonTitle = cleanStr((a as { lessonTitle?: string }).lessonTitle)
          if (!Number.isFinite(slotSortOrder) || !Number.isFinite(classroomNo) || classroomNo <= 0) continue
          const aid = randomUUID()
          await sql`
            INSERT INTO "CampClassAssignment" (id, "campDayId", "slotSortOrder", "classroomNo", "lessonTitle")
            VALUES (${aid}, ${dayId}, ${slotSortOrder}, ${classroomNo}, ${lessonTitle || ""})
          `
          for (const g of [...new Set(groupLabels)]) {
            await sql`
              INSERT INTO "CampClassAssignmentGroup" (id, "assignmentId", "groupLabel")
              VALUES (${randomUUID()}, ${aid}, ${g})
            `
          }
          for (const t of [...new Set(teacherIds)]) {
            const ok = (await sql`SELECT 1 FROM "Teacher" WHERE id = ${t}`) || []
            if (!ok.length) continue
            await sql`
              INSERT INTO "CampClassAssignmentTeacher" (id, "assignmentId", "teacherId")
              VALUES (${randomUUID()}, ${aid}, ${t})
            `
          }
        }
      }
    })

    return Response.json({ ok: true })
  } catch (err) {
    console.error("PUT /api/courses/[id]/camp error:", err)
    return Response.json({ error: "Failed to save camp data" }, { status: 500 })
  }
})
