import { handleDbError } from "@/lib/db"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"

export const GET = withTenantAuth(async (req, session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  try {
    const result = await db`
      SELECT 
        (SELECT COUNT(*) FROM "Course" WHERE status = 'active' OR status = 'פעיל' OR status IS NULL) as "totalCourses",
        (SELECT COUNT(*) FROM "Student" WHERE status = 'active' OR status = 'פעיל' OR status IS NULL) as "activeStudents",
        (SELECT COUNT(*) FROM "Teacher" WHERE status = 'פעיל' OR status = 'active' OR status IS NULL) as "activeTeachers",
        (SELECT COUNT(*) FROM "School") as "totalSchools",
        (SELECT COUNT(*) FROM "Enrollment") as "totalEnrollments",
        (SELECT COALESCE(SUM(amount), 0) FROM "Payment" WHERE "paymentDate" >= NOW() - INTERVAL '30 days' AND ("paymentType" IS NULL OR "paymentType" NOT IN ('discount', 'credit'))) as "monthlyIncome",
        (SELECT COALESCE(SUM(amount), 0) FROM "Expense" WHERE date >= NOW() - INTERVAL '30 days') as "monthlyExpenses",
        (
          SELECT COALESCE(SUM(GREATEST(0, sub.due - COALESCE(sub.paid, 0))), 0)
          FROM (
            SELECT s."studentId", s.due, p.paid
            FROM (
              SELECT e."studentId", SUM(COALESCE(c.price::numeric, 0)) AS due
              FROM "Enrollment" e
              INNER JOIN "Course" c ON c.id = e."courseId"
              GROUP BY e."studentId"
            ) s
            LEFT JOIN (
              SELECT "studentId", COALESCE(SUM(amount::numeric), 0) AS paid
              FROM "Payment"
              WHERE "studentId" IS NOT NULL
              GROUP BY "studentId"
            ) p ON p."studentId" = s."studentId"
          ) sub
        ) AS "totalStudentDebt",
        (
          SELECT COUNT(*)::int
          FROM (
            SELECT s."studentId"
            FROM (
              SELECT e."studentId", SUM(COALESCE(c.price::numeric, 0)) AS due
              FROM "Enrollment" e
              INNER JOIN "Course" c ON c.id = e."courseId"
              GROUP BY e."studentId"
            ) s
            LEFT JOIN (
              SELECT "studentId", COALESCE(SUM(amount::numeric), 0) AS paid
              FROM "Payment"
              WHERE "studentId" IS NOT NULL
              GROUP BY "studentId"
            ) p ON p."studentId" = s."studentId"
            WHERE GREATEST(0, s.due - COALESCE(p.paid, 0)) > 0
          ) debtors
        ) AS "debtorStudentsCount"
    `
    const recentStudents = await db`SELECT id, name, "createdAt" FROM "Student" ORDER BY "createdAt" DESC LIMIT 3`
    const recentCourses = await db`SELECT id, name, "createdAt" FROM "Course"  ORDER BY "createdAt" DESC LIMIT 3`
    const stats = result[0]
    return Response.json({
      totalCourses: Number(stats.totalCourses) || 0,
      activeStudents: Number(stats.activeStudents) || 0,
      activeTeachers: Number(stats.activeTeachers) || 0,
      totalSchools: Number(stats.totalSchools) || 0,
      totalEnrollments: Number(stats.totalEnrollments) || 0,
      monthlyIncome: Number(stats.monthlyIncome) || 0,
      monthlyExpenses: Number(stats.monthlyExpenses) || 0,
      totalStudentDebt: Number(stats.totalStudentDebt) || 0,
      debtorStudentsCount: Number(stats.debtorStudentsCount) || 0,
      recentActivity: [
        ...recentStudents.map((s: { id: string; name: string; createdAt: string }) => ({
          type: "student" as const,
          id: s.id,
          name: s.name,
          createdAt: s.createdAt,
        })),
        ...recentCourses.map((c: { id: string; name: string; createdAt: string }) => ({
          type: "course" as const,
          id: c.id,
          name: c.name,
          createdAt: c.createdAt,
        })),
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    })
  } catch (err) {
    return handleDbError(err, "GET /api/dashboard/stats")
  }
})
