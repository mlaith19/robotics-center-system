import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"
import { sessionRolesGrantFullAccess } from "@/lib/permissions"
import { requirePerm } from "@/lib/require-perm"

function s(v: unknown) {
  if (v === undefined || v === null) return null
  const t = String(v).trim()
  return t.length ? t : null
}

export const GET = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "schools", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  try {
    const isFullAccess = sessionRolesGrantFullAccess(session.roleKey, session.role)
    if (isFullAccess) {
      const schools = await db`SELECT * FROM "School" ORDER BY "createdAt" DESC`
      return Response.json(schools)
    }

    const teacherRows = await db`SELECT id FROM "Teacher" WHERE "userId" = ${session.id} LIMIT 1`
    if (teacherRows.length === 0) return Response.json([])
    const teacherId = String((teacherRows[0] as { id: string }).id)

    const schools = await db`
      SELECT DISTINCT s.*
      FROM "School" s
      JOIN "GafanSchoolLink" gsl ON gsl."schoolId" = s.id
      WHERE gsl."teacherIds" IS NOT NULL
        AND gsl."teacherIds" @> ${db.json([teacherId])}
      ORDER BY s."createdAt" DESC
    `
    return Response.json(schools)
  } catch (err) {
    console.error("GET /api/schools error:", err)
    return Response.json({ error: "Failed to load schools" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "schools", session)
  if (featureErr) return featureErr
  const permErr = requirePerm(session, "schools.edit")
  if (permErr) return permErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  try {
    const body = await req.json()
    const name = s(body?.name)
    if (!name) return Response.json({ error: "Name is required" }, { status: 400 })

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const city = s(body?.city)
    const contactPerson = s(body?.contactPerson ?? body?.contactName)
    const phone = s(body?.contactPhone)
    const email = s(body?.email)
    const address = s(body?.address)
    const status = s(body?.status) || "active"
    const institutionCode = s(body?.institutionCode)
    const schoolType = s(body?.schoolType)
    const schoolPhone = s(body?.schoolPhone)
    const bankName = s(body?.bankName)
    const bankCode = s(body?.bankCode)
    const bankBranch = s(body?.bankBranch)
    const bankAccount = s(body?.bankAccount)
    const notes = s(body?.notes)

    const result = await db`
      INSERT INTO "School" (
        id, name, city, "contactPerson", phone, email, address, status,
        "institutionCode", "schoolType", "schoolPhone", "bankName", "bankCode",
        "bankBranch", "bankAccount", notes, "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${name}, ${city}, ${contactPerson}, ${phone}, ${email}, ${address}, ${status},
        ${institutionCode}, ${schoolType}, ${schoolPhone}, ${bankName}, ${bankCode},
        ${bankBranch}, ${bankAccount}, ${notes}, ${now}, ${now}
      )
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/schools error:", err)
    return Response.json({ error: "Failed to create school" }, { status: 500 })
  }
})
