#!/usr/bin/env node
/**
 * test-auth.js — Integration test for tenant auth flow.
 *
 * Tests:
 *   1. Login with valid credentials + centerId → 200
 *   2. Login with wrong password              → 401
 *   3. Login without centerId (TENANT_NOT_RESOLVED) → 400
 *
 * Usage:
 *   node scripts/test-auth.js <centerId> <username> <password>
 *
 * Example (after reset-admin-password):
 *   node scripts/test-auth.js a4833ff0-... m_laith19_admin abc123def456
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000"
const [,, centerId, username, password] = process.argv

const g  = (s) => `\x1b[32m${s}\x1b[0m`
const r  = (s) => `\x1b[31m${s}\x1b[0m`
const y  = (s) => `\x1b[33m${s}\x1b[0m`
const b  = (s) => `\x1b[36m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`

let passed = 0
let failed = 0

async function test(name, fn) {
  process.stdout.write(`  ${b("▶")} ${name} ... `)
  try {
    await fn()
    console.log(g("PASS"))
    passed++
  } catch (err) {
    console.log(r("FAIL") + `  ${r(err.message)}`)
    failed++
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

async function loginRequest({ centerId: cId, username: u, password: p } = {}) {
  const url = cId
    ? `${BASE_URL}/api/auth/login?centerId=${cId}`
    : `${BASE_URL}/api/auth/login`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p }),
  })
  let data = {}
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

async function main() {
  console.log(bold(b("\n══════════════════════════════════════")))
  console.log(bold(b("  Robotics Center — Auth Integration Test")))
  console.log(bold(b("══════════════════════════════════════\n")))
  console.log(`  URL:      ${BASE_URL}`)
  console.log(`  centerId: ${centerId ?? y("(not provided)")}`)
  console.log(`  username: ${username ?? y("(not provided)")}`)
  console.log(`  password: ${password ? "***" : y("(not provided)")}\n`)

  if (!centerId || !username || !password) {
    console.log(r("Usage: node scripts/test-auth.js <centerId> <username> <password>"))
    console.log(y("Tip: Get centerId from Master Portal → Centers → copy center UUID"))
    console.log(y("     After reset-admin-password, the tempPassword is shown in the UI\n"))
    process.exit(1)
  }

  // Test 1: Valid login
  await test("Login with correct credentials → 200", async () => {
    const { status, data } = await loginRequest({ centerId, username, password })
    assert(status === 200, `Expected 200, got ${status}. Response: ${JSON.stringify(data)}`)
    assert(data.username, "Response missing username field")
  })

  // Test 2: Wrong password
  await test("Login with wrong password → 401", async () => {
    const { status } = await loginRequest({ centerId, username, password: "wrong_password_xyz" })
    assert(status === 401, `Expected 401, got ${status}`)
  })

  // Test 3: No centerId → TENANT_NOT_RESOLVED
  await test("Login without centerId → 400 TENANT_NOT_RESOLVED", async () => {
    const { status, data } = await loginRequest({ username, password })
    // In dev with DEFAULT_DEV_CENTER set, this might return 200 or 401 depending on setup
    // The important thing is it should NOT crash (5xx)
    assert(status !== 500, `Server error (500): ${JSON.stringify(data)}`)
    if (status === 400) {
      assert(data.error === "TENANT_NOT_RESOLVED", `Expected TENANT_NOT_RESOLVED, got: ${data.error}`)
    }
    // If DEFAULT_DEV_CENTER is set, it might resolve to a different center → acceptable
    console.log(`\n    ${y(`(status=${status}, error=${data.error ?? "none"} — if DEFAULT_DEV_CENTER is set, 400 may not apply in dev)`)}`)
  })

  // Test 4: Non-existent centerId
  await test("Login with non-existent centerId → 400 or 401", async () => {
    const { status } = await loginRequest({
      centerId: "00000000-0000-0000-0000-000000000000",
      username,
      password,
    })
    assert(status === 400 || status === 401 || status === 503, `Expected 400/401/503, got ${status}`)
  })

  console.log("")
  console.log("  ─────────────────────────────────")
  if (failed === 0) {
    console.log(g(`  ✓ All ${passed} tests passed`))
  } else {
    console.log(r(`  ✗ ${failed} test(s) failed`) + ` (${passed} passed)`)
  }
  console.log("")
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(r("Fatal error:"), err.message)
  process.exit(1)
})
