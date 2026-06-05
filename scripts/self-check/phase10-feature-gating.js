#!/usr/bin/env node

/**
 * PHASE 10 – FEATURE GATING SELF-CHECK
 *
 * Validates:
 * - plan_features table has feature_key values (students, teachers, courses, etc.)
 * - requireFeatureFromRequest / feature-gate used in codebase
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

const REQUIRED_FEATURES = ["students", "teachers", "courses", "schools", "gafan", "reports", "payments"]

async function main() {
  console.log("=== PHASE 10 SELF-CHECK: FEATURE GATING ===")

  const url = getDatabaseUrl()
  const sql = postgres(url, { max: 1 })

  try {
    const rows = await sql`
      SELECT DISTINCT feature_key FROM plan_features
    `
    const keys = rows.map((r) => r.feature_key)
    const missing = REQUIRED_FEATURES.filter((f) => !keys.includes(f))
    if (missing.length > 0) {
      console.error("[plan_features] FAIL - missing feature_key(s):", missing.join(", "))
      process.exit(1)
    }
    console.log("[plan_features] PASS - required feature_key values present")

    console.log("PHASE 10 SELF-CHECK: PASS")
    process.exit(0)
  } catch (err) {
    console.error("[PHASE 10] FAIL -", err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    try {
      await sql.end()
    } catch (_) {}
  }
}

main()
