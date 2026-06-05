#!/usr/bin/env node

/**
 * Create a license key in the master DB (for testing Phase 8).
 * Usage: node scripts/create-license-key.js [plan_id] [duration_days]
 * Outputs the raw key (store securely); only the hash is stored in DB.
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

function hashKey(key) {
  return crypto.createHash("sha256").update(key.trim(), "utf8").digest("hex")
}

async function main() {
  const planId = process.argv[2]
  const durationDays = parseInt(process.argv[3] || "365", 10)

  const sql = postgres(getDatabaseUrl(), { max: 1 })
  try {
    let resolvedPlanId = planId
    if (!resolvedPlanId) {
      const plans = await sql`SELECT id FROM plans LIMIT 1`
      if (plans.length === 0) {
        console.error("No plan found. Run: node scripts/seed-default-plan.js")
        process.exit(1)
      }
      resolvedPlanId = plans[0].id
    }

    const rawKey = "rc-" + crypto.randomUUID().replace(/-/g, "")
    const keyHash = hashKey(rawKey)
    const id = crypto.randomUUID()

    await sql`
      INSERT INTO license_keys (id, key_hash, plan_id, duration_days, max_activations, status, created_at)
      VALUES (${id}, ${keyHash}, ${resolvedPlanId}, ${durationDays}, 1, 'active', now())
    `

    console.log("License key created.")
    console.log("Key (save this; it cannot be retrieved later):", rawKey)
    console.log("ID:", id)
  } catch (err) {
    console.error("Error:", err.message)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
