#!/usr/bin/env node

/**
 * Seed initial Master OWNER (exactly one).
 * Safe to run multiple times: only inserts if no OWNER exists.
 * Uses DATABASE_URL (same DB as app; master_* tables).
 */

const postgres = require("postgres")
const bcrypt = require("bcryptjs")
const crypto = require("crypto")

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
  const url = getDatabaseUrl()
  const sql = postgres(url, { max: 1 })

  try {
    const existing = await sql`
      SELECT id FROM master_users WHERE role = 'OWNER' LIMIT 1
    `
    if (existing.length > 0) {
      console.log("Master OWNER already exists. Skip seed.")
      process.exit(0)
      return
    }

    const password = process.env.MASTER_OWNER_INITIAL_PASSWORD || "ChangeMe123!"
    const passwordHash = bcrypt.hashSync(password, 10)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await sql`
      INSERT INTO master_users (id, username, email, password_hash, role, permissions_json, force_password_reset, created_at, updated_at)
      VALUES (
        ${id},
        'owner',
        'owner@example.com',
        ${passwordHash},
        'OWNER',
        '[]',
        true,
        ${now},
        ${now}
      )
    `
    console.log("Master OWNER created. Username: owner. Set MASTER_OWNER_INITIAL_PASSWORD to override default password.")
    process.exit(0)
  } catch (err) {
    console.error("Seed failed:", err && err.message ? err.message : err)
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
