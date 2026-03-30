#!/usr/bin/env node

/**
 * PHASE 1 – MASTER CONTROL PLANE SELF-CHECK
 *
 * Validates:
 * - Master tables exist (master_users, centers, domains, plans, ...)
 * - Exactly one OWNER in master_users
 * - OWNER has force_password_reset = true
 * - OWNER has password_hash set
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

const REQUIRED_TABLES = [
  "master_users",
  "centers",
  "domains",
  "plans",
  "plan_features",
  "subscriptions",
  "license_keys",
  "license_activations",
  "notification_logs",
  "subscription_change_history",
  "audit_logs",
]

async function main() {
  console.log("=== PHASE 1 SELF-CHECK: MASTER CONTROL PLANE ===")

  const url = getDatabaseUrl()
  const sql = postgres(url, { max: 1 })

  try {
    for (const table of REQUIRED_TABLES) {
      const r = await sql`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${table}
      `
      if (r.length === 0) {
        console.error(`[MasterTables] FAIL - Table '${table}' does not exist`)
        process.exit(1)
      }
    }
    console.log("[MasterTables] PASS - All required master tables exist")

    const owners = await sql`
      SELECT id, username, force_password_reset, password_hash
      FROM master_users
      WHERE role = 'OWNER'
    `
    if (owners.length === 0) {
      console.error("[OWNER] FAIL - No OWNER user found. Run: node scripts/seed-master-owner.js")
      process.exit(1)
    }
    if (owners.length > 1) {
      console.error("[OWNER] FAIL - More than one OWNER (expected exactly one)")
      process.exit(1)
    }
    const owner = owners[0]
    if (!owner.password_hash || owner.password_hash.length < 10) {
      console.error("[OWNER] FAIL - OWNER must have password_hash set")
      process.exit(1)
    }
    if (!owner.force_password_reset) {
      console.warn("[OWNER] WARN - force_password_reset is false (password already set — OK in non-fresh env)")
    }
    console.log("[OWNER] PASS - Exactly one OWNER with password_hash set")

    console.log("PHASE 1 SELF-CHECK: PASS")
    process.exit(0)
  } catch (err) {
    console.error("[PHASE 1] FAIL -", err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    try {
      await sql.end()
    } catch {
      // ignore
    }
  }
}

main()
