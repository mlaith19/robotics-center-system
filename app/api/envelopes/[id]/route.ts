import { handleDbError } from "@/lib/db"
import { ensureEnvelopeTables, normalizeEnvelopeRows } from "@/lib/envelopes"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requirePerm } from "@/lib/require-perm"
import { ensureSessionMatchesTenant, requireTenant } from "@/lib/tenant/resolve-tenant"

type Ctx = { params: Promise<{ id: string }> }

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "cashier.expense")
  if (permErr) return permErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  try {
    await ensureEnvelopeTables(db)
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return Response.json({ error: "Invalid body" }, { status: 400 })
    const monthKey = String(body.monthKey ?? "").trim()
    const targetAmountRaw = Number(body.targetAmount ?? 0)
    const targetAmount = Number.isFinite(targetAmountRaw) && targetAmountRaw >= 0 ? targetAmountRaw : 0
    const rowsJson = db.json(normalizeEnvelopeRows(body.rows))
    const now = new Date().toISOString()
    const out = await db`
      UPDATE "EnvelopeBudget"
      SET "monthKey" = ${monthKey || null},
          "targetAmount" = ${targetAmount},
          "rows" = ${rowsJson},
          "updatedAt" = ${now}
      WHERE id = ${id}
      RETURNING *
    `
    if (out.length === 0) return Response.json({ error: "Envelope not found" }, { status: 404 })
    return Response.json(out[0])
  } catch (err) {
    return handleDbError(err, "PUT /api/envelopes/[id]")
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "cashier.expense")
  if (permErr) return permErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  try {
    await ensureEnvelopeTables(db)
    await db`DELETE FROM "EnvelopeBudget" WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return handleDbError(err, "DELETE /api/envelopes/[id]")
  }
})
