import bcrypt from "bcryptjs"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { ensureProfileImageColumns, normalizeProfileImageInput, resolveProfileImageWithFallback } from "@/lib/profile-image"
import { ensureStudentRegistrationInterestColumn } from "@/lib/student-registration-interest"

function normalizeBirthDateInput(raw: unknown): string | null {
  const value = typeof raw === "string" ? raw.trim() : ""
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const m = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/)
  if (!m) return null
  const dd = m[1].padStart(2, "0")
  const mm = m[2].padStart(2, "0")
  const yyyy = m[3]
  return `${yyyy}-${mm}-${dd}`
}

function uniqueCourseIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : []
  const ids = list.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim())
  return [...new Set(ids)]
}

async function ensureStudentExtendedIdentityColumns(
  db: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>,
) {
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "firstName" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "lastName" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "gender" TEXT`
}

export async function GET(req: Request) {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db
  try {
    await ensureStudentRegistrationInterestColumn(db)
    await ensureStudentExtendedIdentityColumns(db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>)
    const url = new URL(req.url)
    const idNumber = String(url.searchParams.get("idNumber") ?? "").trim()
    if (!idNumber) return Response.json({ error: "idNumber is required" }, { status: 400 })

    const rows = await db`
      SELECT id, name, "firstName", "lastName", "gender", email, phone, "birthDate", father, mother, "healthFund", allergies, "idNumber", "userId", "profileImage", "registrationInterest"
      FROM "Student"
      WHERE "idNumber" = ${idNumber}
      LIMIT 1
    `
    if (rows.length === 0) return Response.json({ found: false })
    return Response.json({ found: true, student: rows[0] })
  } catch (err) {
    console.error("GET /api/register/student error:", err)
    return Response.json({ error: "Failed to lookup student" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db

  try {
    const body = await req.json()
    await ensureProfileImageColumns(db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>)
    await ensureStudentRegistrationInterestColumn(db)
    await ensureStudentExtendedIdentityColumns(db as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>)
    const firstName = String(body.firstName ?? "").trim()
    const lastName = String(body.lastName ?? "").trim()
    const name = [firstName, lastName].filter(Boolean).join(" ").trim() || String(body.name ?? "").trim()
    const idNumber = String(body.idNumber ?? "").trim()
    const gender = body.gender ? String(body.gender).trim() : null
    const phone = body.phone ? String(body.phone).trim() : null
    const email = body.email ? String(body.email).trim() : null
    const father = body.father ? String(body.father).trim() : null
    const mother = body.mother ? String(body.mother).trim() : null
    const healthFund = body.healthFund ? String(body.healthFund).trim() : null
    const allergies = body.allergies ? String(body.allergies).trim() : null
    const birthDate = normalizeBirthDateInput(body.birthDate)
    const profileImageInput = normalizeProfileImageInput(body.profileImage)
    const profileImageFallback = resolveProfileImageWithFallback(body.profileImage)
    const courseIds = uniqueCourseIds(body.courseIds)
    const registrationInterestRaw = String(body.registrationInterest ?? "").trim()
    const now = new Date().toISOString()

    if (!name) return Response.json({ error: "name is required" }, { status: 400 })
    if (!idNumber) return Response.json({ error: "idNumber is required" }, { status: 400 })
    if (!phone || phone.length < 4) return Response.json({ error: "phone is required" }, { status: 400 })

    const existing = await db`
      SELECT id, "userId", "courseIds"
      FROM "Student"
      WHERE "idNumber" = ${idNumber}
      LIMIT 1
    `

    if (existing.length > 0) {
      const row = existing[0] as { id: string; userId?: string | null; courseIds?: unknown }
      const currentCourseIds = uniqueCourseIds(row.courseIds)
      const mergedCourseIds = [...new Set([...currentCourseIds, ...courseIds])]
      const interestStored = mergedCourseIds.length > 0 ? null : registrationInterestRaw || null
      if (mergedCourseIds.length === 0 && registrationInterestRaw.length < 2) {
        return Response.json(
          {
            error: "כשאין קורס ספציפי יש לציין באיזה תחום או קורס מתעניינים",
            code: "registration.interest_required",
          },
          { status: 400 },
        )
      }

      await db`
        UPDATE "Student"
        SET
          name = ${name},
          "firstName" = ${firstName || null},
          "lastName" = ${lastName || null},
          "gender" = ${gender},
          email = ${email},
          phone = ${phone},
          father = ${father},
          mother = ${mother},
          "birthDate" = ${birthDate},
          "healthFund" = ${healthFund},
          allergies = ${allergies},
          status = 'מתעניין',
          "profileImage" = COALESCE(${profileImageInput}, "profileImage", ${profileImageFallback}),
          "courseIds" = ${JSON.stringify(mergedCourseIds)}::jsonb,
          "registrationInterest" = ${interestStored},
          "updatedAt" = ${now}
        WHERE id = ${row.id}
      `

      if (row.userId) {
        await db`
          UPDATE "User"
          SET status = 'disabled', "updatedAt" = ${now}
          WHERE id = ${row.userId}
        `
      }

      return Response.json({ success: true, existingStudent: true, studentId: row.id })
    }

    const interestStoredNew = courseIds.length > 0 ? null : registrationInterestRaw || null
    if (courseIds.length === 0 && registrationInterestRaw.length < 2) {
      return Response.json(
        {
          error: "כשאין קורס ספציפי יש לציין באיזה תחום או קורס מתעניינים",
          code: "registration.interest_required",
        },
        { status: 400 },
      )
    }

    const username = idNumber
    const password = phone
    const existingByUsername = await db`SELECT id FROM "User" WHERE LOWER(username) = LOWER(${username}) LIMIT 1`
    if (existingByUsername.length > 0) {
      return Response.json({ error: "שם המשתמש כבר קיים במערכת" }, { status: 409 })
    }

    const userId = crypto.randomUUID()
    const studentId = crypto.randomUUID()
    const hashedPassword = await bcrypt.hash(password, 10)

    await db`
      INSERT INTO "User" (id, name, email, username, password, phone, status, role, permissions, "createdAt", "updatedAt")
      VALUES (${userId}, ${name}, ${email}, ${username}, ${hashedPassword}, ${phone}, 'disabled', 'student',
              ${JSON.stringify(["settings.home", "schedule.view"])}, ${now}, ${now})
    `

    await db`
      INSERT INTO "Student" (
        id, name, email, phone, status, "birthDate", "idNumber", father, mother, "healthFund", allergies,
        "totalSessions", "courseIds", "courseSessions", "profileImage", "registrationInterest", "firstName", "lastName", "gender", "userId", "createdAt", "updatedAt"
      )
      VALUES (
        ${studentId}, ${name}, ${email}, ${phone}, 'מתעניין', ${birthDate}, ${idNumber}, ${father}, ${mother}, ${healthFund}, ${allergies},
        12, ${JSON.stringify(courseIds)}::jsonb, ${JSON.stringify({})}::jsonb, ${profileImageFallback}, ${interestStoredNew}, ${firstName || null}, ${lastName || null}, ${gender}, ${userId}, ${now}, ${now}
      )
    `

    return Response.json({ success: true, existingStudent: false, studentId }, { status: 201 })
  } catch (err) {
    console.error("POST /api/register/student error:", err)
    return Response.json({ error: "Failed to register student" }, { status: 500 })
  }
}
