import { withTenantAuth } from "@/lib/tenant-api-auth"
import { ensureSessionMatchesTenant, requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { ensureSiblingDiscountTables, normalizeSiblingPayload } from "@/lib/sibling-discount"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "settings.edit")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch

  const db = tenant.db
  const { id } = await params
  try {
    await ensureSiblingDiscountTables(db)
    const body = await req.json()
    const payload = normalizeSiblingPayload(body)
    if (!payload.name) {
      return Response.json({ error: "שם חבילה הוא שדה חובה" }, { status: 400 })
    }

    const result = await db`
      UPDATE "SiblingDiscountPackage"
      SET
        "name" = ${payload.name},
        "description" = ${payload.description},
        "pricingMode" = ${payload.pricingMode},
        "firstAmount" = ${payload.firstAmount},
        "secondAmount" = ${payload.secondAmount},
        "thirdAmount" = ${payload.thirdAmount},
        "isActive" = ${payload.isActive},
        "updatedAt" = NOW()
      WHERE "id" = ${id}
      RETURNING *
    `
    if (!result.length) return Response.json({ error: "Package not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("PATCH /api/sibling-discount-packages/[id] error:", err)
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: "Failed to update sibling package", message }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "settings.edit")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch

  const db = tenant.db
  const { id } = await params
  try {
    await ensureSiblingDiscountTables(db)
    const result = await db`
      DELETE FROM "SiblingDiscountPackage"
      WHERE "id" = ${id}
      RETURNING "id"
    `
    if (!result.length) return Response.json({ error: "Package not found" }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/sibling-discount-packages/[id] error:", err)
    return Response.json({ error: "Failed to delete sibling package" }, { status: 500 })
  }
})

