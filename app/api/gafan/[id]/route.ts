import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "gafan", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  try {
    const result = await db`
      SELECT g.*, s.name as "schoolName"
      FROM "Gafan" g
      LEFT JOIN "School" s ON g."schoolId" = s.id
      WHERE g.id = ${id}
    `
    if (result.length === 0) return Response.json({ error: "Gafan program not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("GET /api/gafan/[id] error:", err)
    return Response.json({ error: "Failed to load gafan program" }, { status: 500 })
  }
})

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "gafan", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  try {
    const body = await req.json()
    const now = new Date().toISOString()
    const result = await db`
      UPDATE "Gafan"
      SET
        name              = ${body.name              || null},
        "programNumber"   = ${body.programNumber     || body.program_number   || null},
        "validYear"       = ${body.validYear         || body.valid_year       || null},
        "companyName"     = ${body.companyName       || body.company_name     || null},
        "companyId"       = ${body.companyId         || body.company_id       || null},
        "companyAddress"  = ${body.companyAddress    || body.company_address  || null},
        "bankName"        = ${body.bankName          || body.bank_name        || null},
        "bankCode"        = ${body.bankCode          || body.bank_code        || null},
        "branchNumber"    = ${body.branchNumber      || body.branch_number    || null},
        "accountNumber"   = ${body.accountNumber     || body.account_number   || null},
        "operatorName"    = ${body.operatorName      || body.operator_name    || null},
        "priceMin"        = ${body.priceMin          || body.price_min        || 0},
        "priceMax"        = ${body.priceMax          || body.price_max        || null},
        status            = ${body.status            || "מתעניין"},
        "provider_type"   = ${body.providerType      || body.provider_type    || "internal"},
        notes             = ${body.notes             || null},
        "updatedAt"       = ${now}
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return Response.json({ error: "Gafan program not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("PUT /api/gafan/[id] error:", err)
    return Response.json({ error: "Failed to update gafan program" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "gafan", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  try {
    await db`DELETE FROM "Gafan" WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/gafan/[id] error:", err)
    return Response.json({ error: "Failed to delete gafan program" }, { status: 500 })
  }
})
