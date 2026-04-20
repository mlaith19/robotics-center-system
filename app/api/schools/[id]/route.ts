import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { sessionRolesGrantFullAccess } from "@/lib/permissions"
import { requirePerm } from "@/lib/require-perm"

type Ctx = { params: Promise<{ id: string }> }

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length ? s : null
}

export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "schools", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  try {
    let result: any[] = []
    if (sessionRolesGrantFullAccess(session.roleKey, session.role)) {
      result = await db`SELECT * FROM "School" WHERE id = ${id}`
    } else {
      const teacherRows = await db`SELECT id FROM "Teacher" WHERE "userId" = ${session.id} LIMIT 1`
      if (teacherRows.length === 0) return Response.json({ error: "School not found" }, { status: 404 })
      const teacherId = String((teacherRows[0] as { id: string }).id)
      result = await db`
        SELECT DISTINCT s.*
        FROM "School" s
        JOIN "GafanSchoolLink" g ON g."schoolId" = s.id
        WHERE s.id = ${id}
          AND g."teacherIds" IS NOT NULL
          AND g."teacherIds" @> ${db.json([teacherId])}
      `
    }
    if (result.length === 0) return Response.json({ error: "School not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("GET /api/schools/[id] error:", err)
    return Response.json({ error: "Failed to load school" }, { status: 500 })
  }
})

export const PUT = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "schools", session)
  if (featureErr) return featureErr
  const permErr = requirePerm(session, "schools.edit")
  if (permErr) return permErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  const body = await req.json()
  const name = cleanStr(body.name)
  if (!name) return Response.json({ error: "name is required" }, { status: 400 })

  try {
    const now = new Date().toISOString()
    const city = cleanStr(body.city)
    const address = cleanStr(body.address)
    const phone = cleanStr(body.contactPhone)
    const email = cleanStr(body.email)
    const contactPerson = cleanStr(body.contactPerson ?? body.contactName)
    const status = cleanStr(body.status) || "active"

    const result = await db`
      UPDATE "School"
      SET name = ${name}, city = ${city}, address = ${address}, phone = ${phone},
          email = ${email}, "contactPerson" = ${contactPerson}, status = ${status},
          "institutionCode" = ${cleanStr(body.institutionCode)},
          "schoolType"  = ${cleanStr(body.schoolType)},
          "schoolPhone" = ${cleanStr(body.schoolPhone)},
          "bankName"    = ${cleanStr(body.bankName)},
          "bankCode"    = ${cleanStr(body.bankCode)},
          "bankBranch"  = ${cleanStr(body.bankBranch)},
          "bankAccount" = ${cleanStr(body.bankAccount)},
          notes = ${cleanStr(body.notes)},
          "updatedAt" = ${now}
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return Response.json({ error: "School not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("PUT /api/schools/[id] error:", err)
    return Response.json({ error: "Failed to update school" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "schools", session)
  if (featureErr) return featureErr
  const permErr = requirePerm(session, "schools.delete")
  if (permErr) return permErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  try {
    await db`DELETE FROM "School" WHERE id = ${id}`
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/schools/[id] error:", err)
    return Response.json({ error: "Failed to delete school" }, { status: 500 })
  }
})
