#!/usr/bin/env node

/**
 * Change a center's subscription to a different plan (upgrade/downgrade).
 * Downgrade does NOT delete any tenant data; only plan_id and features change.
 * Usage: node scripts/change-subscription-plan.js <centerId> <newPlanId>
 */

const postgres = require("postgres")
const crypto = require("crypto")

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.MASTER_DATABASE_URL
  if (url && url.trim().length > 0) return url.trim()
  const host = process.env.DB_HOST || "localhost"
  const port = process.env.DB_PORT || "5432"
  const name = process.env.DB_NAME || "robotics"
  const user = process.env.DB_USER || "robotics"
  const pass = process.env.DB_PASS || "robotics"
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${encodeURIComponent(name)}`
}

async function main() {
  const centerId = process.argv[2]
  const newPlanId = process.argv[3]
  if (!centerId || !newPlanId) {
    console.error("Usage: node scripts/change-subscription-plan.js <centerId> <newPlanId>")
    process.exit(1)
  }

  const sql = postgres(getDatabaseUrl(), { max: 1 })
  try {
    const subs = await sql`
      SELECT id, plan_id FROM subscriptions
      WHERE center_id = ${centerId}
      ORDER BY created_at DESC
      LIMIT 1
    `
    if (subs.length === 0) {
      console.error("No subscription found for center:", centerId)
      process.exit(1)
    }
    const currentPlanId = subs[0].plan_id
    if (currentPlanId === newPlanId) {
      console.log("Center already on plan:", newPlanId)
      process.exit(0)
      return
    }

    const planCheck = await sql`SELECT id FROM plans WHERE id = ${newPlanId} LIMIT 1`
    if (planCheck.length === 0) {
      console.error("Plan not found:", newPlanId)
      process.exit(1)
    }

    const subId = subs[0].id
    await sql`UPDATE subscriptions SET plan_id = ${newPlanId} WHERE id = ${subId}`
    const historyId = crypto.randomUUID()
    await sql`
      INSERT INTO subscription_change_history (id, center_id, from_plan_id, to_plan_id, changed_at)
      VALUES (${historyId}, ${centerId}, ${currentPlanId}, ${newPlanId}, now())
    `
    console.log("Subscription updated:", { centerId, fromPlanId: currentPlanId, toPlanId: newPlanId })
  } catch (err) {
    console.error("Change failed:", err.message)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
