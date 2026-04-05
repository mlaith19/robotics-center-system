import { requireFeatureFromRequest } from "@/lib/feature-gate"
import { ensureGafanLinkColumns, normalizeGafanTeacherIds } from "@/lib/gafan-columns"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"

type Ctx = { params: Promise<{ id: string }> }

function pickSchoolId(body: Record<string, unknown>, existing: Record<string, unknown> | undefined): string | null {
  if (!Object.prototype.hasOwnProperty.call(body, "schoolId") && !Object.prototype.hasOwnProperty.call(body, "school_id")) {
    const v = existing?.schoolId
    return v != null && String(v).trim() ? String(v).trim() : null
  }
  const raw = body.schoolId ?? body.school_id
  if (raw === undefined || raw === null || raw === "") return null
  const s = String(raw).trim()
  return s || null
}

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
    await ensureGafanLinkColumns(db)
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
    await ensureGafanLinkColumns(db)
    const body = (await req.json()) as Record<string, unknown>
    const existingRows = await db`SELECT * FROM "Gafan" WHERE id = ${id}`
    if (existingRows.length === 0) return Response.json({ error: "Gafan program not found" }, { status: 404 })
    const ex = existingRows[0] as Record<string, unknown>
    const now = new Date().toISOString()
    const schoolIdPut = pickSchoolId(body, ex)
    const teacherIdsPut = Object.prototype.hasOwnProperty.call(body, "teacherIds")
      ? normalizeGafanTeacherIds(body.teacherIds)
      : normalizeGafanTeacherIds(ex.teacherIds)
    const teacherIdsJson = db.json(teacherIdsPut)
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
        "schoolId"        = ${schoolIdPut},
        "teacherIds"      = ${teacherIdsJson},
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

/** עדכון חלקי: שיוך בית ספר ו/או מורים (מסך בית ספר) */
export const PATCH = withTenantAuth(async (req, session, { params }: Ctx) => {
  const featureErr = await requireFeatureFromRequest(req, "gafan", session)
  if (featureErr) return featureErr
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch
  const db = tenant.db
  const { id } = await params
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid body" }, { status: 400 })
    }
    if (body.schoolId === undefined && body.school_id === undefined && body.teacherIds === undefined) {
      return Response.json({ error: "נדרש schoolId או teacherIds" }, { status: 400 })
    }
    await ensureGafanLinkColumns(db)
    const existingRows = await db`SELECT * FROM "Gafan" WHERE id = ${id}`
    if (existingRows.length === 0) return Response.json({ error: "Gafan program not found" }, { status: 404 })
    const ex = existingRows[0] as Record<string, unknown>
    const now = new Date().toISOString()
    const schoolIdPatch = pickSchoolId(body, ex)
    const teacherIdsPatch = Object.prototype.hasOwnProperty.call(body, "teacherIds")
      ? normalizeGafanTeacherIds(body.teacherIds)
      : normalizeGafanTeacherIds(ex.teacherIds)
    const teacherIdsJson = db.json(teacherIdsPatch)
    await db`
      UPDATE "Gafan"
      SET
        "schoolId" = ${schoolIdPatch},
        "teacherIds" = ${teacherIdsJson},
        "updatedAt" = ${now}
      WHERE id = ${id}
    `
    const result = await db`
      SELECT g.*, s.name as "schoolName"
      FROM "Gafan" g
      LEFT JOIN "School" s ON g."schoolId" = s.id
      WHERE g.id = ${id}
    `
    return Response.json(result[0])
  } catch (err) {
    console.error("PATCH /api/gafan/[id] error:", err)
    return Response.json({ error: "Failed to update gafan program" }, { status: 500 })
  }
})
