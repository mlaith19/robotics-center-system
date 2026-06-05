import { handleDbError } from "@/lib/db"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { sessionRolesGrantFullAccess } from "@/lib/permissions"

export const GET = withTenantAuth(async (req, session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get("startDate")
    const endDate   = searchParams.get("endDate")
    const category  = searchParams.get("category")
    const teacherId = searchParams.get("teacherId")
    const isFullAccess = sessionRolesGrantFullAccess(session.roleKey, session.role)

    // Allow a teacher to read only their own expense records.
    if (teacherId && !isFullAccess) {
      const teacherRows = await db`SELECT id FROM "Teacher" WHERE "userId" = ${session.id} LIMIT 1`
      const ownTeacherId = teacherRows.length > 0 ? String((teacherRows[0] as { id: string }).id) : null
      if (!ownTeacherId || ownTeacherId !== teacherId) {
        const permErr = requirePerm(session, "cashier.view")
        if (permErr) return permErr
      }
    } else {
      const permErr = requirePerm(session, "cashier.view")
      if (permErr) return permErr
    }

    let result
    if (teacherId) {
      result = await db`
        SELECT ex.*, u.name as "createdByUserName"
        FROM "Expense" ex
        LEFT JOIN "User" u ON ex."createdByUserId" = u.id
        WHERE ex."teacherId" = ${teacherId}
        ORDER BY ex.date DESC
      `
    } else if (startDate && endDate && category) {
      result = await db`
        SELECT ex.*, u.name as "createdByUserName"
        FROM "Expense" ex
        LEFT JOIN "User" u ON ex."createdByUserId" = u.id
        WHERE ex.date >= ${startDate} AND ex.date <= ${endDate} AND ex.category = ${category}
        ORDER BY ex.date DESC
      `
    } else if (startDate && endDate) {
      result = await db`
        SELECT ex.*, u.name as "createdByUserName"
        FROM "Expense" ex
        LEFT JOIN "User" u ON ex."createdByUserId" = u.id
        WHERE ex.date >= ${startDate} AND ex.date <= ${endDate}
        ORDER BY ex.date DESC
      `
    } else if (startDate && category) {
      result = await db`
        SELECT ex.*, u.name as "createdByUserName"
        FROM "Expense" ex
        LEFT JOIN "User" u ON ex."createdByUserId" = u.id
        WHERE ex.date >= ${startDate} AND ex.category = ${category}
        ORDER BY ex.date DESC
      `
    } else if (endDate && category) {
      result = await db`
        SELECT ex.*, u.name as "createdByUserName"
        FROM "Expense" ex
        LEFT JOIN "User" u ON ex."createdByUserId" = u.id
        WHERE ex.date <= ${endDate} AND ex.category = ${category}
        ORDER BY ex.date DESC
      `
    } else if (startDate) {
      result = await db`
        SELECT ex.*, u.name as "createdByUserName"
        FROM "Expense" ex
        LEFT JOIN "User" u ON ex."createdByUserId" = u.id
        WHERE ex.date >= ${startDate}
        ORDER BY ex.date DESC
      `
    } else if (endDate) {
      result = await db`
        SELECT ex.*, u.name as "createdByUserName"
        FROM "Expense" ex
        LEFT JOIN "User" u ON ex."createdByUserId" = u.id
        WHERE ex.date <= ${endDate}
        ORDER BY ex.date DESC
      `
    } else if (category) {
      result = await db`
        SELECT ex.*, u.name as "createdByUserName"
        FROM "Expense" ex
        LEFT JOIN "User" u ON ex."createdByUserId" = u.id
        WHERE ex.category = ${category}
        ORDER BY ex.date DESC
      `
    } else {
      result = await db`
        SELECT ex.*, u.name as "createdByUserName"
        FROM "Expense" ex
        LEFT JOIN "User" u ON ex."createdByUserId" = u.id
        ORDER BY ex.date DESC
      `
    }
    return Response.json(result)
  } catch (err) {
    return handleDbError(err, "GET /api/expenses")
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const permErr = requirePerm(session, "cashier.expense")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const body = await req.json()
    const { description, amount, date, category, paymentMethod, isRecurring, recurringDay, teacherId } = body

    if (!description || !amount || !date || !category || !paymentMethod) {
      return Response.json({ error: "description, amount, date, category, and paymentMethod are required" }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const createdByUserId = session.id

    const result = await db`
      INSERT INTO "Expense" (id, description, amount, date, category, "paymentMethod", "isRecurring", "recurringDay", "teacherId", "createdByUserId", "createdAt")
      VALUES (${id}, ${description}, ${amount}, ${date}, ${category}, ${paymentMethod}, ${isRecurring || false}, ${recurringDay || null}, ${teacherId || null}, ${createdByUserId}, ${now})
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    return handleDbError(err, "POST /api/expenses")
  }
})
