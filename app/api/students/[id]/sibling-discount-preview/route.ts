import { withTenantAuth } from "@/lib/tenant-api-auth"
import { ensureSessionMatchesTenant, requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import {
  ensureSiblingDiscountTables,
  getSiblingRank,
  resolveSiblingAmountByRank,
  type SiblingDiscountPackage,
} from "@/lib/sibling-discount"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "students.financial")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params

  try {
    await ensureSiblingDiscountTables(db)
    const { searchParams } = new URL(req.url)
    const packageId = searchParams.get("packageId")
    if (!packageId) return Response.json({ error: "packageId is required" }, { status: 400 })

    const pkgRows = await db<SiblingDiscountPackage[]>`
      SELECT *
      FROM "SiblingDiscountPackage"
      WHERE id = ${packageId}
      LIMIT 1
    `
    if (!pkgRows.length) return Response.json({ error: "Package not found" }, { status: 404 })
    const pkg = pkgRows[0]

    const rank = await getSiblingRank(db, id)
    const amountForRank = resolveSiblingAmountByRank(pkg, rank)
    const discountAmount =
      amountForRank == null ? null : Math.max(0, Number(pkg.firstAmount || 0) - Number(amountForRank || 0))

    return Response.json({
      studentId: id,
      packageId,
      rank,
      firstAmount: Number(pkg.firstAmount || 0),
      amountForRank,
      discountAmount,
    })
  } catch (err) {
    console.error("GET /api/students/[id]/sibling-discount-preview error:", err)
    return Response.json({ error: "Failed to calculate sibling discount preview" }, { status: 500 })
  }
})

