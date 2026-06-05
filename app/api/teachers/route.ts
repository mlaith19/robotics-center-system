import bcrypt from "bcryptjs"
import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { ensureProfileImageColumns, resolveProfileImageWithFallback } from "@/lib/profile-image"
import {
  ensureAttendanceHourKindColumn,
  normalizeTeacherAttendanceHourKind,
} from "@/lib/teacher-attendance-hour-kind"
import { ensureTeacherTariffTables, resolveHourlyRateForAttendance } from "@/lib/teacher-tariff-profiles"
import { syncTeacherWeeklyActivityStatus } from "@/lib/teacher-weekly-activity-status"
import { sessionRolesGrantFullAccess } from "@/lib/permissions"

export const GET = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "teachers", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { searchParams } = new URL(req.url)
  const withAggregate = searchParams.get("aggregate") === "1"
  try {
    await ensureTeacherTariffTables(db)
    await syncTeacherWeeklyActivityStatus(db)
    const isFullAccess = sessionRolesGrantFullAccess(session.roleKey, session.role)
    let teacherScopeId: string | null = null
    if (!isFullAccess) {
      const scopedRows = await db`SELECT id FROM "Teacher" WHERE "userId" = ${session.id} LIMIT 1`
      teacherScopeId = scopedRows.length > 0 ? String((scopedRows[0] as { id: string }).id) : null
    }
    const [teachers, expenses, attendances, enrollments, tariffLinks, monthlyTeacherPayRow, presentCounts] = await Promise.all([
      teacherScopeId
        ? db`SELECT * FROM "Teacher" WHERE id = ${teacherScopeId} ORDER BY "createdAt" DESC`
        : db`SELECT * FROM "Teacher" ORDER BY "createdAt" DESC`,
      teacherScopeId
        ? db`SELECT "teacherId", SUM(amount) as total_paid FROM "Expense" WHERE "teacherId" = ${teacherScopeId} GROUP BY "teacherId"`
        : db`SELECT "teacherId", SUM(amount) as total_paid FROM "Expense" WHERE "teacherId" IS NOT NULL GROUP BY "teacherId"`,
      db`
        SELECT a."teacherId", a.id as "attId", a.status, a.hours, a."hourKind", a."date", a."campMeetingCellId",
          c.id as "courseId", c.location, c."startTime", c."endTime"
        FROM "Attendance" a
        LEFT JOIN "Course" c ON a."courseId" = c.id
        WHERE a."teacherId" IS NOT NULL
        ${teacherScopeId ? db`AND a."teacherId" = ${teacherScopeId}` : db``}
      `,
      db`SELECT "courseId", COUNT(*)::int as cnt FROM "Enrollment" GROUP BY "courseId"`,
      db`
        SELECT ctt."courseId", ctt."teacherId", ctt."tariffProfileId"
        FROM "CourseTeacherTariff" ctt
      `,
      db`
        SELECT COALESCE(SUM(amount::numeric), 0) AS "monthlyPaid"
        FROM "Expense"
        WHERE "teacherId" IS NOT NULL
          AND date >= date_trunc('month', CURRENT_TIMESTAMP)
          AND date < date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month'
      `,
      db`
        SELECT "courseId",
               "date",
               COALESCE("campMeetingCellId", '') AS cell_key,
               COUNT(DISTINCT "studentId")::int AS cnt
        FROM "Attendance"
        WHERE "studentId" IS NOT NULL
          AND LOWER(TRIM(COALESCE(status, ''))) IN ('present', 'נוכח')
          AND "courseId" IS NOT NULL
          AND "date" IS NOT NULL
        GROUP BY "courseId", "date", COALESCE("campMeetingCellId", '')
      `,
    ])

    const paidMap = new Map<string, number>()
    ;(expenses as any[]).forEach((r) => paidMap.set(String(r.teacherId), Number(r.total_paid || 0)))
    const enrollmentMap = new Map<string, number>()
    ;(enrollments as any[]).forEach((r) => enrollmentMap.set(String(r.courseId), Number(r.cnt || 0)))
    const teacherMap = new Map<string, any>()
    ;(teachers as any[]).forEach((t) => teacherMap.set(String(t.id), t))

    const profileIds = [...new Set((tariffLinks as { tariffProfileId: string }[]).map((l) => String(l.tariffProfileId)))]
    const profilesRows =
      profileIds.length > 0
        ? await db`
            SELECT * FROM "TeacherTariffProfile" WHERE id = ANY(${profileIds}::text[])
          `
        : []
    const profileById = new Map<string, Record<string, unknown>>()
    ;(profilesRows as any[]).forEach((p) => profileById.set(String(p.id), p as Record<string, unknown>))
    const courseTeacherTariffProfile = new Map<string, Record<string, unknown>>()
    ;(tariffLinks as { courseId: string; teacherId: string; tariffProfileId: string }[]).forEach((l) => {
      const pr = profileById.get(String(l.tariffProfileId))
      if (pr) courseTeacherTariffProfile.set(`${String(l.courseId)}|${String(l.teacherId)}`, pr)
    })

    const presentCountByKey = new Map<string, number>()
    ;(presentCounts as { courseId: string; date: string; cell_key: string; cnt: string | number }[]).forEach((p) => {
      const key = `${String(p.courseId)}|${String(p.date).slice(0, 10)}|${String(p.cell_key || "")}`
      presentCountByKey.set(key, Number(p.cnt || 0))
    })

    const owedMap = new Map<string, number>()
    let totalAttendanceHoursAll = 0
    ;(attendances as any[]).forEach((a) => {
      const teacherId = String(a.teacherId || "")
      if (!teacherId) return
      const status = String(a.status || "").toLowerCase()
      if (!(status === "נוכח" || status === "present")) return

      let hours = Number(a.hours || 0)
      if (!(Number.isFinite(hours) && hours > 0)) {
        const start = a.startTime ? new Date(a.startTime) : null
        const end = a.endTime ? new Date(a.endTime) : null
        if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          const diff = (end.getTime() - start.getTime()) / 3600000
          hours = diff > 0 ? diff : 0
        } else {
          hours = 0
        }
      }
      if (hours <= 0) return

      totalAttendanceHoursAll += hours

      const teacher = teacherMap.get(teacherId)
      if (!teacher) return
      const cid = a.courseId ? String(a.courseId) : ""
      const ymd = String(a.date ?? "").trim().slice(0, 10)
      const cell = a.campMeetingCellId ? String(a.campMeetingCellId) : ""
      const presentCount =
        cid && /^\d{4}-\d{2}-\d{2}$/.test(ymd)
          ? presentCountByKey.get(`${cid}|${ymd}|${cell}`) ?? 0
          : null
      const profileRow = cid ? courseTeacherTariffProfile.get(`${cid}|${teacherId}`) ?? null : null
      const rate = resolveHourlyRateForAttendance({
        tariffProfileRow: profileRow,
        teacherRow: teacher as Record<string, unknown>,
        location: a.location ? String(a.location) : null,
        enrollmentCount: a.courseId ? enrollmentMap.get(String(a.courseId)) ?? 0 : 0,
        presentStudentsCount: presentCount,
        hourKind: normalizeTeacherAttendanceHourKind((a as { hourKind?: unknown }).hourKind),
      })
      const owed = (owedMap.get(teacherId) || 0) + rate * hours
      owedMap.set(teacherId, owed)
    })

    let totalOwedToTeachers = 0
    const out = (teachers as any[]).map((t) => {
      const totalPaid = paidMap.get(String(t.id)) || 0
      const totalOwed = owedMap.get(String(t.id)) || 0
      totalOwedToTeachers += Math.max(0, Number(totalOwed) - Number(totalPaid))
      return {
        ...t,
        totalPaid,
        totalOwed,
        balance: totalPaid - totalOwed,
      }
    })
    if (withAggregate) {
      const totalPaidViaExpenses = [...paidMap.values()].reduce((sum, v) => sum + Number(v || 0), 0)
      const monthlyPaidToTeachers = Number((monthlyTeacherPayRow as { monthlyPaid?: string | number }[])[0]?.monthlyPaid ?? 0)
      return Response.json({
        teachers: out,
        aggregate: {
          totalAttendanceHours: Math.round(totalAttendanceHoursAll * 10) / 10,
          /** סכום הוצאות ששויכו למורה (לא תמיד מלא אם לא נרשמו הוצאות) */
          totalPaidViaExpenses,
          /** סה״כ יתרה לתשלום — כמו סכום max(0, חוב־שולם) לכל מורה (לפי נוכחות ותעריף) */
          totalOwedToTeachers: Math.round(totalOwedToTeachers * 100) / 100,
          /** תשלומים למורים שנרשמו כהוצאה בחודש הקלנדרי הנוכחי */
          monthlyPaidToTeachers: Math.round(monthlyPaidToTeachers * 100) / 100,
        },
      })
    }
    return Response.json(out)
  } catch (err) {
    console.error("GET /api/teachers error:", err)
    return Response.json({ error: "Failed to load teachers" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "teachers", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const body = await req.json()
    await ensureProfileImageColumns(db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>)
    const name = String(body.name ?? "").trim()
    const email = body.email ? String(body.email).trim() : null
    const phone = body.phone ? String(body.phone).trim() : null
    const idNumber = body.idNumber ? String(body.idNumber).trim() : null
    const birthDate = body.birthDate || null
    const city = body.city ? String(body.city).trim() : null
    const specialty = body.specialization ? String(body.specialization).trim() : null
    const status = body.status ? String(body.status).trim() : "פעיל"
    const bio = body.bio ? String(body.bio).trim() : null
    const profileImage = resolveProfileImageWithFallback(body.profileImage)

    const createUserAccount = body.createUserAccount === true
    const username = body.username ? String(body.username).trim() : null
    const password = body.password ? String(body.password) : null

    if (!name) return Response.json({ error: "name is required" }, { status: 400 })

    if (createUserAccount) {
      if (!username) return Response.json({ error: "username is required for user account" }, { status: 400 })
      if (!password || password.length < 4) return Response.json({ error: "password must be at least 4 characters" }, { status: 400 })
      const existingUser = await db`SELECT id FROM "User" WHERE username = ${username}`
      if (existingUser.length > 0) return Response.json({ error: "שם המשתמש כבר קיים במערכת" }, { status: 409 })
    }

    const teacherId = crypto.randomUUID()
    const now = new Date().toISOString()
    let userId = null

    if (createUserAccount && username && password) {
      userId = crypto.randomUUID()
      const hashedPassword = await bcrypt.hash(password, 10)
      await db`
        INSERT INTO "User" (id, name, email, username, password, phone, status, role, permissions, "force_password_reset", "createdAt", "updatedAt")
        VALUES (${userId}, ${name}, ${email}, ${username}, ${hashedPassword}, ${phone}, 'active', 'teacher', ${JSON.stringify([
          "courses.view", "students.view", "teachers.view", "schedule.view",
          "attendance.view", "attendance.edit", "settings.home",
        ])}, false, ${now}, ${now})
      `
    }

    const result = await db`
      INSERT INTO "Teacher" (
        id, name, email, phone, "idNumber", "birthDate", city, specialty, status, bio,
        "profileImage", "userId", "createdAt", "updatedAt"
      )
      VALUES (
        ${teacherId}, ${name}, ${email}, ${phone}, ${idNumber}, ${birthDate}, ${city}, ${specialty}, ${status}, ${bio},
        ${profileImage}, ${userId}, ${now}, ${now}
      )
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/teachers error:", err)
    return Response.json({ error: "Failed to create teacher" }, { status: 500 })
  }
})
