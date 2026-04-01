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
    hasPermission(perms, "myProfile.tab.payments")
  )
}

function canWritePayments(session: { role?: string; roleKey?: string; permissions?: string[] }) {
  if (hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)) return true
  const perms = Array.isArray(session.permissions) ? session.permissions : []
  return hasPermission(perms, "cashier.income") || hasPermission(perms, "students.financial")
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
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get("studentId")
    const startDate = searchParams.get("startDate")
    const endDate   = searchParams.get("endDate")

    let result
    if (studentId && startDate && endDate) {
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
    const body = await req.json()
    const { studentId, amount, date, paymentMethod, paymentType, description, siblingPackageId, applySiblingDiscount } = body
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
      INSERT INTO "Payment" (id, "studentId", amount, "paymentDate", "paymentType", description, "createdByUserId", "createdAt")
      VALUES (${id}, ${studentId || null}, ${finalAmount}, ${date}, ${typeVal}, ${finalDescription}, ${createdByUserId}, ${now})
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/payments error:", err)
    return Response.json({ error: "Failed to create payment" }, { status: 500 })
  }
})
