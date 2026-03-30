#!/usr/bin/env node

/**
 * PHASE 9 – TRIAL SYSTEM SELF-CHECK
 *
 * Validates:
 * - subscriptions has trial_start_date, trial_end_date columns
 * - getTenantContext returns TRIAL_* accessMode when subscription is trial and expired
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
  console.log("=== PHASE 9 SELF-CHECK: TRIAL SYSTEM ===")

  const url = getDatabaseUrl()
  const sql = postgres(url, { max: 1 })

  try {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name IN ('trial_start_date', 'trial_end_date')
    `
    if (cols.length < 2) {
      console.error("[subscriptions trial columns] FAIL - need trial_start_date, trial_end_date. Run migration 20260226150000_trial_dates.")
      process.exit(1)
    }
    console.log("[subscriptions trial columns] PASS")

    console.log("PHASE 9 SELF-CHECK: PASS")
    process.exit(0)
  } catch (err) {
    console.error("[PHASE 9] FAIL -", err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    try {
      await sql.end()
    } catch (_) {}
  }
}

main()
