import { requireFeatureFromRequest } from "@/lib/feature-gate"
import {
  ensureGafanLinkColumns,
  normalizeGafanTeacherIds,
  normalizeGafanTeacherRates,
  normalizeGafanWorkshopRows,
  normalizeGafanAllocatedHours,
  normalizeGafanHourRows,
} from "@/lib/gafan-columns"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant, ensureSessionMatchesTenant } from "@/lib/tenant/resolve-tenant"

type Ctx = { params: Promise<{ id: string }> }
const DEFAULT_GAFAN_TEACHING_HOURLY_RATE = 50
const DEFAULT_GAFAN_TRAVEL_HOURLY_RATE = 30

function normalizePersonName(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/["'`׳״]/g, "")
    .replace(/\s+/g, " ")
}

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

function pickTeacherRatesForUpdate(
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
): Record<string, { teachingHourlyRate: number; officeHourlyRate: number }> {
  if (Object.prototype.hasOwnProperty.call(body, "teacherRates")) return normalizeGafanTeacherRates(body.teacherRates)
  return normalizeGafanTeacherRates(existing.teacherRates)
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
      SELECT l."id" as "linkId", l."schoolId", s.name as "schoolName", COALESCE(l."teacherIds", '[]'::jsonb) as "teacherIds",
             COALESCE(l."teacherRates", '{}'::jsonb) as "teacherRates",
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
      linkId: first?.linkId ?? null,
      schoolName: first?.schoolName ?? null,
      teacherIds: first?.teacherIds ?? result[0].teacherIds ?? [],
      teacherRates: first?.teacherRates ?? {},
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
    const teacherRatesPut = pickTeacherRatesForUpdate(body, ex)
    const teacherIdsJson = db.json(teacherIdsPut)
    const teacherRatesJson = db.json(teacherRatesPut)
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
      const existingLinkRows = await db`
        SELECT "id"
        FROM "GafanSchoolLink"
        WHERE "gafanId" = ${id} AND "schoolId" = ${schoolIdPut}
        ORDER BY "createdAt" ASC
        LIMIT 1
      `
      if (existingLinkRows.length > 0) {
        const existingLinkId = String((existingLinkRows[0] as { id?: string | null }).id || "")
        if (existingLinkId) {
          await db`
            UPDATE "GafanSchoolLink"
            SET
              "teacherIds" = ${teacherIdsJson},
              "teacherRates" = ${teacherRatesJson},
              "workshopRows" = ${workshopRowsJson},
              "allocatedHours" = ${allocatedHours},
              "hourRows" = ${hourRowsJson},
              "updatedAt" = ${now}
            WHERE "id" = ${existingLinkId}
          `
        }
      } else {
        const newLinkId = crypto.randomUUID()
        await db`
          INSERT INTO "GafanSchoolLink" (
            "id", "gafanId", "schoolId", "teacherIds", "teacherRates", "workshopRows", "allocatedHours", "hourRows", "createdAt", "updatedAt"
          )
          VALUES (${newLinkId}, ${id}, ${schoolIdPut}, ${teacherIdsJson}, ${teacherRatesJson}, ${workshopRowsJson}, ${allocatedHours}, ${hourRowsJson}, ${now}, ${now})
        `
      }
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
    const linkIdPatch =
      body.linkId !== undefined && body.linkId !== null && String(body.linkId).trim()
        ? String(body.linkId).trim()
        : ""
    if (!schoolIdPatch) return Response.json({ error: "נדרש schoolId תקין" }, { status: 400 })

    if (body.unlink === true) {
      if (linkIdPatch) {
        await db`DELETE FROM "GafanSchoolLink" WHERE "id" = ${linkIdPatch} AND "gafanId" = ${id} AND "schoolId" = ${schoolIdPatch}`
      } else {
        await db`DELETE FROM "GafanSchoolLink" WHERE "gafanId" = ${id} AND "schoolId" = ${schoolIdPatch}`
      }
      return Response.json({ success: true })
    }

    const linkRows = linkIdPatch
      ? await db`
          SELECT "id", COALESCE("teacherIds", '[]'::jsonb) as "teacherIds",
                 COALESCE("teacherRates", '{}'::jsonb) as "teacherRates",
                 COALESCE("workshopRows", '[]'::jsonb) as "workshopRows",
                 COALESCE("allocatedHours", 0) as "allocatedHours",
                 COALESCE("hourRows", '[]'::jsonb) as "hourRows"
          FROM "GafanSchoolLink"
          WHERE "id" = ${linkIdPatch} AND "gafanId" = ${id} AND "schoolId" = ${schoolIdPatch}
          LIMIT 1
        `
      : await db`
          SELECT "id", COALESCE("teacherIds", '[]'::jsonb) as "teacherIds",
                 COALESCE("teacherRates", '{}'::jsonb) as "teacherRates",
                 COALESCE("workshopRows", '[]'::jsonb) as "workshopRows",
                 COALESCE("allocatedHours", 0) as "allocatedHours",
                 COALESCE("hourRows", '[]'::jsonb) as "hourRows"
          FROM "GafanSchoolLink"
          WHERE "gafanId" = ${id} AND "schoolId" = ${schoolIdPatch}
          ORDER BY "createdAt" ASC
          LIMIT 1
        `
    const isLinkOnlyAction =
      body.teacherIds === undefined &&
      body.teacherRates === undefined &&
      body.addTeacherId === undefined &&
      body.workshopRows === undefined &&
      body.allocatedHours === undefined &&
      body.hourRows === undefined
    if (isLinkOnlyAction) {
      // Link-only action: always create a new assignment row for this school.
      const newLinkId = crypto.randomUUID()
      await db`
        INSERT INTO "GafanSchoolLink" (
          "id", "gafanId", "schoolId", "teacherIds", "teacherRates", "workshopRows", "allocatedHours", "hourRows", "createdAt", "updatedAt"
        )
        VALUES (
          ${newLinkId}, ${id}, ${schoolIdPatch}, ${db.json([])}, ${db.json({})}, ${db.json([])}, ${0}, ${db.json([])}, ${now}, ${now}
        )
      `
      const created = await db`
        SELECT g.*, l."id" as "linkId", l."schoolId", s.name as "schoolName", COALESCE(l."teacherIds", '[]'::jsonb) as "teacherIds",
               COALESCE(l."teacherRates", '{}'::jsonb) as "teacherRates",
               COALESCE(l."workshopRows", '[]'::jsonb) as "workshopRows", COALESCE(l."allocatedHours", 0) as "allocatedHours",
               COALESCE(l."hourRows", '[]'::jsonb) as "hourRows"
        FROM "Gafan" g
        INNER JOIN "GafanSchoolLink" l ON l."gafanId" = g.id
        LEFT JOIN "School" s ON s.id = l."schoolId"
        WHERE g.id = ${id} AND l."id" = ${newLinkId}
      `
      return Response.json(created[0] ?? { success: true, linkId: newLinkId })
    }
    const existingTeachers = normalizeGafanTeacherIds(linkRows[0]?.teacherIds)
    const existingTeacherRates = normalizeGafanTeacherRates(linkRows[0]?.teacherRates)
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
    let nextTeacherRates = Object.prototype.hasOwnProperty.call(body, "teacherRates")
      ? normalizeGafanTeacherRates(body.teacherRates)
      : existingTeacherRates
    for (const tid of nextTeacherIds) {
      if (!nextTeacherRates[tid]) {
        nextTeacherRates = {
          ...nextTeacherRates,
          [tid]: {
            teachingHourlyRate: DEFAULT_GAFAN_TEACHING_HOURLY_RATE,
            travelHourlyRate: DEFAULT_GAFAN_TRAVEL_HOURLY_RATE,
          },
        }
      }
    }
    for (const tid of Object.keys(nextTeacherRates)) {
      if (!nextTeacherIds.includes(tid)) delete nextTeacherRates[tid]
    }
    const teacherIdsJson = db.json(nextTeacherIds)
    const teacherRatesJson = db.json(nextTeacherRates)
    const nextWorkshopRows = Object.prototype.hasOwnProperty.call(body, "workshopRows")
      ? normalizeGafanWorkshopRows(body.workshopRows)
      : existingWorkshopRows
    const nextAllocatedHours = Object.prototype.hasOwnProperty.call(body, "allocatedHours")
      ? normalizeGafanAllocatedHours(body.allocatedHours)
      : existingAllocatedHours
    const nextHourRows = Object.prototype.hasOwnProperty.call(body, "hourRows")
      ? normalizeGafanHourRows(body.hourRows)
      : existingHourRows

    const hourRowFingerprint = (row: ReturnType<typeof normalizeGafanHourRows>[number]) =>
      [
        String(row.date || "").trim(),
        String(row.startTime || "").trim(),
        String(row.endTime || "").trim(),
        String(row.teacherId || "").trim(),
        normalizePersonName(row.teacherName),
        String(Number(row.totalHours || 0)),
        row.pendingAssignment ? "pending" : "approved",
      ].join("|")

    // Guardrail: approved hour rows must belong to teachers assigned to this specific program link.
    // Important: allow unchanged legacy rows to remain, so admin can still edit/clean data gradually.
    if (Object.prototype.hasOwnProperty.call(body, "hourRows")) {
      const assignedTeacherIds = new Set(nextTeacherIds.map((tid) => String(tid || "").trim()).filter(Boolean))
      const assignedTeacherNames = new Set<string>()
      if (assignedTeacherIds.size > 0) {
        const teacherRows = await db<{ id: string; name: string | null }[]>`
          SELECT id, name
          FROM "Teacher"
          WHERE id = ANY(${Array.from(assignedTeacherIds)}::text[])
        `
        for (const t of teacherRows) {
          const normalizedName = normalizePersonName(t.name)
          if (normalizedName) assignedTeacherNames.add(normalizedName)
        }
      }

      const existingRowFpSet = new Set(existingHourRows.map((row) => hourRowFingerprint(row)))
      const invalidRow = nextHourRows.find((row) => {
        // Pending rows may temporarily be unassigned.
        if (row.pendingAssignment === true) return false
        const rowTeacherId = String(row.teacherId || "").trim()
        const rowTeacherName = normalizePersonName(row.teacherName)
        const belongsById = rowTeacherId ? assignedTeacherIds.has(rowTeacherId) : false
        const belongsByName = rowTeacherName ? assignedTeacherNames.has(rowTeacherName) : false
        if (belongsById || belongsByName) return false
        // Keep backward compatibility: if this exact row already existed, do not block unrelated edits.
        return !existingRowFpSet.has(hourRowFingerprint(row))
      })
      if (invalidRow) {
        return Response.json(
          { error: "לא ניתן לאשר נוכחות למורה שאינו משויך לתוכנית זו" },
          { status: 400 },
        )
      }
    }
    const workshopRowsJson = db.json(nextWorkshopRows)
    const hourRowsJson = db.json(nextHourRows)

    if (linkRows.length > 0) {
      const targetId = String((linkRows[0] as Record<string, unknown>).id || "")
      await db`
        UPDATE "GafanSchoolLink"
        SET
          "teacherIds" = ${teacherIdsJson},
          "teacherRates" = ${teacherRatesJson},
          "workshopRows" = ${workshopRowsJson},
          "allocatedHours" = ${nextAllocatedHours},
          "hourRows" = ${hourRowsJson},
          "updatedAt" = ${now}
        WHERE "id" = ${targetId} AND "gafanId" = ${id} AND "schoolId" = ${schoolIdPatch}
      `
    } else {
      const newLinkId = crypto.randomUUID()
      await db`
        INSERT INTO "GafanSchoolLink" (
          "id", "gafanId", "schoolId", "teacherIds", "teacherRates", "workshopRows", "allocatedHours", "hourRows", "createdAt", "updatedAt"
        )
        VALUES (${newLinkId}, ${id}, ${schoolIdPatch}, ${teacherIdsJson}, ${teacherRatesJson}, ${workshopRowsJson}, ${nextAllocatedHours}, ${hourRowsJson}, ${now}, ${now})
      `
    }

    const links = await db`
      SELECT l."id" as "linkId", l."schoolId", s.name as "schoolName", COALESCE(l."teacherIds", '[]'::jsonb) as "teacherIds",
             COALESCE(l."teacherRates", '{}'::jsonb) as "teacherRates",
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
      linkId: first?.linkId ?? null,
      schoolId: first?.schoolId ?? ex.schoolId ?? null,
      schoolName: first?.schoolName ?? null,
      teacherIds: first?.teacherIds ?? ex.teacherIds ?? [],
      teacherRates: first?.teacherRates ?? {},
      workshopRows: first?.workshopRows ?? [],
      allocatedHours: first?.allocatedHours ?? 0,
      hourRows: first?.hourRows ?? [],
    })
  } catch (err) {
    console.error("PATCH /api/gafan/[id] error:", err)
    return Response.json({ error: "Failed to update gafan program" }, { status: 500 })
  }
})
