import { withTenantAuth } from "@/lib/tenant-api-auth"
import { ensureSessionMatchesTenant, requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm } from "@/lib/require-perm"
import { ensureTeacherTariffTables, normalizeTariffProfilePayload } from "@/lib/teacher-tariff-profiles"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "settings.edit")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch

  const db = tenant.db
  const { id } = await params
  try {
    await ensureTeacherTariffTables(db)
    const body = await req.json()
    const payload = normalizeTariffProfilePayload(body)
    if (!payload.name) {
      return Response.json({ error: "שם פרופיל תעריף הוא שדה חובה" }, { status: 400 })
    }

    const result = await db`
      UPDATE "TeacherTariffProfile"
      SET
        name = ${payload.name},
        description = ${payload.description},
        "pricingMethod" = ${payload.pricingMethod},
        "centerHourlyRate" = ${payload.centerHourlyRate},
        "travelRate" = ${payload.travelRate},
        "externalCourseRate" = ${payload.externalCourseRate},
        "studentTierRates" = ${JSON.stringify(payload.studentTierRates)}::jsonb,
        "bonusEnabled" = ${payload.bonusEnabled},
        "bonusMinStudents" = ${payload.bonusMinStudents},
        "bonusPerHour" = ${payload.bonusPerHour},
        "isActive" = ${payload.isActive},
        "updatedAt" = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (!result.length) return Response.json({ error: "Profile not found" }, { status: 404 })
    return Response.json(result[0])
  } catch (err) {
    console.error("PATCH /api/teacher-tariff-profiles/[id] error:", err)
    return Response.json({ error: "Failed to update tariff profile" }, { status: 500 })
  }
})

export const DELETE = withTenantAuth(async (req, session, { params }: Ctx) => {
  const permErr = requirePerm(session, "settings.edit")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch

  const db = tenant.db
  const { id } = await params
  try {
    await ensureTeacherTariffTables(db)
    const used = await db`
      SELECT 1 FROM "CourseTeacherTariff" WHERE "tariffProfileId" = ${id} LIMIT 1
    `
    if (used.length > 0) {
      return Response.json(
        { error: "לא ניתן למחוק — הפרופיל משויך לקורסים. הסר שיוך או החלף פרופיל בקורס." },
        { status: 409 },
      )
    }
    const result = await db`DELETE FROM "TeacherTariffProfile" WHERE id = ${id} RETURNING id`
    if (!result.length) return Response.json({ error: "Profile not found" }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/teacher-tariff-profiles/[id] error:", err)
    return Response.json({ error: "Failed to delete tariff profile" }, { status: 500 })
  }
})
