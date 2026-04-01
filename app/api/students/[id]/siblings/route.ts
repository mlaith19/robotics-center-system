import { withTenantAuth } from "@/lib/tenant-api-auth"
import { ensureSessionMatchesTenant, requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { ensureSiblingDiscountTables } from "@/lib/sibling-discount"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "students.view")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params

  try {
    await ensureSiblingDiscountTables(db)
    const base = await db<{ siblingGroupId: string | null }[]>`
      SELECT "siblingGroupId" FROM "Student" WHERE "id" = ${id}
    `
    if (!base.length) return Response.json({ error: "Student not found" }, { status: 404 })
    const groupId = base[0].siblingGroupId
    if (!groupId) return Response.json({ siblingGroupId: null, siblings: [] })

    const siblings = await db`
      SELECT id, name, phone, status, "idNumber", "siblingGroupId"
      FROM "Student"
      WHERE "siblingGroupId" = ${groupId}
      ORDER BY "createdAt" ASC, id ASC
    `
    return Response.json({ siblingGroupId: groupId, siblings })
  } catch (err) {
    console.error("GET /api/students/[id]/siblings error:", err)
    return Response.json({ error: "Failed to load siblings" }, { status: 500 })
  }
})

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "students.edit")
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
    const inputIds = Array.isArray(body?.siblingStudentIds) ? body.siblingStudentIds.map(String) : []
    const ids = [...new Set([id, ...inputIds])].filter(Boolean)
    if (!ids.length) return Response.json({ error: "No students selected" }, { status: 400 })

    const existing = await db<{ id: string }[]>`
      SELECT id FROM "Student" WHERE id = ANY(${ids}::text[])
    `
    const existingSet = new Set(existing.map((r) => r.id))
    if (!existingSet.has(id)) return Response.json({ error: "Student not found" }, { status: 404 })

    const validIds = ids.filter((x) => existingSet.has(x))
    if (validIds.length <= 1) {
      await db`UPDATE "Student" SET "siblingGroupId" = NULL, "updatedAt" = NOW() WHERE id = ${id}`
      return Response.json({ siblingGroupId: null, siblings: [] })
    }

    const groupId = crypto.randomUUID()
    await db`
      UPDATE "Student"
      SET "siblingGroupId" = ${groupId}, "updatedAt" = NOW()
      WHERE id = ANY(${validIds}::text[])
    `
    const siblings = await db`
      SELECT id, name, phone, status, "idNumber", "siblingGroupId"
      FROM "Student"
      WHERE "siblingGroupId" = ${groupId}
      ORDER BY "createdAt" ASC, id ASC
    `
    return Response.json({ siblingGroupId: groupId, siblings })
  } catch (err) {
    console.error("PUT /api/students/[id]/siblings error:", err)
    return Response.json({ error: "Failed to save siblings" }, { status: 500 })
  }
})

