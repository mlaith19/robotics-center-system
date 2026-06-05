#!/usr/bin/env node

/**
 * DEV-ONLY demo seeder – fills a tenant DB with realistic data.
 * Usage:
 *   NODE_ENV=development node scripts/seed-demo-tenant.js <subdomain> [--clear] --i-know-this-is-dev
 *
 * NEVER runs in production.
 */

"use strict"

const postgres = require("postgres")
const crypto   = require("crypto")

/** Mirror of lib/db/normalizeTenantDbUrl.ts – keeps seeder self-contained. */
function normalizeTenantDbUrl(url) {
  if (!url) throw new Error("tenant_db_url missing")
  let normalized = url
    .replace("postgresql://postgres@", "postgresql://robotics:robotics@")
    .replace("postgres://postgres@", "postgresql://robotics:robotics@")
  if (normalized.startsWith("postgres://") && !normalized.startsWith("postgresql://")) {
    normalized = "postgresql://" + normalized.slice("postgres://".length)
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("TENANT DB:", normalized.replace(/:.*@/, ":***@"))
  }
  return normalized
}

// ─── Safety guards ────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  console.error("REFUSED: NODE_ENV is 'production'. This script is DEV-ONLY.")
  process.exit(1)
}

const args      = process.argv.slice(2)
const subdomain = args.find((a) => !a.startsWith("--"))
const flagClear = args.includes("--clear")
const flagSafe  = args.includes("--i-know-this-is-dev")

if (!flagSafe) {
  console.error(
    "REFUSED: Missing required flag --i-know-this-is-dev\n" +
    "Full command:\n" +
    "  NODE_ENV=development node scripts/seed-demo-tenant.js <subdomain> [--clear] --i-know-this-is-dev"
  )
  process.exit(1)
}

if (!subdomain) {
  console.error("REFUSED: No subdomain provided.\nUsage: node scripts/seed-demo-tenant.js <subdomain> [--clear] --i-know-this-is-dev")
  process.exit(1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid  = () => crypto.randomUUID()
const now  = () => new Date().toISOString()
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)]
const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)

function getDatabaseUrl() {
  const url = process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL
  if (url && url.trim().length > 0) return url.trim()
  const host = process.env.DB_HOST || "localhost"
  const port = process.env.DB_PORT || "5432"
  const name = process.env.DB_NAME || "robotics"
  const user = process.env.DB_USER || "robotics"
  const pass = process.env.DB_PASS || "robotics"
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${encodeURIComponent(name)}`
}

// ─── Demo data pools ──────────────────────────────────────────────────────────

const SCHOOL_NAMES = [
  "בית ספר רמות", "בית ספר גבעת שמואל", "בית ספר יגאל אלון",
  "בית ספר אורט", "בית ספר דוד אלעזר", "בית ספר שז\"ר",
  "בית ספר עירוני א'", "בית ספר הרצליה",
]
const CITIES = ["תל אביב", "ירושלים", "חיפה", "ראשון לציון", "פתח תקווה", "אשדוד", "נתניה", "רחובות", "בת ים", "בני ברק"]
const FIRST_NAMES = ["דן", "יואב", "שירה", "ליאור", "מיכל", "אורי", "נועה", "יונתן", "תמר", "אבי", "רינת", "עידן", "הילה", "גל", "רועי", "מאיה", "אלון", "דנה", "עמית", "קרן"]
const LAST_NAMES  = ["כהן", "לוי", "מזרחי", "פרץ", "ביטון", "אברהם", "פרידמן", "שפירו", "גולן", "קדוש", "שמש", "דהן", "אלון", "ברק", "חן", "שלום", "נחמיאס", "רוזן"]
const COURSE_CATEGORIES = ["רובוטיקה", "תכנות", "בינה מלאכותית", "אלקטרוניקה", "הנדסה"]
const COURSE_NAMES = [
  "רובוטיקה למתחילים", "רובוטיקה מתקדמת", "LEGO Mindstorms",
  "Python בסיסי", "Python מתקדם", "Scratch לילדים",
  "Arduino בסיסי", "Arduino ופרויקטים", "IoT ובית חכם",
  "בינה מלאכותית יסודות", "Machine Learning לנוער", "עיבוד תמונה",
  "הלחמה ואלקטרוניקה", "מעגלים חשמליים", "3D הדפסה",
  "פיתוח משחקים", "הנדסת מכונות", "תכנות Java",
]
const PAY_TYPES  = ["מזומן", "העברה בנקאית", "כרטיס אשראי", "ביט", "צ'ק"]
const ATT_STATUS = ["נוכח", "נוכח", "נוכח", "נוכח", "נעדר", "איחור"]

function randomName() {
  return `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`
}
function randomPhone() {
  return `05${Math.floor(Math.random() * 9)}${String(Math.floor(Math.random() * 10000000)).padStart(7, "0")}`
}
function randomDate(yearsBack = 1) {
  const ms = Date.now() - Math.random() * yearsBack * 365 * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString()
}
function randomBirthDate(minAge = 8, maxAge = 18) {
  const ms = Date.now() - (minAge + Math.random() * (maxAge - minAge)) * 365 * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString()
}

// ─── Schema-safe bulk insert ──────────────────────────────────────────────────

/**
 * Insert rows into `table`, automatically ignoring any keys that do not exist
 * as columns in the real schema. Uses parameterized SQL via .unsafe().
 * Splits large arrays into chunks (default 100) to stay within PG limits.
 */
async function safeInsert(sql, table, rows, chunkSize = 100) {
  if (!rows || rows.length === 0) return

  // Discover actual columns for this table
  const colRows = await sql.unsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [table]
  )
  const validColumns = new Set(colRows.map((r) => r.column_name))

  // Filter each row to only known columns
  const filtered = rows.map((row) => {
    const obj = {}
    for (const key of Object.keys(row)) {
      if (validColumns.has(key)) obj[key] = row[key]
    }
    return obj
  })

  const columns = Object.keys(filtered[0] || {})
  if (columns.length === 0) {
    console.log(`${table}: skipped (no matching columns)`)
    return
  }

  const colList = columns.join(", ")
  let totalInserted = 0

  for (let i = 0; i < filtered.length; i += chunkSize) {
    const chunk = filtered.slice(i, i + chunkSize)
    const values = []
    const rowPlaceholders = []

    for (const row of chunk) {
      const pGroup = []
      for (const col of columns) {
        values.push(row[col])
        pGroup.push(`$${values.length}`)
      }
      rowPlaceholders.push(`(${pGroup.join(", ")})`)
    }

    await sql.unsafe(
      `INSERT INTO ${table} (${colList}) VALUES ${rowPlaceholders.join(", ")}`,
      values
    )
    totalInserted += chunk.length
  }

  console.log(`${table}: inserted ${totalInserted}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const masterUrl = getDatabaseUrl()
  const masterSql = postgres(masterUrl, { max: 1 })

  let tenantSql

  try {
    // ── Step 1: Resolve tenant via master DB ──────────────────────────────────
    console.log(`\nConnecting to master DB to resolve subdomain "${subdomain}" …`)
    const centers = await masterSql`
      SELECT id, name, tenant_db_url FROM centers WHERE subdomain = ${subdomain} LIMIT 1
    `
    if (centers.length === 0) {
      console.error(`ERROR: No center found with subdomain "${subdomain}" in master DB.`)
      process.exit(1)
    }
    const center = centers[0]
    if (!center.tenant_db_url) {
      console.error(`ERROR: Center "${subdomain}" has no tenant_db_url set.`)
      process.exit(1)
    }
    console.log(`Found center: ${center.name} (id=${center.id})`)
    // ── Step 2: Connect to tenant DB ──────────────────────────────────────────
    const tenantUrl = normalizeTenantDbUrl(center.tenant_db_url)
    tenantSql = postgres(tenantUrl, { max: 3 })
    await tenantSql`SELECT 1` // connectivity check

    // ── Step 3: Optional TRUNCATE ─────────────────────────────────────────────
    if (flagClear) {
      console.log("\n--clear flag detected. Truncating tenant tables …")
      await tenantSql`TRUNCATE TABLE attendance, payments, enrollments, courses, course_categories, students, teachers, schools, center_settings RESTART IDENTITY CASCADE`
      console.log("Tables truncated.")
    }

    const ts = now()

    // ── Step 4a: center_settings ──────────────────────────────────────────────
    await safeInsert(tenantSql, "center_settings", [{
      center_name:            "מרכז רובוטיקה " + subdomain,
      tax_id:                 "",
      phone:                  "03-1234567",
      whatsapp:               "050-1234567",
      address:                "רחוב הטכנולוגיה 1, " + rand(CITIES),
      email:                  "info@" + subdomain + ".example.com",
      website:                "https://" + subdomain + ".example.com",
      lesson_price:           120,
      monthly_price:          450,
      registration_fee:       250,
      discount_siblings:      10,
      max_students_per_class: 20,
      timezone:               "Asia/Jerusalem",
      currency:               "ILS",
      language:               "he",
      updated_at:             ts,
    }])

    // ── Step 4b: course_categories (5) ────────────────────────────────────────
    const catRows = COURSE_CATEGORIES.map((name, i) => ({
      id: uid(), name, sort_order: i, sortOrder: i, created_at: ts, createdAt: ts, updated_at: ts, updatedAt: ts,
    }))
    await safeInsert(tenantSql, "course_categories", catRows)

    // ── Step 4c: schools (5) ──────────────────────────────────────────────────
    const schoolRows = pick(SCHOOL_NAMES, 5).map((name) => ({
      id: uid(), name, city: rand(CITIES),
      contact_person: randomName(), contactPerson: randomName(),
      phone: randomPhone(),
      email: `school${Math.floor(Math.random()*1000)}@edu.example.com`,
      address: `רחוב ${rand(LAST_NAMES)} ${Math.ceil(Math.random()*50)}`,
      status: "פעיל", notes: "",
      created_at: ts, createdAt: ts, updated_at: ts, updatedAt: ts,
    }))
    await safeInsert(tenantSql, "schools", schoolRows)

    // ── Step 4d: teachers (12) ────────────────────────────────────────────────
    const teacherRows = Array.from({ length: 12 }, () => ({
      id: uid(), name: randomName(),
      phone: randomPhone(),
      email: `teacher${Math.floor(Math.random()*9000+1000)}@example.com`,
      id_number: String(Math.floor(Math.random() * 900000000 + 100000000)),
      idNumber:  String(Math.floor(Math.random() * 900000000 + 100000000)),
      birth_date: randomBirthDate(25, 55), birthDate: randomBirthDate(25, 55),
      city: rand(CITIES), status: "פעיל",
      center_hourly_rate: (80 + Math.floor(Math.random() * 70)).toString(),
      centerHourlyRate:   (80 + Math.floor(Math.random() * 70)).toString(),
      travel_rate: (10 + Math.floor(Math.random() * 20)).toString(),
      travelRate:  (10 + Math.floor(Math.random() * 20)).toString(),
      external_course_rate: (100 + Math.floor(Math.random() * 50)).toString(),
      externalCourseRate:   (100 + Math.floor(Math.random() * 50)).toString(),
      specialty: rand(COURSE_CATEGORIES), bio: "",
      created_at: ts, createdAt: ts, updated_at: ts, updatedAt: ts,
    }))
    await safeInsert(tenantSql, "teachers", teacherRows)

    // ── Step 4e: courses (18) ─────────────────────────────────────────────────
    const courseRows = pick(COURSE_NAMES, 18).map((name, i) => {
      const cat     = rand(catRows)
      const teacher1 = rand(teacherRows)
      const teacher2 = rand(teacherRows.filter((t) => t.id !== teacher1.id))
      const school   = rand(schoolRows)
      const startDate = new Date(Date.now() - 60  * 24 * 60 * 60 * 1000).toISOString()
      const endDate   = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString()
      const lvl = i % 3 === 0 ? "beginner" : i % 3 === 1 ? "intermediate" : "advanced"
      return {
        id: uid(), name,
        description: `קורס ${name} – רמה ${i % 3 === 0 ? "מתחילים" : i % 3 === 1 ? "בינוניים" : "מתקדמים"}`,
        level: lvl,
        duration: rand([60, 90, 120]),
        price: (200 + Math.floor(Math.random() * 300)).toString(),
        status: "active",
        course_number: `C${String(i + 1).padStart(3, "0")}`,
        courseNumber:  `C${String(i + 1).padStart(3, "0")}`,
        category: cat.name,
        category_id: cat.id,
        categoryId:  cat.id,
        course_type: rand(["regular", "workshop", "private"]),
        courseType:  rand(["regular", "workshop", "private"]),
        location: rand(["center", "school", "online"]),
        start_date: startDate, startDate,
        end_date:   endDate,   endDate,
        days_of_week: JSON.stringify(pick(["ראשון","שני","שלישי","רביעי","חמישי"], rand([1,2,3]))),
        daysOfWeek:   JSON.stringify(pick(["ראשון","שני","שלישי","רביעי","חמישי"], rand([1,2,3]))),
        teacher_ids: JSON.stringify([teacher1.id, teacher2.id]),
        teacherIds:  JSON.stringify([teacher1.id, teacher2.id]),
        teacher_id: teacher1.id, teacherId: teacher1.id,
        school_id:  school.id,  schoolId:  school.id,
        max_students: rand([10, 15, 20, 25]),
        created_at: ts, createdAt: ts, updated_at: ts, updatedAt: ts,
      }
    })
    await safeInsert(tenantSql, "courses", courseRows)

    // ── Step 4f: students (120) ───────────────────────────────────────────────
    const studentRows = Array.from({ length: 120 }, () => ({
      id: uid(), name: randomName(),
      email: `student${Math.floor(Math.random()*90000+10000)}@example.com`,
      phone: randomPhone(),
      address: `רחוב ${rand(FIRST_NAMES)} ${Math.ceil(Math.random() * 60)}`,
      city: rand(CITIES),
      status: rand(["פעיל","פעיל","פעיל","מתעניין","לא פעיל"]),
      birth_date: randomBirthDate(8, 18), birthDate: randomBirthDate(8, 18),
      id_number: String(Math.floor(Math.random() * 900000000 + 100000000)),
      idNumber:  String(Math.floor(Math.random() * 900000000 + 100000000)),
      father: randomName(), mother: randomName(),
      additional_phone: randomPhone(), additionalPhone: randomPhone(),
      health_fund: rand(["מכבי","כללית","מאוחדת","לאומית",""]),
      healthFund:  rand(["מכבי","כללית","מאוחדת","לאומית",""]),
      allergies: rand(["","","","","אגוזים","גלוטן","חלב"]),
      total_sessions: rand([12, 16, 20, 24]),
      totalSessions:  rand([12, 16, 20, 24]),
      course_ids: JSON.stringify([]), courseIds: JSON.stringify([]),
      course_sessions: JSON.stringify({}), courseSessions: JSON.stringify({}),
      school_id: rand(schoolRows).id,
      created_at: randomDate(1), createdAt: randomDate(1),
      updated_at: ts, updatedAt: ts,
    }))
    await safeInsert(tenantSql, "students", studentRows, 40)

    // ── Step 4g: enrollments (2–4 per student) ────────────────────────────────
    const enrollmentRows = []
    for (const student of studentRows) {
      const chosen = pick(courseRows, Math.min(2 + Math.floor(Math.random() * 3), courseRows.length))
      for (const course of chosen) {
        enrollmentRows.push({
          id: uid(),
          student_id: student.id, studentId: student.id,
          course_id:  course.id,  courseId:  course.id,
          enrollment_date: randomDate(0.5), enrollmentDate: randomDate(0.5),
          status: rand(["active","active","active","inactive"]),
          sessions_left: rand([4, 8, 12, 16]), sessionsLeft: rand([4, 8, 12, 16]),
          created_at: ts, createdAt: ts,
        })
      }
    }
    await safeInsert(tenantSql, "enrollments", enrollmentRows)

    // ── Step 4h: payments ─────────────────────────────────────────────────────
    const paymentRows = studentRows.flatMap((student) =>
      Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => {
        const course = rand(courseRows)
        return {
          id: uid(),
          student_id: student.id, studentId: student.id,
          amount: (150 + Math.floor(Math.random() * 500)).toString(),
          payment_date: randomDate(0.5), paymentDate: randomDate(0.5),
          payment_type: rand(PAY_TYPES), paymentType: rand(PAY_TYPES),
          method: rand(PAY_TYPES),
          description: `תשלום עבור ${course.name}`,
          course_id: course.id, courseId: course.id,
          created_at: ts, createdAt: ts,
        }
      })
    )
    await safeInsert(tenantSql, "payments", paymentRows)

    // ── Step 4i: attendance ───────────────────────────────────────────────────
    const attendanceRows = studentRows.flatMap((student) =>
      Array.from({ length: 2 + Math.floor(Math.random() * 4) }, () => {
        const course  = rand(courseRows)
        const teacher = rand(teacherRows)
        return {
          id: uid(),
          student_id: student.id, studentId: student.id,
          teacher_id: teacher.id, teacherId: teacher.id,
          course_id:  course.id,  courseId:  course.id,
          date: randomDate(0.25),
          status: rand(ATT_STATUS),
          notes: "",
          hours: rand(["1", "1.5", "2"]),
          created_at: ts, createdAt: ts,
        }
      })
    )
    await safeInsert(tenantSql, "attendance", attendanceRows, 150)

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("SEED COMPLETE")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    process.exit(0)
  } catch (err) {
    console.error("\nSeed failed:", err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    try { await masterSql.end() } catch { /* ignore */ }
    try { if (tenantSql) await tenantSql.end() } catch { /* ignore */ }
  }
}

main()
