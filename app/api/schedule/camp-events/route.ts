import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { hasFullAccessRole, hasPermission } from "@/lib/permissions"
import { ensureCampTables } from "@/lib/camp-kaytana"

export type CampScheduleEventDTO = {
  assignmentId: string
  sessionDate: string
  slotStart: string | null
  slotEnd: string | null
  slotSortOrder: number
  lessonTitle: string
  courseId: string
  courseName: string
  roomId: string
  roomLabel: string
  groupId: string
  groupLabel: string
  roomTeacherId: string | null
  teacherName: string | null
  courseStartTime: string | null
  courseEndTime: string | null
}

export const GET = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "courses", session)
  if (featureErr) return featureErr
  const denied = requirePerm(session, "schedule.view")
  if (denied) return denied

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { searchParams } = new URL(req.url)
  const start = (searchParams.get("start") || "").trim()
  const end = (searchParams.get("end") || "").trim()
  const filterStudentId = (searchParams.get("studentId") || "").trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return Response.json({ error: "start and end required as YYYY-MM-DD" }, { status: 400 })
  }

  const isFull = hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)
  const perms = session.permissions ?? []
  const canFilterByStudent =
    isFull || hasPermission(perms, "students.view") || hasPermission(perms, "students.edit")

  try {
    await ensureCampTables(db)

    const teacherRows =
      (await db`
        SELECT id FROM "Teacher" WHERE "userId" = ${session.id} LIMIT 1
      `) || []
    const teacherId = teacherRows.length ? String((teacherRows[0] as { id: string }).id) : null

    const studentRows =
      (await db`
        SELECT id FROM "Student" WHERE "userId" = ${session.id} LIMIT 1
      `) || []
    const studentId = studentRows.length ? String((studentRows[0] as { id: string }).id) : null

    const rows =
      (await db`
        SELECT
          ca.id as "assignmentId",
          cd."sessionDate" as "sessionDate",
          cs."startTime" as "slotStart",
          cs."endTime" as "slotEnd",
          ca."slotSortOrder" as "slotSortOrder",
          ca."lessonTitle" as "lessonTitle",
          c.id as "courseId",
          c.name as "courseName",
          cr.id as "roomId",
          cr.label as "roomLabel",
          cg.id as "groupId",
          cg.label as "groupLabel",
          cr."teacherId" as "roomTeacherId",
          t.name as "teacherName",
          to_char(c."startTime"::time, 'HH24:MI') as "courseStartTime",
          to_char(c."endTime"::time, 'HH24:MI') as "courseEndTime"
        FROM "CampAssignment" ca
        INNER JOIN "CampDay" cd ON ca."campDayId" = cd.id
        INNER JOIN "Course" c ON cd."courseId" = c.id
        INNER JOIN "CampRoom" cr ON ca."roomId" = cr.id
        INNER JOIN "CampGroup" cg ON ca."groupId" = cg.id
        LEFT JOIN "CampSlot" cs ON cs."courseId" = c.id AND cs."sortOrder" = ca."slotSortOrder"
        LEFT JOIN "Teacher" t ON cr."teacherId" = t.id
        WHERE cd."sessionDate" >= ${start}
          AND cd."sessionDate" <= ${end}
          AND split_part(c."courseType", '_', 1) = 'camp'
      `) || []

    const out: CampScheduleEventDTO[] = []

    for (const r of rows as Record<string, unknown>[]) {
      const event: CampScheduleEventDTO = {
        assignmentId: String(r.assignmentId),
        sessionDate: String(r.sessionDate),
        slotStart: r.slotStart != null ? String(r.slotStart) : null,
        slotEnd: r.slotEnd != null ? String(r.slotEnd) : null,
        slotSortOrder: Number(r.slotSortOrder),
        lessonTitle: String(r.lessonTitle ?? ""),
        courseId: String(r.courseId),
        courseName: String(r.courseName),
        roomId: String(r.roomId),
        roomLabel: String(r.roomLabel),
        groupId: String(r.groupId),
        groupLabel: String(r.groupLabel),
        roomTeacherId: r.roomTeacherId != null ? String(r.roomTeacherId) : null,
        teacherName: r.teacherName != null ? String(r.teacherName) : null,
        courseStartTime: r.courseStartTime != null ? String(r.courseStartTime) : null,
        courseEndTime: r.courseEndTime != null ? String(r.courseEndTime) : null,
      }

      if (!event.slotStart) event.slotStart = event.courseStartTime
      if (!event.slotEnd) event.slotEnd = event.courseEndTime
      if (!event.slotStart) event.slotStart = "09:00"
      if (!event.slotEnd) event.slotEnd = "10:00"

      out.push(event)
    }

    let filtered = out

    if (isFull) {
      if (filterStudentId && canFilterByStudent) {
        const enr =
          (await db`
            SELECT "courseId", "campGroupId" FROM "Enrollment"
            WHERE "studentId" = ${filterStudentId} AND status = ${"active"}
          `) || []
        const keys = new Set(
          (enr as { courseId: string; campGroupId: string | null }[])
            .filter((e) => e.campGroupId)
            .map((e) => `${e.courseId}\t${e.campGroupId}`),
        )
        filtered = filtered.filter((e) => keys.has(`${e.courseId}\t${e.groupId}`))
      }
    } else if (teacherId) {
      const courseIdsFromTeacher =
        (await db`
          SELECT id FROM "Course" co
          WHERE co."teacherIds" IS NOT NULL AND co."teacherIds" @> ${db.json([teacherId])}
        `) || []
      const courseSet = new Set((courseIdsFromTeacher as { id: string }[]).map((c) => c.id))
      filtered = filtered.filter(
        (e) => e.roomTeacherId === teacherId || courseSet.has(e.courseId),
      )
    } else if (studentId) {
      const enr =
        (await db`
          SELECT "courseId", "campGroupId" FROM "Enrollment"
          WHERE "studentId" = ${studentId} AND status = ${"active"}
        `) || []
      const keys = new Set(
        (enr as { courseId: string; campGroupId: string | null }[])
          .filter((e) => e.campGroupId)
          .map((e) => `${e.courseId}\t${e.campGroupId}`),
      )
      filtered = filtered.filter((e) => keys.has(`${e.courseId}\t${e.groupId}`))
    } else {
      filtered = []
    }

    return Response.json({ events: filtered })
  } catch (err) {
    console.error("GET /api/schedule/camp-events error:", err)
    return Response.json({ error: "Failed to load camp schedule" }, { status: 500 })
  }
})
