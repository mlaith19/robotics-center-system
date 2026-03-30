import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"

export const GET = withTenantAuth(async (req, session) => {
  const permErr = requirePerm(session, "cashier.view")
  if (permErr) return permErr

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
  const permErr = requirePerm(session, "cashier.income")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const body = await req.json()
    const { studentId, amount, date, paymentMethod, paymentType, description } = body
    const createdByUserId = session.id

    if (!amount || !date) return Response.json({ error: "amount and date are required" }, { status: 400 })

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const typeVal = paymentType ?? paymentMethod ?? "cash"

    const result = await db`
      INSERT INTO "Payment" (id, "studentId", amount, "paymentDate", "paymentType", description, "createdByUserId", "createdAt")
      VALUES (${id}, ${studentId || null}, ${amount}, ${date}, ${typeVal}, ${description || null}, ${createdByUserId}, ${now})
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/payments error:", err)
    return Response.json({ error: "Failed to create payment" }, { status: 500 })
  }
})
