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

function isValidIsraeliId(raw: string): boolean {
  const digits = String(raw || "").replace(/\D/g, "")
  if (digits.length !== 9) return false
  let sum = 0
  for (let i = 0; i < 9; i += 1) {
    const n = Number(digits[i])
    const step = n * ((i % 2) + 1)
    sum += step > 9 ? step - 9 : step
  }
  return sum % 10 === 0
}

async function ensureStudentExtendedIdentityColumns(
  db: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>,
) {
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "firstName" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "lastName" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "gender" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "className" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "schoolName" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "parent1Name" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "parent1Relation" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "parent1Phone" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "parent1Email" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "parent1City" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "parent2Name" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "parent2Relation" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "parent2Phone" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "parent2Email" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "parent2City" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT`
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT`
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
      SELECT
        id, name, "firstName", "lastName", "gender", "className", "schoolName",
        email, phone, city, "birthDate", father, mother, "healthFund", allergies, "idNumber", "userId", "profileImage", "registrationInterest",
        "parent1Name", "parent1Relation", "parent1Phone", "parent1Email", "parent1City",
        "parent2Name", "parent2Relation", "parent2Phone", "parent2Email", "parent2City",
        "emergencyContactName", "emergencyContactPhone"
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
    const className = body.className ? String(body.className).trim() : null
    const schoolName = body.schoolName ? String(body.schoolName).trim() : null
    const parent1Name = body.parent1Name ? String(body.parent1Name).trim() : null
    const parent1Relation = body.parent1Relation ? String(body.parent1Relation).trim() : null
    const parent1Phone = body.parent1Phone ? String(body.parent1Phone).trim() : null
    const parent1Email = body.parent1Email ? String(body.parent1Email).trim() : null
    const parent1City = body.parent1City ? String(body.parent1City).trim() : null
    const parent2Name = body.parent2Name ? String(body.parent2Name).trim() : null
    const parent2Relation = body.parent2Relation ? String(body.parent2Relation).trim() : null
    const parent2Phone = body.parent2Phone ? String(body.parent2Phone).trim() : null
    const parent2Email = body.parent2Email ? String(body.parent2Email).trim() : null
    const parent2City = body.parent2City ? String(body.parent2City).trim() : null
    const emergencyContactName = body.emergencyContactName ? String(body.emergencyContactName).trim() : null
    const emergencyContactPhone = body.emergencyContactPhone ? String(body.emergencyContactPhone).trim() : null
    const phone = parent1Phone || (body.phone ? String(body.phone).trim() : null)
    const email = parent1Email || (body.email ? String(body.email).trim() : null)
    const city = parent1City || (body.city ? String(body.city).trim() : null)
    const father = parent1Name || (body.father ? String(body.father).trim() : null)
    const mother = parent2Name || (body.mother ? String(body.mother).trim() : null)
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
    if (!isValidIsraeliId(idNumber)) return Response.json({ error: "invalid idNumber" }, { status: 400 })
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
          "className" = ${className},
          "schoolName" = ${schoolName},
          "parent1Name" = ${parent1Name},
          "parent1Relation" = ${parent1Relation},
          "parent1Phone" = ${parent1Phone},
          "parent1Email" = ${parent1Email},
          "parent1City" = ${parent1City},
          "parent2Name" = ${parent2Name},
          "parent2Relation" = ${parent2Relation},
          "parent2Phone" = ${parent2Phone},
          "parent2Email" = ${parent2Email},
          "parent2City" = ${parent2City},
          "emergencyContactName" = ${emergencyContactName},
          "emergencyContactPhone" = ${emergencyContactPhone},
          email = ${email},
          phone = ${phone},
          city = ${city},
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
        id, name, email, phone, city, status, "birthDate", "idNumber", father, mother, "healthFund", allergies,
        "totalSessions", "courseIds", "courseSessions", "profileImage", "registrationInterest", "firstName", "lastName", "gender", "className", "schoolName",
        "parent1Name", "parent1Relation", "parent1Phone", "parent1Email", "parent1City",
        "parent2Name", "parent2Relation", "parent2Phone", "parent2Email", "parent2City",
        "emergencyContactName", "emergencyContactPhone",
        "userId", "createdAt", "updatedAt"
      )
      VALUES (
        ${studentId}, ${name}, ${email}, ${phone}, ${city}, 'מתעניין', ${birthDate}, ${idNumber}, ${father}, ${mother}, ${healthFund}, ${allergies},
        12, ${JSON.stringify(courseIds)}::jsonb, ${JSON.stringify({})}::jsonb, ${profileImageFallback}, ${interestStoredNew}, ${firstName || null}, ${lastName || null}, ${gender}, ${className}, ${schoolName},
        ${parent1Name}, ${parent1Relation}, ${parent1Phone}, ${parent1Email}, ${parent1City},
        ${parent2Name}, ${parent2Relation}, ${parent2Phone}, ${parent2Email}, ${parent2City},
        ${emergencyContactName}, ${emergencyContactPhone},
        ${userId}, ${now}, ${now}
      )
    `

    return Response.json({ success: true, existingStudent: false, studentId }, { status: 201 })
  } catch (err) {
    console.error("POST /api/register/student error:", err)
    return Response.json({ error: "Failed to register student" }, { status: 500 })
  }
}
