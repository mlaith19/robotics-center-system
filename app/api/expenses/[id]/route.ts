import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"

type Ctx = { params: Promise<{ id: string }> }

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "cashier.expense")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const { id } = await params
    const body = await req.json()
    const {
      description,
      amount,
      date,
      category,
      paymentMethod,
      isRecurring,
      recurringDay,
    } = body || {}

    const result = await db`
      UPDATE "Expense"
      SET
        description = COALESCE(${description}, description),
        amount = COALESCE(${amount}, amount),
        date = COALESCE(${date}, date),
        category = COALESCE(${category}, category),
        "paymentMethod" = COALESCE(${paymentMethod}, "paymentMethod"),
        "isRecurring" = COALESCE(${isRecurring}, "isRecurring"),
        "recurringDay" = COALESCE(${recurringDay}, "recurringDay")
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return Response.json({ error: "Expense not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("PUT /api/expenses/[id] error:", err)
    return Response.json({ error: "Failed to update expense" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "cashier.delete")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const { id } = await params
    const result = await db`DELETE FROM "Expense" WHERE id = ${id} RETURNING id`
    if (result.length === 0) return Response.json({ error: "Expense not found" }, { status: 404 })
    return Response.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/expenses/[id] error:", err)
    return Response.json({ error: "Failed to delete expense" }, { status: 500 })
  }
})
