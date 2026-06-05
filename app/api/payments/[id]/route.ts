import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { hasFullAccessRole, hasPermission } from "@/lib/permissions"

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

type Ctx = { params: Promise<{ id: string }> }

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
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
    const { id } = await params
    const result = await db`SELECT * FROM "Payment" WHERE id = ${id}`
    if (result.length === 0) return Response.json({ error: "Payment not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("GET /api/payments/[id] error:", err)
    return Response.json({ error: "Failed to load payment" }, { status: 500 })
  }
})

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
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
    const { id } = await params
    const body   = await req.json()
    const { amount, paymentDate, paymentType, description } = body
    const result = await db`
      UPDATE "Payment"
      SET
        amount        = COALESCE(${amount},      amount),
        "paymentDate" = COALESCE(${paymentDate}, "paymentDate"),
        "paymentType" = COALESCE(${paymentType}, "paymentType"),
        description   = COALESCE(${description}, description)
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return Response.json({ error: "Payment not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("PUT /api/payments/[id] error:", err)
    return Response.json({ error: "Failed to update payment" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const isPrivileged = hasFullAccessRole(session.roleKey) || hasFullAccessRole(session.role)
  const perms = Array.isArray(session.permissions) ? session.permissions : []
  const canDelete =
    isPrivileged ||
    hasPermission(perms, "cashier.delete") ||
    hasPermission(perms, "schools.tab.payments.delete") ||
    hasPermission(perms, "schools.tab.debtors.delete")
  if (!canDelete) {
    const permErr = requirePerm(session, "cashier.delete")
    if (permErr) return permErr
  }

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db

  try {
    const { id } = await params
    const result = await db`DELETE FROM "Payment" WHERE id = ${id} RETURNING id`
    if (result.length === 0) return Response.json({ error: "Payment not found" }, { status: 404 })
    return Response.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/payments/[id] error:", err)
    return Response.json({ error: "Failed to delete payment" }, { status: 500 })
  }
})
