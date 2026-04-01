import { withTenantAuth } from "@/lib/tenant-api-auth"
import { ensureSessionMatchesTenant, requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { ensureSiblingDiscountTables, normalizeSiblingPayload } from "@/lib/sibling-discount"

export const GET = withTenantAuth(async (req, session) => {
  const permErr = requirePerm(session, "settings.view")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch

  const db = tenant.db
  try {
    await ensureSiblingDiscountTables(db)
    const rows = await db`
      SELECT *
      FROM "SiblingDiscountPackage"
      ORDER BY "isActive" DESC, "createdAt" DESC
    `
    return Response.json(rows)
  } catch (err) {
    console.error("GET /api/sibling-discount-packages error:", err)
    return Response.json({ error: "Failed to load sibling packages" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const permErr = requirePerm(session, "settings.edit")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch

  const db = tenant.db
  try {
    await ensureSiblingDiscountTables(db)
    const body = await req.json()
    const payload = normalizeSiblingPayload(body)
    if (!payload.name) {
      return Response.json({ error: "שם חבילה הוא שדה חובה" }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const result = await db`
      INSERT INTO "SiblingDiscountPackage"
        ("id", "name", "description", "pricingMode", "firstAmount", "secondAmount", "thirdAmount", "isActive", "createdAt", "updatedAt")
      VALUES
        (${id}, ${payload.name}, ${payload.description}, ${payload.pricingMode}, ${payload.firstAmount}, ${payload.secondAmount}, ${payload.thirdAmount}, ${payload.isActive}, NOW(), NOW())
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/sibling-discount-packages error:", err)
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: "Failed to create sibling package", message }, { status: 500 })
  }
})

