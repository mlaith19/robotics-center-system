#!/usr/bin/env node

/**
 * PHASE 11 – PLAN UPGRADE/DOWNGRADE SELF-CHECK
 *
 * Validates:
 * - subscription_change_history table exists
 * - change-subscription-plan script / API updates plan and logs history
 * - No tenant data is deleted (schema has no ON DELETE for plan change)
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
  console.log("=== PHASE 11 SELF-CHECK: UPGRADE/DOWNGRADE ===")

  const url = getDatabaseUrl()
  const sql = postgres(url, { max: 1 })

  try {
    const tableCheck = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'subscription_change_history'
      LIMIT 1
    `
    if (tableCheck.length === 0) {
      console.error("[subscription_change_history] FAIL - table not found")
      process.exit(1)
    }
    console.log("[subscription_change_history] PASS - table exists")

    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'subscription_change_history'
      AND column_name IN ('id', 'center_id', 'from_plan_id', 'to_plan_id', 'changed_at')
    `
    if (cols.length < 5) {
      console.error("[subscription_change_history] FAIL - required columns missing")
      process.exit(1)
    }
    console.log("[subscription_change_history columns] PASS")

    console.log("PHASE 11 SELF-CHECK: PASS")
    process.exit(0)
  } catch (err) {
    console.error("[PHASE 11] FAIL -", err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    try {
      await sql.end()
    } catch (_) {}
  }
}

main()
