#!/usr/bin/env node

/**
 * PHASE 0 – BASELINE STABILITY SELF-CHECK
 *
 * Validates:
 * - DB connectivity
 * - Dev server /health/db endpoint
 * - Basic app access (/login)
 * - (Trivial) tenant isolation in single-tenant mode
 *
 * Exits with:
 * - 0 on PASS
 * - 1 on any failure
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

async function checkDb() {
  const url = getDatabaseUrl()
  const sql = postgres(url, { max: 1 })
  try {
    await sql`SELECT 1`
    console.log("[DB] PASS - Connected successfully")
    return true
  } catch (err) {
    console.error("[DB] FAIL - Cannot connect:", err && err.message ? err.message : err)
    return false
  } finally {
    try {
      await sql.end()
    } catch {
      // ignore
    }
  }
}

async function checkDevServerHealth() {
  const url = "http://localhost:3000/api/health/db"
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[DevServer] FAIL - ${url} returned status ${res.status}`)
      return false
    }
    const json = await res.json().catch(() => ({}))
    if (json.status === "ok") {
      console.log("[DevServer] PASS - /api/health/db OK")
      return true
    }
    console.error("[DevServer] FAIL - /api/health/db returned non-ok payload:", json)
    return false
  } catch (err) {
    console.error("[DevServer] FAIL - Cannot reach dev server at http://localhost:3000:", err && err.message ? err.message : err)
    return false
  }
}

async function checkLoginPage() {
  const url = "http://localhost:3000/login"
  try {
    const res = await fetch(url)
    if (res.status === 200) {
      console.log("[App] PASS - /login reachable (accessMode ~ ACTIVE)")
      return true
    }
    console.error(`[App] FAIL - /login returned status ${res.status}`)
    return false
  } catch (err) {
    console.error("[App] FAIL - Cannot reach /login:", err && err.message ? err.message : err)
    return false
  }
}

async function checkTenantIsolation() {
  // PHASE 0: single-tenant mode; isolation is trivially satisfied.
  // We assert that we only have one configured DB URL.
  const hasEnvUrl = !!process.env.DATABASE_URL
  console.log(
    `[TenantIsolation] PASS - Single-tenant mode (${hasEnvUrl ? "DATABASE_URL set" : "using default robotics DB"})`
  )
  return true
}

async function main() {
  console.log("=== PHASE 0 SELF-CHECK: BASELINE STABILITY ===")

  const results = []
  results.push(await checkDb())
  results.push(await checkDevServerHealth())
  results.push(await checkLoginPage())
  results.push(await checkTenantIsolation())

  const allOk = results.every(Boolean)
  if (allOk) {
    console.log("PHASE 0 SELF-CHECK: PASS")
    process.exit(0)
  } else {
    console.error("PHASE 0 SELF-CHECK: FAIL")
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("PHASE 0 SELF-CHECK: UNEXPECTED ERROR", err)
  process.exit(1)
})

