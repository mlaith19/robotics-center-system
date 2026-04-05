import { withTenantAuth } from "@/lib/tenant-api-auth"
import { ensureSessionMatchesTenant, requireTenant } from "@/lib/tenant/resolve-tenant"
import { requirePerm, requireAnyPerm } from "@/lib/require-perm"
import { ensureTeacherTariffTables, normalizeTariffProfilePayload } from "@/lib/teacher-tariff-profiles"

export const GET = withTenantAuth(async (req, session) => {
  const permErr = requireAnyPerm(session, ["settings.view", "courses.edit"])
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch

  const db = tenant.db
  try {
    await ensureTeacherTariffTables(db)
    const activeOnly = new URL(req.url).searchParams.get("activeOnly") === "1"
    const rows = activeOnly
      ? await db`
          SELECT * FROM "TeacherTariffProfile"
          WHERE "isActive" = TRUE
          ORDER BY "name" ASC
        `
      : await db`
          SELECT * FROM "TeacherTariffProfile"
          ORDER BY "isActive" DESC, "name" ASC
        `
    return Response.json(rows)
  } catch (err) {
    console.error("GET /api/teacher-tariff-profiles error:", err)
    return Response.json({ error: "Failed to load tariff profiles" }, { status: 500 })
  }
})

export const POST = withTenantAuth(async (req, session) => {
  const permErr = requirePerm(session, "settings.edit")
  if (permErr) return permErr

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const mismatch = ensureSessionMatchesTenant(session, tenant)
  if (mismatch) return mismatch

  const db = tenant.db
  try {
    await ensureTeacherTariffTables(db)
    const body = await req.json()
    const payload = normalizeTariffProfilePayload(body)
    if (!payload.name) {
      return Response.json({ error: "שם פרופיל תעריף הוא שדה חובה" }, { status: 400 })
    }
    const id = crypto.randomUUID()
    const result = await db`
      INSERT INTO "TeacherTariffProfile" (
        id, name, description, "pricingMethod", "centerHourlyRate", "travelRate", "externalCourseRate", "officeHourlyRate",
        "studentTierRates", "bonusEnabled", "bonusMinStudents", "bonusPerHour", "isActive", "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${payload.name}, ${payload.description}, ${payload.pricingMethod},
        ${payload.centerHourlyRate}, ${payload.travelRate}, ${payload.externalCourseRate}, ${payload.officeHourlyRate},
        ${JSON.stringify(payload.studentTierRates)}::jsonb,
        ${payload.bonusEnabled}, ${payload.bonusMinStudents}, ${payload.bonusPerHour},
        ${payload.isActive}, NOW(), NOW()
      )
      RETURNING *
    `
    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/teacher-tariff-profiles error:", err)
    return Response.json({ error: "Failed to create tariff profile" }, { status: 500 })
  }
})
