#!/usr/bin/env node

/**
 * PHASE 8 – SERIAL LICENSE ACTIVATION SELF-CHECK
 *
 * Validates:
 * - license_keys and license_activations tables exist
 * - POST /api/activate without body returns 400
 * - POST /api/activate without x-tenant-center-id returns 400
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
  console.log("=== PHASE 8 SELF-CHECK: SERIAL LICENSE ACTIVATION ===")

  const url = getDatabaseUrl()
  const sql = postgres(url, { max: 1 })

  try {
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('license_keys', 'license_activations')
    `
    if (tables.length < 2) {
      console.error("[license tables] FAIL - license_keys or license_activations missing")
      process.exit(1)
    }
    console.log("[license tables] PASS")

    const baseUrl = process.env.BASE_URL || "http://localhost:3000"

    const noBody = await fetch(`${baseUrl}/api/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-center-id": "test-center-id" },
      body: JSON.stringify({}),
    })
    if (noBody.status !== 400) {
      console.error("[activate no key] FAIL - Expected 400, got", noBody.status)
      process.exit(1)
    }
    console.log("[activate validation] PASS - invalid/missing key rejected")

    const noTenant = await fetch(`${baseUrl}/api/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "some-key" }),
    })
    if (noTenant.status !== 400) {
      console.error("[activate no tenant] FAIL - Expected 400 without center, got", noTenant.status)
      process.exit(1)
    }
    console.log("[activate tenant required] PASS")

    console.log("PHASE 8 SELF-CHECK: PASS")
    process.exit(0)
  } catch (err) {
    console.error("[PHASE 8] FAIL -", err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    try {
      await sql.end()
    } catch (_) {}
  }
}

main()
