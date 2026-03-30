import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withTenantAuth(async (req, session, { params }: Ctx) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  try {
    const body = await req.json()
    const name = body.name ? String(body.name).trim() : null
    const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : undefined
    if (name === null && sortOrder === undefined) {
      return Response.json({ error: "name or sortOrder required" }, { status: 400 })
    }
    const now = new Date().toISOString()
    if (name !== null) {
      const result = await db`
        UPDATE "CourseCategory" SET name = ${name}, "updatedAt" = ${now}
        WHERE id = ${id} RETURNING id, name, "sortOrder", "createdAt"
      `
      if (result.length === 0) return Response.json({ error: "Category not found" }, { status: 404 })
      return Response.json(result[0])
    }
    if (sortOrder !== undefined) {
      const result = await db`
        UPDATE "CourseCategory" SET "sortOrder" = ${sortOrder}, "updatedAt" = ${now}
        WHERE id = ${id} RETURNING id, name, "sortOrder", "createdAt"
      `
      if (result.length === 0) return Response.json({ error: "Category not found" }, { status: 404 })
      return Response.json(result[0])
    }
    return Response.json({ error: "Invalid request" }, { status: 400 })
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505"
        ? "קטגוריה בשם זה כבר קיימת"
        : "Failed to update category"
    return Response.json({ error: msg }, { status: 400 })
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  try {
    const result = await db`DELETE FROM "CourseCategory" WHERE id = ${id} RETURNING id`
    if (result.length === 0) return Response.json({ error: "Category not found" }, { status: 404 })
    return Response.json({ success: true })
  } catch (e) {
    console.error("DELETE /api/course-categories/[id] error:", e)
    return Response.json({ error: "Failed to delete category" }, { status: 500 })
  }
})
