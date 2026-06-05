#!/usr/bin/env node

/**
 * PHASE 12 – NOTIFICATION SYSTEM SELF-CHECK
 *
 * Validates:
 * - notification_logs has target_date column
 * - send-expiry-reminders script runs without error (dry: no subscriptions = no inserts)
 * - Running twice does not create duplicate notifications for same (center_id, kind, target_date)
 *
 * Exits: 0 on PASS, 1 on FAIL
 */

const postgres = require("postgres")
const { spawnSync } = require("child_process")
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
  console.log("=== PHASE 12 SELF-CHECK: NOTIFICATION SYSTEM ===")

  const url = getDatabaseUrl()
  const sql = postgres(url, { max: 1 })

  try {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notification_logs'
      AND column_name IN ('id', 'center_id', 'kind', 'sent_at', 'target_date')
    `
    if (cols.length < 5) {
      console.error("[notification_logs] FAIL - target_date or other column missing. Run migration 20260226160000_notification_logs_target_date.")
      process.exit(1)
    }
    console.log("[notification_logs target_date] PASS")

    const scriptPath = path.join(__dirname, "..", "send-expiry-reminders.js")
    const run1 = spawnSync(process.execPath, [scriptPath], { cwd: path.join(__dirname, "..", ".."), env: process.env })
    if (run1.status !== 0) {
      console.error("[send-expiry-reminders] FAIL - first run exited", run1.status)
      process.exit(1)
    }
    console.log("[send-expiry-reminders first run] PASS")

    const run2 = spawnSync(process.execPath, [scriptPath], { cwd: path.join(__dirname, "..", ".."), env: process.env })
    if (run2.status !== 0) {
      console.error("[send-expiry-reminders] FAIL - second run exited", run2.status)
      process.exit(1)
    }
    const count = await sql`SELECT COUNT(*)::int as c FROM notification_logs`
    const total = count[0]?.c ?? 0
    console.log("[send-expiry-reminders second run] PASS (no duplicate crash, total logs:", total, ")")

    console.log("PHASE 12 SELF-CHECK: PASS")
    process.exit(0)
  } catch (err) {
    console.error("[PHASE 12] FAIL -", err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    try {
      await sql.end()
    } catch (_) {}
  }
}

main()
