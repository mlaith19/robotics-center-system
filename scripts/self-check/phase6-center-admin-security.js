#!/usr/bin/env node

/**
 * PHASE 6 – CENTER ADMIN SECURITY SELF-CHECK
 *
 * Validates:
 * - User table has force_password_reset, locked_until
 * - login_attempts table exists
 * - POST /api/auth/change-password exists and requires auth
 *
 * Exits: 0 on PASS, 1 on FAIL
 */

const postgres = require("postgres")

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
  console.log("=== PHASE 6 SELF-CHECK: CENTER ADMIN SECURITY ===")

  const url = getDatabaseUrl()
  const sql = postgres(url, { max: 1 })

  try {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'User'
      AND column_name IN ('force_password_reset', 'locked_until')
    `
    if (cols.length < 2) {
      console.error("[User columns] FAIL - need force_password_reset and locked_until. Run migration 20260226140000_center_admin_security.")
      process.exit(1)
    }
    console.log("[User columns] PASS")

    const tableCheck = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'login_attempts'
    `
    if (tableCheck.length === 0) {
      console.error("[login_attempts] FAIL - Table not found")
      process.exit(1)
    }
    console.log("[login_attempts] PASS")

    const baseUrl = process.env.BASE_URL || "http://localhost:3000"
    const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "x", newPassword: "y" }),
      credentials: "include",
    })
    if (changeRes.status !== 401) {
      console.error("[change-password] FAIL - Expected 401 without auth, got", changeRes.status)
      process.exit(1)
    }
    console.log("[change-password API] PASS")

    console.log("PHASE 6 SELF-CHECK: PASS")
    process.exit(0)
  } catch (err) {
    console.error("[PHASE 6] FAIL -", err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    try {
      await sql.end()
    } catch (_) {}
  }
}

main()
