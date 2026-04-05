import { handleDbError } from "@/lib/db"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { computePerStudentDueAndPaid } from "@/lib/student-debt-aggregate"

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
        (SELECT COALESCE(SUM(amount), 0) FROM "Expense" WHERE date >= NOW() - INTERVAL '30 days') as "monthlyExpenses"
    `

    const duePaid = await computePerStudentDueAndPaid(db, {
      onlyActiveEnrollments: false,
      excludeDiscountCreditPayments: false,
    })
    let totalStudentDebt = 0
    let debtorStudentsCount = 0
    for (const [, v] of duePaid) {
      const debt = Math.max(0, v.expected - v.paid)
      totalStudentDebt += debt
      if (debt > 0) debtorStudentsCount += 1
    }
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
      totalStudentDebt: Math.round(totalStudentDebt * 100) / 100,
      debtorStudentsCount,
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
