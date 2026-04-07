import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { ensureGafanLinkColumns, normalizeGafanTeacherIds } from "@/lib/gafan-columns"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"

export const GET = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "gafan", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  try {
    await ensureGafanLinkColumns(db)
    const { searchParams } = new URL(req.url)
    const schoolId = (searchParams.get("schoolId") || "").trim()
    const result = schoolId
      ? await db`
          SELECT g.*, l."schoolId", COALESCE(l."teacherIds", '[]'::jsonb) as "teacherIds"
          FROM "Gafan" g
          INNER JOIN "GafanSchoolLink" l ON l."gafanId" = g.id
          WHERE l."schoolId" = ${schoolId}
          ORDER BY g."createdAt" DESC
        `
      : await db`SELECT * FROM "Gafan" ORDER BY "createdAt" DESC`
    return Response.json(result)
  } catch (err) {
    console.error("GET /api/gafan error:", err)
    return Response.json({ error: "Failed to load gafan programs" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const featureErr = await requireFeatureFromRequest(req, "gafan", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  try {
    await ensureGafanLinkColumns(db)
    const body = await req.json()
    const name = body.name
    if (!name) return Response.json({ error: "name is required" }, { status: 400 })

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const schoolIdRaw = body.schoolId ?? body.school_id
    const schoolId =
      schoolIdRaw !== undefined && schoolIdRaw !== null && String(schoolIdRaw).trim()
        ? String(schoolIdRaw).trim()
        : null
    const teacherIds = normalizeGafanTeacherIds(body.teacherIds)
    const teacherIdsJson = db.json(teacherIds)
    const result = await db`
      INSERT INTO "Gafan" (
        id, name, "programNumber", "validYear", "companyName", "companyId",
        "companyAddress", "bankName", "bankCode", "branchNumber", "accountNumber",
        "operatorName", "priceMin", "priceMax", status, "provider_type", notes,
        "schoolId", "teacherIds", "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${name},
        ${body.programNumber || body.program_number || null},
        ${body.validYear     || body.valid_year     || null},
        ${body.companyName   || body.company_name   || null},
        ${body.companyId     || body.company_id     || null},
        ${body.companyAddress|| body.company_address|| null},
        ${body.bankName      || body.bank_name      || null},
        ${body.bankCode      || body.bank_code      || null},
        ${body.branchNumber  || body.branch_number  || null},
        ${body.accountNumber || body.account_number || null},
        ${body.operatorName  || body.operator_name  || null},
        ${body.priceMin      || body.price_min      || null},
        ${body.priceMax      || body.price_max      || null},
        ${body.status || "מתעניין"},
        ${body.providerType  || body.provider_type  || "internal"},
        ${body.notes || null},
        ${schoolId}, ${teacherIdsJson},
        ${now}, ${now}
      )
      RETURNING *
    `
    if (schoolId) {
      await db`
        INSERT INTO "GafanSchoolLink" ("gafanId", "schoolId", "teacherIds", "createdAt", "updatedAt")
        VALUES (${id}, ${schoolId}, ${teacherIdsJson}, ${now}, ${now})
        ON CONFLICT ("gafanId", "schoolId")
        DO UPDATE SET "teacherIds" = EXCLUDED."teacherIds", "updatedAt" = EXCLUDED."updatedAt"
      `
    }
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/gafan error:", err)
    return Response.json({ error: "Failed to create gafan program" }, { status: 500 })
  }
})
