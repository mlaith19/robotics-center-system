import type { Sql } from "postgres"
import {
  ensureSiblingDiscountTables,
  getSiblingRank,
  resolveSiblingAmountByRank,
  resolveEffectiveCoursePriceByPackage,
  type SiblingDiscountPackage,
} from "@/lib/sibling-discount"
import { summarizePerSessionAttendanceForEnrollment } from "@/lib/per-session-attendance-charge"

/**
 * מחשב coursePrice אפקטיבי לכל שורת רישום (אחים + קורס לפי מפגש לפי נוכחות).
 * השורות חייבות לכלול שדות מה־JOIN ל־Course כמו ב־GET /api/enrollments.
 */
export async function applySiblingAndAttendancePricingToEnrollmentRows(
  db: Sql,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  await ensureSiblingDiscountTables(db)

  const studentIds = [...new Set(rows.map((r) => String(r.studentId || "")).filter(Boolean))]
  const packageByStudent = new Map<string, string>()
  const groupByStudent = new Map<string, string>()
  const groupPackage = new Map<string, string>()
  if (studentIds.length) {
    const students = await db<{ id: string; siblingDiscountPackageId: string | null; siblingGroupId: string | null }[]>`
      SELECT id, "siblingDiscountPackageId", "siblingGroupId"
      FROM "Student"
      WHERE id = ANY(${studentIds}::text[])
    `
    for (const s of students) {
      if (s.siblingDiscountPackageId) packageByStudent.set(s.id, s.siblingDiscountPackageId)
      if (s.siblingGroupId) groupByStudent.set(s.id, s.siblingGroupId)
    }
    for (const s of students) {
      if (!s.siblingGroupId) continue
      if (!s.siblingDiscountPackageId) continue
      if (!groupPackage.has(s.siblingGroupId)) {
        groupPackage.set(s.siblingGroupId, s.siblingDiscountPackageId)
      }
    }
    for (const s of students) {
      if (packageByStudent.has(s.id)) continue
      const gid = s.siblingGroupId
      if (!gid) continue
      const inherited = groupPackage.get(gid)
      if (inherited) packageByStudent.set(s.id, inherited)
    }
  }

  const packageIds = [
    ...new Set(
      rows
        .map((r) => (r.siblingDiscountPackageId ? String(r.siblingDiscountPackageId) : ""))
        .concat(Array.from(packageByStudent.values()))
        .filter(Boolean),
    ),
  ]
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

  const courseIds = [
    ...new Set(rows.map((r) => String(r.courseId || "").trim()).filter(Boolean)),
  ]
  const attendanceMap = new Map<string, { date: unknown; status: unknown }[]>()
  const courseAllowStudentSiblingDiscountMap = new Map<string, boolean>()
  if (courseIds.length) {
    const attRows = await db<
      { studentId: string; courseId: string; date: unknown; status: unknown }[]
    >`
      SELECT "studentId", "courseId", date, status
      FROM "Attendance"
      WHERE "courseId" = ANY(${courseIds}::text[])
        AND "studentId" IS NOT NULL
    `
    for (const a of attRows) {
      const key = `${a.studentId}|${a.courseId}`
      if (!attendanceMap.has(key)) attendanceMap.set(key, [])
      attendanceMap.get(key)!.push({ date: a.date, status: a.status })
    }
    const courseRows = await db<{ id: string; useStudentSiblingDiscountInCourse: boolean | null }[]>`
      SELECT id, "useStudentSiblingDiscountInCourse"
      FROM "Course"
      WHERE id = ANY(${courseIds}::text[])
    `
    for (const c of courseRows) {
      courseAllowStudentSiblingDiscountMap.set(
        String(c.id),
        c.useStudentSiblingDiscountInCourse !== false,
      )
    }
  }

  const rankCache = new Map<string, number | null>()
  const finalRows: Record<string, unknown>[] = []

  for (const r of rows) {
    const studentIdVal = String(r.studentId || "")
    const courseIdVal = String(r.courseId || "")
    const coursePackageId = r.siblingDiscountPackageId ? String(r.siblingDiscountPackageId) : null
    const studentPackageId = packageByStudent.get(studentIdVal) || null
    const allowStudentSiblingDiscount = courseAllowStudentSiblingDiscountMap.get(courseIdVal) !== false
    const packageId = coursePackageId || (allowStudentSiblingDiscount ? studentPackageId : null)
    const pkg = packageId ? packagesMap.get(packageId) : undefined

    let effectivePrice = Number(r.coursePrice || 0)
    let siblingDiscountPackageName: string | null = null
    let siblingDiscountPackageSource: "course" | "student" | null = null
    let siblingRank: number | null = null
    let siblingRankLabel: string | null = null

    const attKey = `${studentIdVal}|${courseIdVal}`
    const attendanceRows = attendanceMap.get(attKey) || []
    const perSessionSummary = summarizePerSessionAttendanceForEnrollment({
      courseType: r.courseType,
      coursePrice: Number(r.coursePrice || 0),
      courseDuration: r.courseDuration != null ? Number(r.courseDuration) : null,
      startDate: r.startDate,
      endDate: r.endDate,
      daysOfWeek: r.daysOfWeek,
      sessionPricesRaw: r.sessionPrices,
      attendanceRows,
    })

    if (perSessionSummary !== null) {
      effectivePrice = perSessionSummary.attendedChargeSum
    }

    if (pkg && studentIdVal) {
      siblingDiscountPackageName = String(pkg.name || "")
      siblingDiscountPackageSource = coursePackageId ? "course" : studentPackageId ? "student" : null
      let rank = rankCache.get(studentIdVal)
      if (rank === undefined) {
        rank = await getSiblingRank(db, studentIdVal)
        rankCache.set(studentIdVal, rank)
      }
      siblingRank = rank && rank > 0 ? rank : null
      siblingRankLabel = siblingRank ? `אח ${siblingRank}` : null
      const resolvedRank = rank && rank > 0 ? rank : 1
      const amountForRank = resolveSiblingAmountByRank(pkg, resolvedRank)

      if (amountForRank != null) {
        if (perSessionSummary !== null) {
          if (pkg.pricingMode === "perSession") {
            effectivePrice = resolveEffectiveCoursePriceByPackage("perSession", amountForRank, {
              duration: perSessionSummary.presentSessionCount,
              startTime: r.startTime ? String(r.startTime) : null,
              endTime: r.endTime ? String(r.endTime) : null,
            })
          } else if (pkg.pricingMode === "perHour") {
            effectivePrice = resolveEffectiveCoursePriceByPackage("perHour", amountForRank, {
              duration: perSessionSummary.presentSessionCount,
              startTime: r.startTime ? String(r.startTime) : null,
              endTime: r.endTime ? String(r.endTime) : null,
            })
          }
          // perCourse / perStudent: נשאר attendedChargeSum
        } else {
          effectivePrice = resolveEffectiveCoursePriceByPackage(pkg.pricingMode, amountForRank, {
            duration: Number(r.courseDuration || 0),
            startTime: r.startTime ? String(r.startTime) : null,
            endTime: r.endTime ? String(r.endTime) : null,
          })
        }
      }
    }

    const siblingGroupIdOut = groupByStudent.get(studentIdVal) || null
    finalRows.push({
      ...r,
      coursePrice: effectivePrice,
      siblingDiscountPackageName,
      siblingDiscountPackageSource,
      siblingRank,
      siblingRankLabel,
      siblingGroupId: siblingGroupIdOut,
    })
  }

  return finalRows
}
