import { handleDbError } from "@/lib/db"
import { ensureEnvelopeTables, normalizeEnvelopeRows } from "@/lib/envelopes"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requirePerm } from "@/lib/require-perm"
import { ensureSessionMatchesTenant, requireTenant } from "@/lib/tenant/resolve-tenant"

export const GET = withTenantAuth(async (req, session) => {
  const permErr = requirePerm(session, "cashier.view")
  if (permErr) return permErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  try {
    await ensureEnvelopeTables(db)
    const rows = await db`SELECT * FROM "EnvelopeBudget" ORDER BY "monthKey" DESC, "createdAt" DESC`
    return Response.json(rows)
  } catch (err) {
    return handleDbError(err, "GET /api/envelopes")
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
    await ensureEnvelopeTables(db)
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return Response.json({ error: "Invalid body" }, { status: 400 })
    const monthKey = String(body.monthKey ?? "").trim()
    if (!monthKey) return Response.json({ error: "monthKey is required" }, { status: 400 })
    const targetAmountRaw = Number(body.targetAmount ?? 0)
    const targetAmount = Number.isFinite(targetAmountRaw) && targetAmountRaw >= 0 ? targetAmountRaw : 0
    const rowsJson = db.json(normalizeEnvelopeRows(body.rows))
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const out = await db`
      INSERT INTO "EnvelopeBudget" ("id", "monthKey", "targetAmount", "rows", "createdAt", "updatedAt")
      VALUES (${id}, ${monthKey}, ${targetAmount}, ${rowsJson}, ${now}, ${now})
      RETURNING *
    `
    return Response.json(out[0], { status: 201 })
  } catch (err) {
    return handleDbError(err, "POST /api/envelopes")
  }
})
