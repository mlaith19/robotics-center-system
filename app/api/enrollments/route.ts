import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import {
  ensureSiblingDiscountTables,
  getSiblingRank,
  resolveSiblingAmountByRank,
  resolveEffectiveCoursePriceByPackage,
  type SiblingDiscountPackage,
} from "@/lib/sibling-discount"

function isMissingColumnError(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  return code === "42703"
}

export const GET = withTenantAuth(async (req, _session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  const { searchParams } = new URL(req.url)
  const courseId  = searchParams.get("courseId")
  const studentId = searchParams.get("studentId")

  const runWithUserJoin = async () => {
    if (courseId && studentId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", u.name as "createdByUserName"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        LEFT JOIN "User" u ON e."createdByUserId" = u.id
        WHERE e."courseId" = ${courseId} AND e."studentId" = ${studentId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    if (courseId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", u.name as "createdByUserName"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        LEFT JOIN "User" u ON e."createdByUserId" = u.id
        WHERE e."courseId" = ${courseId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    if (studentId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", u.name as "createdByUserName"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        LEFT JOIN "User" u ON e."createdByUserId" = u.id
        WHERE e."studentId" = ${studentId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    return db`
      SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId", u.name as "createdByUserName"
      FROM "Enrollment" e
      LEFT JOIN "Student" s ON e."studentId" = s.id
      LEFT JOIN "Course" c ON e."courseId" = c.id
      LEFT JOIN "User" u ON e."createdByUserId" = u.id
      ORDER BY e."enrollmentDate" DESC
    `
  }

  const runWithoutUserJoin = async () => {
    if (courseId && studentId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        WHERE e."courseId" = ${courseId} AND e."studentId" = ${studentId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    if (courseId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        WHERE e."courseId" = ${courseId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    if (studentId) {
      return db`
        SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId"
        FROM "Enrollment" e
        LEFT JOIN "Student" s ON e."studentId" = s.id
        LEFT JOIN "Course" c ON e."courseId" = c.id
        WHERE e."studentId" = ${studentId}
        ORDER BY e."enrollmentDate" DESC
      `
    }
    return db`
      SELECT e.*, s.name as "studentName", c.name as "courseName", c.price as "coursePrice", c.duration as "courseDuration", c.id as "courseIdRef", c."startTime" as "startTime", c."endTime" as "endTime", c."siblingDiscountPackageId" as "siblingDiscountPackageId"
      FROM "Enrollment" e
      LEFT JOIN "Student" s ON e."studentId" = s.id
      LEFT JOIN "Course" c ON e."courseId" = c.id
      ORDER BY e."enrollmentDate" DESC
    `
  }

  try {
    await ensureSiblingDiscountTables(db)
    let result: Record<string, unknown>[]
    try {
      result = (await runWithUserJoin()) as Record<string, unknown>[]
    } catch (firstErr) {
      if (isMissingColumnError(firstErr)) {
        const rows = (await runWithoutUserJoin()) as Record<string, unknown>[]
        result = rows.map((r) => ({ ...r, createdByUserName: null }))
      } else {
        throw firstErr
      }
    }
    const rows = result as Record<string, unknown>[]
    const studentIds = [...new Set(rows.map((r) => String(r.studentId || "")).filter(Boolean))]
    const packageByStudent = new Map<string, string>()
    if (studentIds.length) {
      const students = await db<{ id: string; siblingDiscountPackageId: string | null }[]>`
        SELECT id, "siblingDiscountPackageId"
        FROM "Student"
        WHERE id = ANY(${studentIds}::text[])
      `
      for (const s of students) {
        if (s.siblingDiscountPackageId) packageByStudent.set(s.id, s.siblingDiscountPackageId)
      }
    }

    const packageIds = [...new Set(Array.from(packageByStudent.values()))]
    const packagesMap = new Map<string, SiblingDiscountPackage>()
    if (packageIds.length) {
      const pkgs = await db<SiblingDiscountPackage[]>`
        SELECT *
        FROM "SiblingDiscountPackage"
        WHERE id = ANY(${packageIds}::text[])
          AND "isActive" = TRUE
      `
      for (const p of pkgs) packagesMap.set(String(p.id), p)
    }

    const rankCache = new Map<string, number | null>()
    const finalRows = []
    for (const r of rows) {
      const studentIdVal = String(r.studentId || "")
      const packageId = (r.siblingDiscountPackageId ? String(r.siblingDiscountPackageId) : null) || packageByStudent.get(studentIdVal)
      const pkg = packageId ? packagesMap.get(packageId) : undefined
      let effectivePrice = Number(r.coursePrice || 0)
      if (pkg && studentIdVal) {
        let rank = rankCache.get(studentIdVal)
        if (rank === undefined) {
          rank = await getSiblingRank(db, studentIdVal)
          rankCache.set(studentIdVal, rank)
        }
        const amountForRank = resolveSiblingAmountByRank(pkg, rank)
        if (amountForRank != null) {
          effectivePrice = resolveEffectiveCoursePriceByPackage(pkg.pricingMode, amountForRank, {
            duration: Number(r.courseDuration || 0),
            startTime: r.startTime ? String(r.startTime) : null,
            endTime: r.endTime ? String(r.endTime) : null,
          })
        }
      }
      finalRows.push({ ...r, coursePrice: effectivePrice })
    }
    return Response.json(finalRows)
  } catch (err) {
    console.error("GET /api/enrollments error:", err)
    return Response.json({ error: "Failed to load enrollments" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const body = await req.json()
    const { studentId, courseId, status, sessionsLeft } = body

    if (!studentId || !courseId) return Response.json({ error: "studentId and courseId are required" }, { status: 400 })

    const existing = await db`SELECT id FROM "Enrollment" WHERE "studentId" = ${studentId} AND "courseId" = ${courseId}`
    if (existing.length > 0) return Response.json({ error: "Enrollment already exists" }, { status: 409 })

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const enrollmentDate = new Date().toISOString().split('T')[0]
    const sessions = sessionsLeft ?? 12
    const createdByUserId = session.id

    let result: { id: string; studentId: string; courseId: string; [k: string]: unknown }[]
    try {
      result = await db`
        INSERT INTO "Enrollment" (id, "studentId", "courseId", "enrollmentDate", status, "sessionsLeft", "createdByUserId", "createdAt")
        VALUES (${id}, ${studentId}, ${courseId}, ${enrollmentDate}, ${status || 'active'}, ${sessions}, ${createdByUserId}, ${now})
        RETURNING *
      `
    } catch (insertErr) {
      if (isMissingColumnError(insertErr)) {
        result = await db`
          INSERT INTO "Enrollment" (id, "studentId", "courseId", "enrollmentDate", status, "sessionsLeft", "createdAt")
          VALUES (${id}, ${studentId}, ${courseId}, ${enrollmentDate}, ${status || 'active'}, ${sessions}, ${now})
          RETURNING *
        `
      } else {
        throw insertErr
      }
    }
    const row = result[0] ?? {}
    return Response.json({ ...row, createdByUserId: row.createdByUserId ?? createdByUserId }, { status: 201 })
  } catch (err) {
    console.error("POST /api/enrollments error:", err)
    return Response.json({ error: "Failed to create enrollment" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, _session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get("studentId")
    const courseId  = searchParams.get("courseId")

    if (!studentId || !courseId) return Response.json({ error: "studentId and courseId are required" }, { status: 400 })

    await db`DELETE FROM "Enrollment" WHERE "studentId" = ${studentId} AND "courseId" = ${courseId}`
    return Response.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/enrollments error:", err)
    return Response.json({ error: "Failed to delete enrollment" }, { status: 500 })
  }
})
