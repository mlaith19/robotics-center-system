import type { Sql } from "postgres"
import { ensureCourseSessionPricesColumn } from "@/lib/course-session-prices"
import { applySiblingAndAttendancePricingToEnrollmentRows } from "@/lib/enrollment-effective-price"

/**
 * צפי תשלום לפי רישומים (כולל קורס לפי מפגש לפי נוכחות) מול סכום תשלומים — לפי תלמיד.
 */
export async function computePerStudentDueAndPaid(
  db: Sql,
  opts: {
    onlyActiveEnrollments: boolean
    excludeDiscountCreditPayments: boolean
  },
): Promise<Map<string, { expected: number; paid: number }>> {
  await ensureCourseSessionPricesColumn(db)

  const enrollRows = opts.onlyActiveEnrollments
    ? ((await db`
        SELECT e."studentId",
          e."courseId",
          e.status,
          c.price as "coursePrice",
          c.duration as "courseDuration",
          c."startTime",
          c."endTime",
          c."siblingDiscountPackageId",
          c."courseType",
          c."startDate",
          c."endDate",
          c."daysOfWeek",
          c."sessionPrices"
        FROM "Enrollment" e
        INNER JOIN "Course" c ON c.id = e."courseId"
        WHERE e.status IN ('active', 'פעיל') OR e.status IS NULL
      `) as Record<string, unknown>[])
    : ((await db`
        SELECT e."studentId",
          e."courseId",
          e.status,
          c.price as "coursePrice",
          c.duration as "courseDuration",
          c."startTime",
          c."endTime",
          c."siblingDiscountPackageId",
          c."courseType",
          c."startDate",
          c."endDate",
          c."daysOfWeek",
          c."sessionPrices"
        FROM "Enrollment" e
        INNER JOIN "Course" c ON c.id = e."courseId"
      `) as Record<string, unknown>[])

  const priced = await applySiblingAndAttendancePricingToEnrollmentRows(db, enrollRows)
  const dueByStudent = new Map<string, number>()
  for (const r of priced) {
    const sid = String(r.studentId || "").trim()
    if (!sid) continue
    dueByStudent.set(sid, (dueByStudent.get(sid) || 0) + Number(r.coursePrice || 0))
  }

  type PaidRow = { studentId: string; paid: string | number }
  const paidRows = opts.excludeDiscountCreditPayments
    ? ((await db`
        SELECT "studentId", COALESCE(SUM(amount::numeric), 0) AS paid
        FROM "Payment"
        WHERE "studentId" IS NOT NULL
          AND ("paymentType" IS NULL OR "paymentType" NOT IN ('discount', 'credit'))
        GROUP BY "studentId"
      `) as PaidRow[])
    : ((await db`
        SELECT "studentId", COALESCE(SUM(amount::numeric), 0) AS paid
        FROM "Payment"
        WHERE "studentId" IS NOT NULL
        GROUP BY "studentId"
      `) as PaidRow[])

  const paidMap = new Map<string, number>()
  for (const p of paidRows) {
    paidMap.set(String(p.studentId), Number(p.paid))
  }

  const out = new Map<string, { expected: number; paid: number }>()
  const allIds = new Set<string>([...dueByStudent.keys(), ...paidMap.keys()])
  for (const sid of allIds) {
    out.set(sid, {
      expected: dueByStudent.get(sid) || 0,
      paid: paidMap.get(sid) || 0,
    })
  }
  return out
}
