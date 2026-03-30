#!/usr/bin/env node
/**
 * Self-check phase 16: Master Portal
 *
 * Verifies:
 * 1. ops_runs table exists
 * 2. center_feature_overrides table exists
 * 3. At least one OWNER in master_users
 * 4. plans table has monthly_price column
 * 5. GET /api/master/centers without auth returns 401 (if server is reachable)
 */

require("dotenv").config()

const postgres = require("postgres")
const http = require("http")

let passed = 0
let failed = 0

function ok(msg) {
  console.log(`  ✓ ${msg}`)
  passed++
}
function fail(msg) {
  console.error(`  ✗ ${msg}`)
  failed++
}

function fetchLocal(path) {
  return new Promise((resolve) => {
    const port = process.env.PORT || 3000
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      resolve({ status: res.statusCode })
    })
    req.on("error", () => resolve(null)) // server not running — skip
    req.setTimeout(3000, () => { req.destroy(); resolve(null) })
  })
}

async function main() {
  console.log("\n=== Phase 16: Master Portal Self-Check ===\n")

  const url =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || "robotics"}:${process.env.DB_PASS || "robotics"}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "5432"}/${process.env.DB_NAME || "robotics"}`

  const sql = postgres(url, { max: 1 })

  try {
    // 1. ops_runs table
    const opsRows = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'ops_runs' AND table_schema = 'public'
    `
    if (opsRows.length) ok("ops_runs table exists")
    else fail("ops_runs table is missing — run migration 20260228000000_master_portal_tables")

    // 2. center_feature_overrides table
    const cfoRows = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'center_feature_overrides' AND table_schema = 'public'
    `
    if (cfoRows.length) ok("center_feature_overrides table exists")
    else fail("center_feature_overrides table is missing — run migration 20260228000000_master_portal_tables")

    // 3. At least one OWNER
    const ownerRows = await sql`SELECT count(*)::int AS n FROM master_users WHERE role = 'OWNER'`
    if (ownerRows[0].n > 0) ok(`OWNER found in master_users (${ownerRows[0].n})`)
    else fail("No OWNER in master_users — seed one with scripts/set-owner-password.js")

    // 4. monthly_price column on plans
    const colRows = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'plans' AND column_name = 'monthly_price'
    `
    if (colRows.length) ok("plans.monthly_price column exists")
    else fail("plans.monthly_price column missing — run migration 20260228000000_master_portal_tables")

    // 5. center_feature_overrides is queryable
    const cfoQuery = await sql`SELECT count(*) FROM center_feature_overrides`
    if (cfoQuery) ok("center_feature_overrides is queryable")

    // 6. /api/master/centers without auth → 401 (if server running)
    const resp = await fetchLocal("/api/master/centers")
    if (!resp) {
      console.log("  - Server not running, skipping HTTP auth check")
    } else if (resp.status === 401 || resp.status === 403) {
      ok(`/api/master/centers returns ${resp.status} without auth`)
    } else {
      fail(`/api/master/centers returned ${resp.status} without auth (expected 401 or 403)`)
    }

  } finally {
    await sql.end()
  }

  console.log(`\n  Passed: ${passed}  Failed: ${failed}\n`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error("Unexpected error:", err)
  process.exit(1)
})
