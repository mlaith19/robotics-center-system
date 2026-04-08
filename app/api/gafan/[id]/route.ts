import { requireFeatureFromRequest } from "@/lib/feature-gate"
import {
  ensureGafanLinkColumns,
  normalizeGafanTeacherIds,
  normalizeGafanWorkshopRows,
  normalizeGafanAllocatedHours,
  normalizeGafanHourRows,
} from "@/lib/gafan-columns"
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

function pickTeacherIdsForUpdate(body: Record<string, unknown>, existing: Record<string, unknown>): string[] {
  if (Object.prototype.hasOwnProperty.call(body, "teacherIds")) return normalizeGafanTeacherIds(body.teacherIds)
  return normalizeGafanTeacherIds(existing.teacherIds)
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
    const result = await db`SELECT * FROM "Gafan" WHERE id = ${id}`
    if (result.length === 0) return Response.json({ error: "Gafan program not found" }, { status: 404 })
    const links = await db`
      SELECT l."schoolId", s.name as "schoolName", COALESCE(l."teacherIds", '[]'::jsonb) as "teacherIds",
             COALESCE(l."workshopRows", '[]'::jsonb) as "workshopRows",
             COALESCE(l."allocatedHours", 0) as "allocatedHours",
             COALESCE(l."hourRows", '[]'::jsonb) as "hourRows"
      FROM "GafanSchoolLink" l
      LEFT JOIN "School" s ON s.id = l."schoolId"
      WHERE l."gafanId" = ${id}
      ORDER BY l."createdAt" ASC
    `
    const first = (links as Array<Record<string, unknown>>)[0] || null
    return Response.json({
      ...result[0],
      links,
      schoolId: first?.schoolId ?? result[0].schoolId ?? null,
      schoolName: first?.schoolName ?? null,
      teacherIds: first?.teacherIds ?? result[0].teacherIds ?? [],
      workshopRows: first?.workshopRows ?? [],
      allocatedHours: first?.allocatedHours ?? 0,
      hourRows: first?.hourRows ?? [],
    })
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
    const teacherIdsPut = pickTeacherIdsForUpdate(body, ex)
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
    if (schoolIdPut) {
      const workshopRows = normalizeGafanWorkshopRows(body.workshopRows)
      const allocatedHours = normalizeGafanAllocatedHours(body.allocatedHours)
      const hourRows = normalizeGafanHourRows(body.hourRows)
      const workshopRowsJson = db.json(workshopRows)
      const hourRowsJson = db.json(hourRows)
      await db`
        INSERT INTO "GafanSchoolLink" (
          "gafanId", "schoolId", "teacherIds", "workshopRows", "allocatedHours", "hourRows", "createdAt", "updatedAt"
        )
        VALUES (${id}, ${schoolIdPut}, ${teacherIdsJson}, ${workshopRowsJson}, ${allocatedHours}, ${hourRowsJson}, ${now}, ${now})
        ON CONFLICT ("gafanId", "schoolId")
        DO UPDATE SET
          "teacherIds" = EXCLUDED."teacherIds",
          "workshopRows" = EXCLUDED."workshopRows",
          "allocatedHours" = EXCLUDED."allocatedHours",
          "hourRows" = EXCLUDED."hourRows",
          "updatedAt" = EXCLUDED."updatedAt"
      `
    }
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
    await ensureGafanLinkColumns(db)
    const existingRows = await db`SELECT * FROM "Gafan" WHERE id = ${id}`
    if (existingRows.length === 0) return Response.json({ error: "Gafan program not found" }, { status: 404 })
    const ex = existingRows[0] as Record<string, unknown>
    const now = new Date().toISOString()
    const schoolIdPatch = pickSchoolId(body, ex)
    if (!schoolIdPatch) return Response.json({ error: "נדרש schoolId תקין" }, { status: 400 })

    if (body.unlink === true) {
      await db`DELETE FROM "GafanSchoolLink" WHERE "gafanId" = ${id} AND "schoolId" = ${schoolIdPatch}`
      return Response.json({ success: true })
    }

    const linkRows = await db`
      SELECT COALESCE("teacherIds", '[]'::jsonb) as "teacherIds",
             COALESCE("workshopRows", '[]'::jsonb) as "workshopRows",
             COALESCE("allocatedHours", 0) as "allocatedHours",
             COALESCE("hourRows", '[]'::jsonb) as "hourRows"
      FROM "GafanSchoolLink"
      WHERE "gafanId" = ${id} AND "schoolId" = ${schoolIdPatch}
      LIMIT 1
    `
    const isLinkOnlyAction =
      body.teacherIds === undefined &&
      body.addTeacherId === undefined &&
      body.workshopRows === undefined &&
      body.allocatedHours === undefined &&
      body.hourRows === undefined
    if (isLinkOnlyAction && linkRows.length > 0) {
      return Response.json({ success: true, alreadyLinked: true })
    }
    const existingTeachers = normalizeGafanTeacherIds(linkRows[0]?.teacherIds)
    const existingWorkshopRows = normalizeGafanWorkshopRows(linkRows[0]?.workshopRows)
    const existingAllocatedHours = normalizeGafanAllocatedHours(linkRows[0]?.allocatedHours)
    const existingHourRows = normalizeGafanHourRows(linkRows[0]?.hourRows)
    let nextTeacherIds = Object.prototype.hasOwnProperty.call(body, "teacherIds")
      ? normalizeGafanTeacherIds(body.teacherIds)
      : existingTeachers
    if (body.addTeacherId !== undefined && body.addTeacherId !== null && String(body.addTeacherId).trim()) {
      const addId = String(body.addTeacherId).trim()
      if (!nextTeacherIds.includes(addId)) nextTeacherIds = [...nextTeacherIds, addId]
    }
    const teacherIdsJson = db.json(nextTeacherIds)
    const nextWorkshopRows = Object.prototype.hasOwnProperty.call(body, "workshopRows")
      ? normalizeGafanWorkshopRows(body.workshopRows)
      : existingWorkshopRows
    const nextAllocatedHours = Object.prototype.hasOwnProperty.call(body, "allocatedHours")
      ? normalizeGafanAllocatedHours(body.allocatedHours)
      : existingAllocatedHours
    const nextHourRows = Object.prototype.hasOwnProperty.call(body, "hourRows")
      ? normalizeGafanHourRows(body.hourRows)
      : existingHourRows
    const workshopRowsJson = db.json(nextWorkshopRows)
    const hourRowsJson = db.json(nextHourRows)

    await db`
      INSERT INTO "GafanSchoolLink" (
        "gafanId", "schoolId", "teacherIds", "workshopRows", "allocatedHours", "hourRows", "createdAt", "updatedAt"
      )
      VALUES (${id}, ${schoolIdPatch}, ${teacherIdsJson}, ${workshopRowsJson}, ${nextAllocatedHours}, ${hourRowsJson}, ${now}, ${now})
      ON CONFLICT ("gafanId", "schoolId")
      DO UPDATE SET
        "teacherIds" = EXCLUDED."teacherIds",
        "workshopRows" = EXCLUDED."workshopRows",
        "allocatedHours" = EXCLUDED."allocatedHours",
        "hourRows" = EXCLUDED."hourRows",
        "updatedAt" = EXCLUDED."updatedAt"
    `

    const links = await db`
      SELECT l."schoolId", s.name as "schoolName", COALESCE(l."teacherIds", '[]'::jsonb) as "teacherIds",
             COALESCE(l."workshopRows", '[]'::jsonb) as "workshopRows",
             COALESCE(l."allocatedHours", 0) as "allocatedHours",
             COALESCE(l."hourRows", '[]'::jsonb) as "hourRows"
      FROM "GafanSchoolLink" l
      LEFT JOIN "School" s ON s.id = l."schoolId"
      WHERE l."gafanId" = ${id}
      ORDER BY l."createdAt" ASC
    `
    const first = (links as Array<Record<string, unknown>>)[0] || null
    return Response.json({
      ...ex,
      links,
      schoolId: first?.schoolId ?? ex.schoolId ?? null,
      schoolName: first?.schoolName ?? null,
      teacherIds: first?.teacherIds ?? ex.teacherIds ?? [],
      workshopRows: first?.workshopRows ?? [],
      allocatedHours: first?.allocatedHours ?? 0,
      hourRows: first?.hourRows ?? [],
    })
  } catch (err) {
    console.error("PATCH /api/gafan/[id] error:", err)
    return Response.json({ error: "Failed to update gafan program" }, { status: 500 })
  }
})
