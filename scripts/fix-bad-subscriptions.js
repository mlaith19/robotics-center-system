#!/usr/bin/env node
/**
 * Fix broken subscriptions caused by invalid plan_id values
 * (e.g. plan_id='center2' that came from old free-text input).
 *
 * Usage:
 *   node scripts/fix-bad-subscriptions.js
 *
 * What it does:
 *  1. Find subscriptions whose plan_id doesn't exist in plans.
 *  2. Re-assign them to the first valid plan in the plans table.
 *  3. Print a summary.
 */

require("dotenv").config({ path: ".env.local" })
const postgres = require("postgres")

function getDbUrl() {
  return process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL ||
    "postgresql://robotics:robotics@localhost:5432/robotics"
}

async function main() {
  const sql = postgres(getDbUrl(), { max: 1 })
  try {
    // Find a valid plan to fall back to
    const plans = await sql`SELECT id, name FROM plans ORDER BY created_at LIMIT 1`
    if (!plans.length) {
      console.error("❌  No plans found — run: node scripts/seed-default-plan.js first")
      process.exit(1)
    }
    const fallbackPlan = plans[0]
    console.log(`✅  Fallback plan: "${fallbackPlan.name}" (${fallbackPlan.id})`)

    // Find broken subscriptions
    const broken = await sql`
      SELECT s.id, s.center_id, s.plan_id
      FROM subscriptions s
      WHERE NOT EXISTS (SELECT 1 FROM plans p WHERE p.id = s.plan_id)
    `
    if (!broken.length) {
      console.log("✅  No broken subscriptions found.")
      process.exit(0)
    }

    console.log(`⚠️   Found ${broken.length} broken subscription(s):`)
    for (const row of broken) {
      console.log(`     subscription ${row.id}: center=${row.center_id} bad plan_id="${row.plan_id}"`)
    }

    // Fix them
    const ids = broken.map((r) => r.id)
    await sql`
      UPDATE subscriptions
      SET plan_id = ${fallbackPlan.id}
      WHERE id = ANY(${ids})
    `
    console.log(`✅  Fixed ${broken.length} subscription(s) → plan "${fallbackPlan.name}"`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1) })
