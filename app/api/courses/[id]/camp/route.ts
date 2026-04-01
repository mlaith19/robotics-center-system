import { randomUUID } from "crypto"
import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { hasFullAccessRole, hasPermission } from "@/lib/permissions"
import { ensureCampTables, isCampCourseType } from "@/lib/camp-kaytana"

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

    const groups =
      (await db`
        SELECT id, "courseId", label, "sortOrder"
        FROM "CampGroup"
        WHERE "courseId" = ${courseId}
        ORDER BY "sortOrder", label
      `) || []
    const rooms =
      (await db`
        SELECT r.id, r."courseId", r.label, r."teacherId", r."sortOrder", t.name as "teacherName"
        FROM "CampRoom" r
        LEFT JOIN "Teacher" t ON r."teacherId" = t.id
        WHERE r."courseId" = ${courseId}
        ORDER BY r."sortOrder", r.label
      `) || []
    const slots =
      (await db`
        SELECT id, "courseId", "sortOrder", "startTime", "endTime"
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
        roomId: string
        groupId: string
        lessonTitle: string
      }[]
    }[] = []

    for (const d of daysRows as { id: string; sessionDate: string }[]) {
      const assigns =
        (await db`
          SELECT id, "slotSortOrder", "roomId", "groupId", "lessonTitle"
          FROM "CampAssignment"
          WHERE "campDayId" = ${d.id}
          ORDER BY "slotSortOrder", "roomId"
        `) || []
      days.push({
        id: d.id,
        sessionDate: d.sessionDate,
        assignments: (assigns as { id: string; slotSortOrder: number; roomId: string; groupId: string; lessonTitle: string }[]).map(
          (a) => ({
            id: a.id,
            slotSortOrder: Number(a.slotSortOrder),
            roomId: a.roomId,
            groupId: a.groupId,
            lessonTitle: String(a.lessonTitle ?? ""),
          }),
        ),
      })
    }

    return Response.json({
      courseId,
      groups,
      rooms,
      slots: (slots as { id: string; sortOrder: number; startTime: string; endTime: string }[]).map((s) => ({
        ...s,
        sortOrder: Number(s.sortOrder),
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

    const groupsIn = Array.isArray(body.groups) ? body.groups : []
    const roomsIn = Array.isArray(body.rooms) ? body.rooms : []
    const slotsIn = Array.isArray(body.slots) ? body.slots : []
    const daysIn = Array.isArray(body.days) ? body.days : []

    await db.begin(async (sql) => {
      const gIds = groupsIn.map((g: { id?: string }) => cleanStr(g.id)).filter((x: string) => x && isUuidLike(x))
      const existingG =
        (await sql`
          SELECT id FROM "CampGroup" WHERE "courseId" = ${courseId}
        `) || []
      for (const row of existingG as { id: string }[]) {
        if (!gIds.includes(row.id)) {
          await sql`UPDATE "Enrollment" SET "campGroupId" = NULL WHERE "campGroupId" = ${row.id}`
          await sql`DELETE FROM "CampAssignment" WHERE "groupId" = ${row.id}`
          await sql`DELETE FROM "CampGroup" WHERE id = ${row.id} AND "courseId" = ${courseId}`
        }
      }
      for (const g of groupsIn) {
        const label = cleanStr((g as { label?: string }).label)
        if (!label) continue
        const sortOrder = Number((g as { sortOrder?: number }).sortOrder) || 0
        let gid = cleanStr((g as { id?: string }).id)
        if (gid && isUuidLike(gid)) {
          const hit =
            (await sql`SELECT id FROM "CampGroup" WHERE id = ${gid} AND "courseId" = ${courseId}`) || []
          if (hit.length) {
            await sql`
              UPDATE "CampGroup" SET label = ${label}, "sortOrder" = ${sortOrder}
              WHERE id = ${gid} AND "courseId" = ${courseId}
            `
            continue
          }
        }
        gid = randomUUID()
        await sql`
          INSERT INTO "CampGroup" (id, "courseId", label, "sortOrder")
          VALUES (${gid}, ${courseId}, ${label}, ${sortOrder})
        `
      }

      const rIds = roomsIn.map((r: { id?: string }) => cleanStr(r.id)).filter((x: string) => x && isUuidLike(x))
      const existingR =
        (await sql`
          SELECT id FROM "CampRoom" WHERE "courseId" = ${courseId}
        `) || []
      for (const row of existingR as { id: string }[]) {
        if (!rIds.includes(row.id)) {
          await sql`DELETE FROM "CampAssignment" WHERE "roomId" = ${row.id}`
          await sql`DELETE FROM "CampRoom" WHERE id = ${row.id} AND "courseId" = ${courseId}`
        }
      }
      for (const r of roomsIn) {
        const label = cleanStr((r as { label?: string }).label)
        if (!label) continue
        const sortOrder = Number((r as { sortOrder?: number }).sortOrder) || 0
        const teacherRaw = cleanStr((r as { teacherId?: string | null }).teacherId)
        const teacherId = teacherRaw && isUuidLike(teacherRaw) ? teacherRaw : null
        let rid = cleanStr((r as { id?: string }).id)
        if (rid && isUuidLike(rid)) {
          const hit =
            (await sql`SELECT id FROM "CampRoom" WHERE id = ${rid} AND "courseId" = ${courseId}`) || []
          if (hit.length) {
            await sql`
              UPDATE "CampRoom"
              SET label = ${label}, "teacherId" = ${teacherId}, "sortOrder" = ${sortOrder}
              WHERE id = ${rid} AND "courseId" = ${courseId}
            `
            continue
          }
        }
        rid = randomUUID()
        await sql`
          INSERT INTO "CampRoom" (id, "courseId", label, "teacherId", "sortOrder")
          VALUES (${rid}, ${courseId}, ${label}, ${teacherId}, ${sortOrder})
        `
      }

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
        let sid = cleanStr((s as { id?: string }).id)
        if (sid && isUuidLike(sid)) {
          const hit =
            (await sql`SELECT id FROM "CampSlot" WHERE id = ${sid} AND "courseId" = ${courseId}`) || []
          if (hit.length) {
            await sql`
              UPDATE "CampSlot"
              SET "sortOrder" = ${sortOrder}, "startTime" = ${startTime}, "endTime" = ${endTime}
              WHERE id = ${sid} AND "courseId" = ${courseId}
            `
            continue
          }
        }
        sid = randomUUID()
        await sql`
          INSERT INTO "CampSlot" (id, "courseId", "sortOrder", "startTime", "endTime")
          VALUES (${sid}, ${courseId}, ${sortOrder}, ${startTime}, ${endTime})
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

        await sql`DELETE FROM "CampAssignment" WHERE "campDayId" = ${dayId}`

        const assigns = Array.isArray((d as { assignments?: unknown }).assignments)
          ? (d as { assignments: unknown[] }).assignments
          : []
        for (const a of assigns) {
          const slotSortOrder = Number((a as { slotSortOrder?: number }).slotSortOrder)
          const roomId = cleanStr((a as { roomId?: string }).roomId)
          const groupId = cleanStr((a as { groupId?: string }).groupId)
          const lessonTitle = cleanStr((a as { lessonTitle?: string }).lessonTitle)
          if (!Number.isFinite(slotSortOrder) || !isUuidLike(roomId) || !isUuidLike(groupId)) continue
          const roomOk =
            (await sql`SELECT 1 FROM "CampRoom" WHERE id = ${roomId} AND "courseId" = ${courseId}`) || []
          const groupOk =
            (await sql`SELECT 1 FROM "CampGroup" WHERE id = ${groupId} AND "courseId" = ${courseId}`) || []
          if (!roomOk.length || !groupOk.length) continue
          const aid = randomUUID()
          await sql`
            INSERT INTO "CampAssignment" (id, "campDayId", "slotSortOrder", "roomId", "groupId", "lessonTitle")
            VALUES (${aid}, ${dayId}, ${slotSortOrder}, ${roomId}, ${groupId}, ${lessonTitle || ""})
          `
        }
      }
    })

    return Response.json({ ok: true })
  } catch (err) {
    console.error("PUT /api/courses/[id]/camp error:", err)
    return Response.json({ error: "Failed to save camp data" }, { status: 500 })
  }
})
