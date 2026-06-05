#!/usr/bin/env node

/**
 * Seed a default plan in the master DB (required for center provisioning).
 * Safe to run multiple times.
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
  const sql = postgres(getDatabaseUrl(), { max: 1 })
  try {
    const existing = await sql`SELECT id FROM plans LIMIT 1`
    if (existing.length > 0) {
      console.log("Default plan already exists.")
      process.exit(0)
      return
    }
    const planId = crypto.randomUUID()
    await sql`
      INSERT INTO plans (id, name, created_at)
      VALUES (${planId}, 'Standard', now())
    `
    await sql`
      INSERT INTO plan_features (plan_id, feature_key)
      VALUES
        (${planId}, 'students'),
        (${planId}, 'teachers'),
        (${planId}, 'courses'),
        (${planId}, 'schools'),
        (${planId}, 'gafan'),
        (${planId}, 'reports'),
        (${planId}, 'payments')
    `
    console.log("Default plan created:", planId)
  } catch (err) {
    console.error("Seed failed:", err.message)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
