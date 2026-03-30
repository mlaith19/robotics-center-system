import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"

export const GET = withTenantAuth(async (req, session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  try {
    const rows = await db`
      SELECT id, name, "sortOrder", "createdAt"
      FROM "CourseCategory"
      ORDER BY "sortOrder" ASC, name ASC
    `
    return Response.json(rows)
  } catch (e) {
    console.error("GET /api/course-categories error:", e)
    return Response.json({ error: "Failed to load categories" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  try {
    const body = await req.json()
    const name = body.name ? String(body.name).trim() : ""
    if (!name) return Response.json({ error: "name is required" }, { status: 400 })
    const id = crypto.randomUUID()
    const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0
    await db`INSERT INTO "CourseCategory" (id, name, "sortOrder") VALUES (${id}, ${name}, ${sortOrder})`
    const [row] = await db`SELECT id, name, "sortOrder", "createdAt" FROM "CourseCategory" WHERE id = ${id}`
    return Response.json(row, { status: 201 })
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505"
        ? "קטגוריה בשם זה כבר קיימת"
        : "Failed to create category"
    return Response.json({ error: msg }, { status: 400 })
  }
})
