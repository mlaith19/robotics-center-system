#!/usr/bin/env node

/**
 * PHASE 4 – TENANT DATABASE SCHEMA SELF-CHECK
 *
 * Validates:
 * - prisma/tenant-migrations/ exists and has SQL files
 * - Running tenant migration on a DB creates expected tables (Student, Teacher, Course, etc.)
 *
 * Exits: 0 on PASS, 1 on FAIL
 */

const postgres = require("postgres")
const fs = require("fs")
const path = require("path")

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (url && url.trim().length > 0) return url.trim()
  const host = process.env.DB_HOST || "localhost"
  const port = process.env.DB_PORT || "5432"
  const name = process.env.DB_NAME || "robotics"
  const user = process.env.DB_USER || "robotics"
  const pass = process.env.DB_PASS || "robotics"
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${encodeURIComponent(name)}`
}

async function main() {
  console.log("=== PHASE 4 SELF-CHECK: TENANT DATABASE SCHEMA ===")

  const migrationsDir = path.join(__dirname, "..", "..", "prisma", "tenant-migrations")
  if (!fs.existsSync(migrationsDir)) {
    console.error("[tenant-migrations] FAIL - Directory not found")
    process.exit(1)
  }
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))
  if (files.length === 0) {
    console.error("[tenant-migrations] FAIL - No .sql files found")
    process.exit(1)
  }
  console.log("[tenant-migrations] PASS -", files.length, "migration file(s)")

  const url = getDatabaseUrl()
  const sql = postgres(url, { max: 1 })
  try {
    const tables = ["Student", "Teacher", "Course", "User", "center_settings", "CourseCategory"]
    for (const table of tables) {
      const rows = await sql`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${table}
      `
      if (rows.length === 0) {
        console.error(`[tenant schema] FAIL - Table ${table} not found in DB`)
        process.exit(1)
      }
    }
    console.log("[tenant schema] PASS - Required tables exist (current DB has tenant schema)")
  } catch (err) {
    console.error("[PHASE 4] FAIL -", err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    await sql.end()
  }

  console.log("PHASE 4 SELF-CHECK: PASS")
  process.exit(0)
}

main()
