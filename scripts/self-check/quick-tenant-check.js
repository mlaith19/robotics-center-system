#!/usr/bin/env node
/**
 * Quick tenant auth + API checks.
 * 1) GET /api/health/db -> 200
 * 2) POST /api/auth/login (user+pass) -> 200 + tenant-session cookie
 * 3) GET /api/students with cookie -> 200 or 403, not 401
 * 4) GET /api/teachers with cookie -> 200 or 403, not 401
 *
 * Usage: node scripts/self-check/quick-tenant-check.js [--base-url http://localhost:3000] [--user admin] [--pass admin123]
 * Env: BASE_URL, TENANT_USER, TENANT_PASS (optional overrides)
 */

function getArg(name, envKey, def) {
  if (process.env[envKey]) return process.env[envKey]
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const BASE_URL = getArg("--base-url", "BASE_URL", "http://localhost:3000")
const USER = getArg("--user", "TENANT_USER", "admin")
const PASS = getArg("--pass", "TENANT_PASS", "admin123")

function ok(msg, detail = "") {
  console.log(`  ✓ ${msg}${detail ? ` — ${detail}` : ""}`)
  return true
}
function err(msg, detail = "") {
  console.log(`  ✗ ${msg}${detail ? ` — ${detail}` : ""}`)
  return false
}

async function get(url, cookie) {
  const headers = cookie ? { Cookie: cookie } : {}
  const res = await fetch(url, { headers, redirect: "manual" })
  let body
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const setCookie = res.headers.get("set-cookie")
  return { status: res.status, body, setCookie }
}

async function post(url, body, cookie) {
  const headers = { "Content-Type": "application/json" }
  if (cookie) headers["Cookie"] = cookie
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), redirect: "manual" })
  let data
  try {
    data = await res.json()
  } catch {
    data = null
  }
  const setCookie = res.headers.get("set-cookie")
  return { status: res.status, body: data, setCookie }
}

function extractTenantCookie(setCookie) {
  if (!setCookie) return null
  const match = setCookie.match(/tenant-session=([^;]+)/)
  return match ? `tenant-session=${match[1]}` : null
}

async function main() {
  console.log("Quick tenant check:", BASE_URL, "user:", USER)
  let passed = 0
  let failed = 0

  const r1 = await get(`${BASE_URL}/api/health/db`)
  if (r1.status === 200) {
    ok("GET /api/health/db -> 200")
    passed++
  } else {
    err("GET /api/health/db", `expected 200 got ${r1.status}`)
    failed++
  }

  const r2 = await post(`${BASE_URL}/api/auth/login`, { username: USER, password: PASS })
  const cookie = extractTenantCookie(r2.setCookie)
  if (r2.status === 200 && cookie) {
    ok("POST /api/auth/login -> 200 with tenant-session cookie")
    passed++
  } else if (r2.status === 200 && !cookie) {
    err("POST /api/auth/login", "200 but no tenant-session in Set-Cookie")
    failed++
  } else {
    err("POST /api/auth/login", `expected 200 got ${r2.status} ${r2.body?.error || ""}`)
    failed++
  }

  if (cookie) {
    const r3 = await get(`${BASE_URL}/api/students`, cookie)
    if (r3.status === 401) {
      err("GET /api/students", "401 Unauthorized (expected 200 or 403)")
      failed++
    } else if (r3.status === 200 || r3.status === 403) {
      ok(`GET /api/students -> ${r3.status}`)
      passed++
    } else {
      err("GET /api/students", `got ${r3.status}`)
      failed++
    }

    const r4 = await get(`${BASE_URL}/api/teachers`, cookie)
    if (r4.status === 401) {
      err("GET /api/teachers", "401 Unauthorized (expected 200 or 403)")
      failed++
    } else if (r4.status === 200 || r4.status === 403) {
      ok(`GET /api/teachers -> ${r4.status}`)
      passed++
    } else {
      err("GET /api/teachers", `got ${r4.status}`)
      failed++
    }
  } else {
    console.log("  (skipping students/teachers — no cookie)")
  }

  console.log("")
  if (failed > 0) {
    console.log(`Result: ${passed} passed, ${failed} failed`)
    process.exit(1)
  }
  console.log(`Result: all ${passed} checks passed`)
  process.exit(0)
}

main().catch((e) => {
  console.error("Error:", e)
  process.exit(1)
})
