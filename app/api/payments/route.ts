import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { hasFullAccessRole, hasPermission } from "@/lib/permissions"
import { ensureSiblingDiscountTables, getSiblingRank, resolveSiblingAmountByRank, type SiblingDiscountPackage } from "@/lib/sibling-discount"

function canReadPayments(session: { role?: string; roleKey?: string; permissions?: string[] }) {
  if (hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)) return true
  const perms = Array.isArray(session.permissions) ? session.permissions : []
  return (
    hasPermission(perms, "cashier.view") ||
    hasPermission(perms, "students.financial") ||
    hasPermission(perms, "students.tab.payments") ||
    hasPermission(perms, "myProfile.tab.payments") ||
    hasPermission(perms, "schools.tab.payments") ||
    hasPermission(perms, "schools.tab.payments.view") ||
    hasPermission(perms, "schools.tab.payments.edit") ||
    hasPermission(perms, "schools.tab.payments.delete") ||
    hasPermission(perms, "schools.tab.debtors") ||
    hasPermission(perms, "schools.tab.debtors.view") ||
    hasPermission(perms, "schools.tab.debtors.edit") ||
    hasPermission(perms, "schools.tab.debtors.delete")
  )
}

function canWritePayments(session: { role?: string; roleKey?: string; permissions?: string[] }) {
  if (hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)) return true
  const perms = Array.isArray(session.permissions) ? session.permissions : []
  return (
    hasPermission(perms, "cashier.income") ||
    hasPermission(perms, "students.financial") ||
    hasPermission(perms, "schools.tab.payments.edit") ||
    hasPermission(perms, "schools.tab.payments.delete") ||
    hasPermission(perms, "schools.tab.debtors.edit") ||
    hasPermission(perms, "schools.tab.debtors.delete")
  )
}

async function ensurePaymentCourseIdColumn(db: any) {
  try {
    await db`
      ALTER TABLE "Payment"
      ADD COLUMN IF NOT EXISTS "courseId" TEXT REFERENCES "Course"("id") ON DELETE SET NULL
    `
  } catch (err) {
    console.warn("[payments] ensure courseId column skipped:", err)
  }
}

async function ensurePaymentStudentIdNullable(db: any) {
  try {
    await db`ALTER TABLE "Payment" ALTER COLUMN "studentId" DROP NOT NULL`
  } catch (err) {
    // Some tenants may already have nullable studentId or restricted privileges; keep best-effort.
    console.warn("[payments] ensure studentId nullable skipped:", err)
  }
}

export const GET = withTenantAuth(async (req, session) => {
  if (!canReadPayments(session)) {
    const permErr = requirePerm(session, "cashier.view")
    if (permErr) return permErr
  }

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    await ensurePaymentCourseIdColumn(db)
    const { searchParams } = new URL(req.url)
    const schoolPayId = (searchParams.get("schoolId") || "").trim()
    const courseId = (searchParams.get("courseId") || "").trim()
    const includeLegacyCoursePayments =
      (searchParams.get("includeLegacyCoursePayments") || "").trim() === "1"
    if (schoolPayId) {
      const bySchool = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE (
          p."studentId" IN (
            SELECT DISTINCT e."studentId"
            FROM "Enrollment" e
            INNER JOIN "Course" c ON c.id = e."courseId"
            WHERE c."schoolId" = ${schoolPayId}
          )
          OR (
            p."studentId" IS NULL
            AND p.description IS NOT NULL
            AND (
              p.description LIKE ${`[SCHOOL_PAYOUT:${schoolPayId}]%`}
              OR p.description LIKE ${`[SCHOOL_CHECK_IN:${schoolPayId}]%`}
              OR p.description LIKE ${`[SCHOOL_CHECK_OUT:${schoolPayId}]%`}
            )
          )
        )
        ORDER BY p."paymentDate" DESC
      `
      return Response.json(bySchool)
    }

    const studentId = searchParams.get("studentId")
    const startDate = searchParams.get("startDate")
    const endDate   = searchParams.get("endDate")

    let result
    if (courseId && studentId && startDate && endDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."courseId" = ${courseId} AND p."studentId" = ${studentId}
          AND p."paymentDate" >= ${startDate} AND p."paymentDate" <= ${endDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (courseId && studentId && startDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."courseId" = ${courseId} AND p."studentId" = ${studentId}
          AND p."paymentDate" >= ${startDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (courseId && studentId && endDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."courseId" = ${courseId} AND p."studentId" = ${studentId}
          AND p."paymentDate" <= ${endDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (courseId && startDate && endDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."courseId" = ${courseId}
          AND p."paymentDate" >= ${startDate} AND p."paymentDate" <= ${endDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (courseId && startDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."courseId" = ${courseId}
          AND p."paymentDate" >= ${startDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (courseId && endDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."courseId" = ${courseId}
          AND p."paymentDate" <= ${endDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (courseId && studentId) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."courseId" = ${courseId} AND p."studentId" = ${studentId}
        ORDER BY p."paymentDate" DESC
      `
    } else if (courseId) {
      if (includeLegacyCoursePayments) {
        result = await db`
          SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
          FROM "Payment" p
          LEFT JOIN "Student" s ON p."studentId" = s.id
          LEFT JOIN "User" u ON p."createdByUserId" = u.id
          LEFT JOIN "Course" c ON c.id = ${courseId}
          WHERE p."courseId" = ${courseId}
             OR (
               p."courseId" IS NULL
               AND p."studentId" IN (
                 SELECT e."studentId"
                 FROM "Enrollment" e
                 WHERE e."courseId" = ${courseId}
               )
               AND (
                 p.description = ('תשלום לקורס: ' || COALESCE(c.name, ''))
                 OR p.description = ('Payment for course: ' || COALESCE(c.name, ''))
               )
             )
          ORDER BY p."paymentDate" DESC
        `
      } else {
        result = await db`
          SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
          FROM "Payment" p
          LEFT JOIN "Student" s ON p."studentId" = s.id
          LEFT JOIN "User" u ON p."createdByUserId" = u.id
          WHERE p."courseId" = ${courseId}
          ORDER BY p."paymentDate" DESC
        `
      }
    } else if (studentId && startDate && endDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."studentId" = ${studentId} AND p."paymentDate" >= ${startDate} AND p."paymentDate" <= ${endDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (studentId && startDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."studentId" = ${studentId} AND p."paymentDate" >= ${startDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (studentId && endDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."studentId" = ${studentId} AND p."paymentDate" <= ${endDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (startDate && endDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."paymentDate" >= ${startDate} AND p."paymentDate" <= ${endDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (studentId) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."studentId" = ${studentId}
        ORDER BY p."paymentDate" DESC
      `
    } else if (startDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."paymentDate" >= ${startDate}
        ORDER BY p."paymentDate" DESC
      `
    } else if (endDate) {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        WHERE p."paymentDate" <= ${endDate}
        ORDER BY p."paymentDate" DESC
      `
    } else {
      result = await db`
        SELECT p.*, s.name as "studentName", u.name as "createdByUserName"
        FROM "Payment" p
        LEFT JOIN "Student" s ON p."studentId" = s.id
        LEFT JOIN "User" u ON p."createdByUserId" = u.id
        ORDER BY p."paymentDate" DESC
      `
    }
    return Response.json(result)
  } catch (err) {
    console.error("GET /api/payments error:", err)
    return Response.json({ error: "Failed to load payments" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  if (!canWritePayments(session)) {
    const permErr = requirePerm(session, "cashier.income")
    if (permErr) return permErr
  }

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    await ensurePaymentCourseIdColumn(db)
    await ensurePaymentStudentIdNullable(db)
    const body = await req.json()
    const { studentId, amount, date, paymentMethod, paymentType, description, siblingPackageId, applySiblingDiscount, courseId } = body
    const createdByUserId = session.id

    if (!amount || !date) return Response.json({ error: "amount and date are required" }, { status: 400 })

    let finalAmount = Number(amount)
    let finalDescription = description || null
    if (applySiblingDiscount === true && siblingPackageId && studentId) {
      const hasSiblingPerm =
        hasFullAccessRole(session.roleKey) ||
        hasFullAccessRole(session.role) ||
        hasPermission(session.permissions || [], "cashier.siblingDiscount")
      if (!hasSiblingPerm) {
        return Response.json({ error: "אין הרשאה להנחת אחים" }, { status: 403 })
      }

      await ensureSiblingDiscountTables(db)
      const pkgRows = await db<SiblingDiscountPackage[]>`
        SELECT * FROM "SiblingDiscountPackage" WHERE id = ${String(siblingPackageId)} AND "isActive" = TRUE LIMIT 1
      `
      if (!pkgRows.length) {
        return Response.json({ error: "חבילת אחים לא נמצאה או לא פעילה" }, { status: 400 })
      }
      const pkg = pkgRows[0]
      const rank = await getSiblingRank(db, String(studentId))
      const amountForRank = resolveSiblingAmountByRank(pkg, rank)
      if (amountForRank != null) {
        finalAmount = amountForRank
        const rankLabel = rank === 1 ? "ראשון" : rank === 2 ? "שני" : "שלישי+"
        finalDescription = [description, `הנחת אחים (${pkg.name}, ${rankLabel})`].filter(Boolean).join(" | ")
      }
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const typeVal = paymentType ?? paymentMethod ?? "cash"

    const result = await db`
      INSERT INTO "Payment" (id, "studentId", amount, "paymentDate", "paymentType", description, "courseId", "createdByUserId", "createdAt")
      VALUES (${id}, ${studentId || null}, ${finalAmount}, ${date}, ${typeVal}, ${finalDescription}, ${courseId || null}, ${createdByUserId}, ${now})
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/payments error:", err)
    return Response.json({ error: "Failed to create payment" }, { status: 500 })
  }
})
