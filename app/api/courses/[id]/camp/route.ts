import { randomUUID } from "crypto"
import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { hasFullAccessRole, hasPermission } from "@/lib/permissions"
import { ensureCampTables, HEBREW_GROUP_LETTERS, isCampCourseType, listCampSessionDates } from "@/lib/camp-kaytana"

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
    const crs = await db`
      SELECT id, "courseType", "startDate", "endDate", "daysOfWeek", "startTime", "endTime"
      FROM "Course"
      WHERE id = ${courseId}
    `
    if (crs.length === 0) return Response.json({ error: "Course not found" }, { status: 404 })
    const courseRow = crs[0] as {
      courseType?: string
      startDate?: string | null
      endDate?: string | null
      daysOfWeek?: string[] | unknown
      startTime?: string | null
      endTime?: string | null
    }
    const courseType = String(courseRow.courseType || "")
    if (!isCampCourseType(courseType)) {
      return Response.json({ error: "Not a camp course", code: "not_camp" }, { status: 400 })
    }
    const daysOfWeek = Array.isArray(courseRow.daysOfWeek) ? (courseRow.daysOfWeek as string[]) : []
    const sessionDates = listCampSessionDates(courseRow.startDate ?? undefined, courseRow.endDate ?? undefined, daysOfWeek)
    const defaultStartTime = String(courseRow.startTime || "08:30").slice(0, 5)
    const defaultEndTime = String(courseRow.endTime || "09:15").slice(0, 5)

    for (let i = 0; i < sessionDates.length; i += 1) {
      const date = sessionDates[i]
      await db`
        INSERT INTO "CampMeeting" (id, "courseId", "sessionDate", "sortOrder")
        VALUES (${randomUUID()}, ${courseId}, ${date}, ${i + 1})
        ON CONFLICT ("courseId","sessionDate")
        DO UPDATE SET "sortOrder" = EXCLUDED."sortOrder"
      `
    }
    const existingMeetingsForCourse =
      (await db`SELECT id, "sessionDate" FROM "CampMeeting" WHERE "courseId" = ${courseId}`) || []
    const allowedDates = new Set(sessionDates)
    for (const row of existingMeetingsForCourse as { id: string; sessionDate: string }[]) {
      if (!allowedDates.has(String(row.sessionDate))) {
        await db`DELETE FROM "CampMeeting" WHERE id = ${row.id}`
      }
    }

    const settings = (await db`SELECT camp_classrooms_count, camp_classrooms FROM center_settings WHERE id = 1`) || []
    const classroomsCount = Math.max(1, Math.min(12, Number((settings[0] as { camp_classrooms_count?: number } | undefined)?.camp_classrooms_count || 6)))
    const classroomsRaw = (settings[0] as { camp_classrooms?: unknown } | undefined)?.camp_classrooms
    const classroomsConfigured = Array.isArray(classroomsRaw) ? classroomsRaw as Array<{ number?: number; name?: string; notes?: string }> : []
    const classrooms = Array.from({ length: classroomsCount }, (_, i) => {
      const n = i + 1
      const row = classroomsConfigured.find((x) => Number(x.number) === n)
      return { number: n, name: String(row?.name || `כיתה ${n}`), notes: String(row?.notes || "") }
    })
    const teachers =
      (await db`
        SELECT id, name FROM "Teacher"
        ORDER BY name
      `) || []
    const meetingsRows =
      (await db`
        SELECT id, "sessionDate", "sortOrder"
        FROM "CampMeeting"
        WHERE "courseId" = ${courseId}
        ORDER BY "sortOrder", "sessionDate"
      `) || []

    const meetings: Array<{
      id: string
      sessionDate: string
      sortOrder: number
      slots: Array<{
        id: string
        sortOrder: number
        startTime: string
        endTime: string
        isBreak: boolean
        breakTitle: string
        cells: Array<{
          id: string
          classroomNo: number
          lessonTitle: string
          groupLabels: string[]
          teacherIds: string[]
        }>
      }>
    }> = []

    for (const m of meetingsRows as { id: string; sessionDate: string; sortOrder: number }[]) {
      const slotRows =
        (await db`
          SELECT id, "sortOrder", "startTime", "endTime", "isBreak", "breakTitle"
          FROM "CampMeetingSlot"
          WHERE "meetingId" = ${m.id}
          ORDER BY "sortOrder", "startTime"
        `) || []
      if (!slotRows.length) {
        await db`
          INSERT INTO "CampMeetingSlot" (id, "meetingId", "sortOrder", "startTime", "endTime", "isBreak", "breakTitle")
          VALUES (${randomUUID()}, ${m.id}, ${1}, ${defaultStartTime}, ${defaultEndTime}, ${false}, ${""})
        `
      }
      const slots = []
      const effectiveSlotRows =
        (await db`
          SELECT id, "sortOrder", "startTime", "endTime", "isBreak", "breakTitle"
          FROM "CampMeetingSlot"
          WHERE "meetingId" = ${m.id}
          ORDER BY "sortOrder", "startTime"
        `) || []
      for (const s of effectiveSlotRows as { id: string; sortOrder: number; startTime: string; endTime: string; isBreak: boolean; breakTitle: string }[]) {
        const cellRows =
          (await db`
            SELECT id, "classroomNo", "lessonTitle"
            FROM "CampMeetingCell"
            WHERE "slotId" = ${s.id}
            ORDER BY "classroomNo"
          `) || []
        const cells = []
        for (const c of cellRows as { id: string; classroomNo: number; lessonTitle: string }[]) {
          const gRows = (await db`SELECT "groupLabel" FROM "CampMeetingCellGroup" WHERE "cellId" = ${c.id} ORDER BY "groupLabel"`) || []
          const tRows = (await db`SELECT "teacherId" FROM "CampMeetingCellTeacher" WHERE "cellId" = ${c.id}`) || []
          cells.push({
            id: c.id,
            classroomNo: Number(c.classroomNo),
            lessonTitle: String(c.lessonTitle || ""),
            groupLabels: (gRows as { groupLabel: string }[]).map((x) => String(x.groupLabel)),
            teacherIds: (tRows as { teacherId: string }[]).map((x) => String(x.teacherId)),
          })
        }
        slots.push({
          id: s.id,
          sortOrder: Number(s.sortOrder),
          startTime: String(s.startTime),
          endTime: String(s.endTime),
          isBreak: Boolean(s.isBreak),
          breakTitle: String(s.breakTitle || ""),
          cells,
        })
      }
      meetings.push({
        id: m.id,
        sessionDate: m.sessionDate,
        sortOrder: Number(m.sortOrder || 0),
        slots,
      })
    }

    return Response.json({
      courseId,
      classroomsCount,
      classrooms,
      teachers,
      groupLetters: HEBREW_GROUP_LETTERS,
      meetings,
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

    const meetingsIn = Array.isArray(body.meetings) ? body.meetings : []

    await db.begin(async (sql) => {
      const meetingIds = meetingsIn.map((m: { id?: string }) => cleanStr(m.id)).filter((x: string) => x && isUuidLike(x))
      const existingMeetings = (await sql`SELECT id FROM "CampMeeting" WHERE "courseId" = ${courseId}`) || []
      for (const row of existingMeetings as { id: string }[]) {
        if (!meetingIds.includes(row.id)) await sql`DELETE FROM "CampMeeting" WHERE id = ${row.id}`
      }

      for (const m of meetingsIn) {
        const sessionDate = cleanStr((m as { sessionDate?: string }).sessionDate)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) continue
        const sortOrder = Number((m as { sortOrder?: number }).sortOrder || 0)
        let meetingId = cleanStr((m as { id?: string }).id)
        if (!meetingId || !isUuidLike(meetingId)) {
          meetingId = randomUUID()
          await sql`
            INSERT INTO "CampMeeting" (id, "courseId", "sessionDate", "sortOrder")
            VALUES (${meetingId}, ${courseId}, ${sessionDate}, ${sortOrder})
            ON CONFLICT ("courseId","sessionDate") DO UPDATE SET "sortOrder" = EXCLUDED."sortOrder"
          `
          const byDate = (await sql`SELECT id FROM "CampMeeting" WHERE "courseId"=${courseId} AND "sessionDate"=${sessionDate}`) || []
          meetingId = String((byDate[0] as { id: string }).id)
        } else {
          await sql`UPDATE "CampMeeting" SET "sessionDate"=${sessionDate}, "sortOrder"=${sortOrder} WHERE id=${meetingId} AND "courseId"=${courseId}`
        }

        const oldSlots = (await sql`SELECT id FROM "CampMeetingSlot" WHERE "meetingId" = ${meetingId}`) || []
        for (const s of oldSlots as { id: string }[]) {
          const oldCells = (await sql`SELECT id FROM "CampMeetingCell" WHERE "slotId" = ${s.id}`) || []
          for (const c of oldCells as { id: string }[]) {
            await sql`DELETE FROM "CampMeetingCellGroup" WHERE "cellId" = ${c.id}`
            await sql`DELETE FROM "CampMeetingCellTeacher" WHERE "cellId" = ${c.id}`
          }
          await sql`DELETE FROM "CampMeetingCell" WHERE "slotId" = ${s.id}`
        }
        await sql`DELETE FROM "CampMeetingSlot" WHERE "meetingId" = ${meetingId}`

        const slots = Array.isArray((m as { slots?: unknown[] }).slots) ? (m as { slots: unknown[] }).slots : []
        for (const s of slots) {
          const sort = Number((s as { sortOrder?: number }).sortOrder || 0)
          const startTime = cleanStr((s as { startTime?: string }).startTime)
          const endTime = cleanStr((s as { endTime?: string }).endTime)
          const isBreak = Boolean((s as { isBreak?: boolean }).isBreak)
          const breakTitle = cleanStr((s as { breakTitle?: string }).breakTitle)
          if (!startTime || !endTime) continue
          const slotId = randomUUID()
          await sql`
            INSERT INTO "CampMeetingSlot" (id, "meetingId", "sortOrder", "startTime", "endTime", "isBreak", "breakTitle")
            VALUES (${slotId}, ${meetingId}, ${sort}, ${startTime}, ${endTime}, ${isBreak}, ${breakTitle})
          `
          const cells = Array.isArray((s as { cells?: unknown[] }).cells) ? (s as { cells: unknown[] }).cells : []
          for (const c of cells) {
            const classroomNo = Number((c as { classroomNo?: number }).classroomNo)
            if (!Number.isFinite(classroomNo) || classroomNo <= 0) continue
            const lessonTitle = cleanStr((c as { lessonTitle?: string }).lessonTitle)
            const cellId = randomUUID()
            await sql`
              INSERT INTO "CampMeetingCell" (id, "slotId", "classroomNo", "lessonTitle")
              VALUES (${cellId}, ${slotId}, ${classroomNo}, ${lessonTitle})
            `
            const groupLabels = Array.isArray((c as { groupLabels?: unknown[] }).groupLabels)
              ? (c as { groupLabels: unknown[] }).groupLabels.map((g) => String(g || "").trim()).filter((g) => HEBREW_GROUP_LETTERS.includes(g))
              : []
            for (const g of [...new Set(groupLabels)]) {
              await sql`INSERT INTO "CampMeetingCellGroup" (id, "cellId", "groupLabel") VALUES (${randomUUID()}, ${cellId}, ${g})`
            }
            const teacherIds = Array.isArray((c as { teacherIds?: unknown[] }).teacherIds)
              ? (c as { teacherIds: unknown[] }).teacherIds.map((t) => String(t || "").trim()).filter((t) => isUuidLike(t))
              : []
            for (const t of [...new Set(teacherIds)]) {
              const ok = (await sql`SELECT 1 FROM "Teacher" WHERE id = ${t}`) || []
              if (!ok.length) continue
              await sql`INSERT INTO "CampMeetingCellTeacher" (id, "cellId", "teacherId") VALUES (${randomUUID()}, ${cellId}, ${t})`
            }
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
