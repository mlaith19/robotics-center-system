import bcrypt from "bcryptjs"
import { requireTenant } from "@/lib/tenant/resolve-tenant"

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

export async function POST(req: Request) {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db

  try {
    const body = await req.json()
    const name = String(body.name ?? "").trim()
    const phone = body.phone ? String(body.phone).trim() : null
    const email = body.email ? String(body.email).trim() : null
    const idNumber = body.idNumber ? String(body.idNumber).trim() : null
    const birthDate = normalizeBirthDateInput(body.birthDate)
    const city = body.city ? String(body.city).trim() : null
    const specialization = body.specialization ? String(body.specialization).trim() : null
    const bio = body.bio ? String(body.bio).trim() : null
    const username = body.username ? String(body.username).trim() : ""
    const password = body.password ? String(body.password) : ""

    if (!name) return Response.json({ error: "name is required" }, { status: 400 })
    if (!username) return Response.json({ error: "username is required" }, { status: 400 })
    if (!password || password.length < 4) {
      return Response.json({ error: "password must be at least 4 characters" }, { status: 400 })
    }

    const normalizedName = name.replace(/\s+/g, " ").trim()
    const existingByUsername = await db`SELECT id FROM "User" WHERE LOWER(username) = LOWER(${username}) LIMIT 1`
    if (existingByUsername.length > 0) {
      return Response.json({ error: "שם המשתמש כבר קיים במערכת" }, { status: 409 })
    }
    if (email) {
      const existingByEmail = await db`SELECT id FROM "User" WHERE email IS NOT NULL AND LOWER(email) = LOWER(${email}) LIMIT 1`
      if (existingByEmail.length > 0) {
        return Response.json({ error: "כתובת המייל כבר קיימת במערכת" }, { status: 409 })
      }
    }
    if (idNumber) {
      const existingByIdNumber = await db`
        SELECT id FROM "Teacher"
        WHERE "idNumber" IS NOT NULL AND TRIM("idNumber") = ${idNumber}
        LIMIT 1
      `
      if (existingByIdNumber.length > 0) {
        return Response.json({ error: "תעודת הזהות כבר קיימת במערכת" }, { status: 409 })
      }
    }
    const existingByName = await db`
      SELECT id FROM "Teacher"
      WHERE LOWER(TRIM(name)) = LOWER(${normalizedName})
      LIMIT 1
    `
    if (existingByName.length > 0) {
      return Response.json({ error: "שם מלא כבר קיים במערכת" }, { status: 409 })
    }

    const now = new Date().toISOString()
    const userId = crypto.randomUUID()
    const teacherId = crypto.randomUUID()
    const hashedPassword = await bcrypt.hash(password, 10)

    // Teacher from public registration must stay pending until admin approval.
    await db`
      INSERT INTO "User" (id, name, email, username, password, phone, status, role, permissions, "force_password_reset", "createdAt", "updatedAt")
      VALUES (${userId}, ${name}, ${email}, ${username}, ${hashedPassword}, ${phone}, 'disabled', 'teacher',
              ${JSON.stringify(["courses.view", "students.view", "teachers.view", "schedule.view", "attendance.view", "attendance.edit", "settings.home"])},
              false, ${now}, ${now})
    `

    const result = await db`
      INSERT INTO "Teacher" (
        id, name, email, phone, "idNumber", "birthDate", city, specialty, status, bio,
        "centerHourlyRate", "travelRate", "externalCourseRate", "userId", "createdAt", "updatedAt"
      )
      VALUES (
        ${teacherId}, ${name}, ${email}, ${phone}, ${idNumber}, ${birthDate}, ${city}, ${specialization}, 'מתעניין', ${bio},
        null, null, null, ${userId}, ${now}, ${now}
      )
      RETURNING id, name, status, "createdAt"
    `

    return Response.json(result[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/register/teacher error:", err)
    return Response.json({ error: "Failed to register teacher" }, { status: 500 })
  }
}

