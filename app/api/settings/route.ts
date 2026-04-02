import { handleDbError } from "@/lib/db"
import { NextResponse } from "next/server"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"

const DEFAULT_SETTINGS_JSON = {
  id: 1,
  center_name: "",
  logo: "",
  phone: "",
  whatsapp: "",
  address: "",
  email: "",
  website: "",
  working_hours: "",
  notes: "",
  tax_id: "",
  lesson_price: 0,
  monthly_price: 0,
  registration_fee: 0,
  discount_siblings: 0,
  max_students_per_class: 0,
  camp_classrooms_count: 6,
}

export const GET = withTenantAuth(async (req, _session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    const settings = await db`SELECT * FROM center_settings WHERE id = 1`
    if (settings.length === 0) {
      return NextResponse.json(DEFAULT_SETTINGS_JSON)
    }
    const row = settings[0] as Record<string, unknown>
    return NextResponse.json({ ...DEFAULT_SETTINGS_JSON, ...row })
  } catch (error) {
    return handleDbError(error, "GET /api/settings")
  }
})

function isMissingColumnError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /column.*does not exist|tax_id/i.test(msg)
}

export const PUT = withTenantAuth(async (req, _session) => {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    await db`ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS camp_classrooms_count INTEGER NOT NULL DEFAULT 6`
    const body = await req.json()
    const {
      center_name,
      logo,
      phone,
      whatsapp,
      address,
      email,
      website,
      working_hours,
      notes,
      tax_id,
      lesson_price,
      monthly_price,
      registration_fee,
      discount_siblings,
      max_students_per_class,
      camp_classrooms_count,
    } = body

    const existing = await db`SELECT id FROM center_settings WHERE id = 1`
    const runSave = (withTaxId: boolean) => {
      if (existing.length === 0) {
        if (withTaxId) {
          return db`
            INSERT INTO center_settings (
              id, center_name, logo, phone, whatsapp, address,
              email, website, working_hours, notes, tax_id,
              lesson_price, monthly_price, registration_fee,
              discount_siblings, max_students_per_class
              , camp_classrooms_count
            )
            VALUES (
              1, ${center_name ?? ""}, ${logo ?? ""}, ${phone ?? ""}, ${whatsapp ?? ""}, ${address ?? ""},
              ${email || null}, ${website || null}, ${working_hours || null}, ${notes || null}, ${tax_id ?? ""},
              ${lesson_price ?? 0}, ${monthly_price ?? 0}, ${registration_fee ?? 0},
              ${discount_siblings ?? 0}, ${max_students_per_class ?? 0}
              , ${camp_classrooms_count ?? 6}
            )
            RETURNING *
          `
        }
        return db`
          INSERT INTO center_settings (
            id, center_name, logo, phone, whatsapp, address,
            email, website, working_hours, notes,
            lesson_price, monthly_price, registration_fee,
            discount_siblings, max_students_per_class
            , camp_classrooms_count
          )
          VALUES (
            1, ${center_name ?? ""}, ${logo ?? ""}, ${phone ?? ""}, ${whatsapp ?? ""}, ${address ?? ""},
            ${email || null}, ${website || null}, ${working_hours || null}, ${notes || null},
            ${lesson_price ?? 0}, ${monthly_price ?? 0}, ${registration_fee ?? 0},
            ${discount_siblings ?? 0}, ${max_students_per_class ?? 0}
            , ${camp_classrooms_count ?? 6}
          )
          RETURNING *
        `
      }
      if (withTaxId) {
        return db`
          UPDATE center_settings
          SET center_name = ${center_name ?? ""}, logo = ${logo ?? ""}, phone = ${phone ?? ""},
              whatsapp = ${whatsapp ?? ""}, address = ${address ?? ""},
              email = ${email || null}, website = ${website || null}, working_hours = ${working_hours || null}, notes = ${notes || null},
              tax_id = ${tax_id ?? ""},
              lesson_price = ${lesson_price ?? 0}, monthly_price = ${monthly_price ?? 0},
              registration_fee = ${registration_fee ?? 0},
              discount_siblings = ${discount_siblings ?? 0}, max_students_per_class = ${max_students_per_class ?? 0},
              camp_classrooms_count = ${camp_classrooms_count ?? 6},
              updated_at = NOW()
          WHERE id = 1
          RETURNING *
        `
      }
      return db`
        UPDATE center_settings
        SET center_name = ${center_name ?? ""}, logo = ${logo ?? ""}, phone = ${phone ?? ""},
            whatsapp = ${whatsapp ?? ""}, address = ${address ?? ""},
            email = ${email || null}, website = ${website || null}, working_hours = ${working_hours || null}, notes = ${notes || null},
            lesson_price = ${lesson_price ?? 0}, monthly_price = ${monthly_price ?? 0},
            registration_fee = ${registration_fee ?? 0},
            discount_siblings = ${discount_siblings ?? 0}, max_students_per_class = ${max_students_per_class ?? 0},
            camp_classrooms_count = ${camp_classrooms_count ?? 6},
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `
    }

    try {
      const result = await runSave(true)
      return NextResponse.json(result[0])
    } catch (firstErr) {
      if (isMissingColumnError(firstErr)) {
        const result = await runSave(false)
        const row = result[0] as Record<string, unknown>
        return NextResponse.json({ ...row, tax_id: tax_id ?? "" })
      }
      throw firstErr
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (process.env.NODE_ENV !== "production" && msg) {
      return NextResponse.json(
        { error: "שגיאה בשמירה", message: msg },
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
    return handleDbError(error, "PUT /api/settings")
  }
})

// שמירה עובדת גם ב-POST (כשבפרונט אין עדיין id)
export const POST = PUT
