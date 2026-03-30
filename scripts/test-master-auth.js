/**
 * Integration smoke test: master auth flow.
 *
 * Usage:
 *   node scripts/test-master-auth.js
 *
 * Environment:
 *   APP_URL  – defaults to http://localhost:3000
 *   MASTER_USERNAME / MASTER_PASSWORD – credentials to test with
 */

const BASE = process.env.APP_URL || "http://localhost:3000"
const USER = process.env.MASTER_USERNAME || "owner"
const PASS = process.env.MASTER_PASSWORD || "Master@12345"

async function run() {
  console.log(`\n=== Master Auth Smoke Test  [${BASE}] ===\n`)
  let passed = 0
  let failed = 0

  // ── Step 1: login ─────────────────────────────────────────────────────────
  console.log("1) POST /api/master/auth/login …")
  const loginRes = await fetch(`${BASE}/api/master/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ username: USER, password: PASS }),
    redirect: "manual",
  })
  const loginBody = await loginRes.json().catch(() => ({}))
  const setCookie = loginRes.headers.get("set-cookie") ?? ""
  const masterCookieMatch = setCookie.match(/master-session=([^;]+)/)
  const masterCookieValue  = masterCookieMatch?.[1] ?? null

  if (loginRes.status === 200 && loginBody.ok) {
    console.log(`   ✅  200 OK  role="${loginBody.role}"`)
    passed++
  } else {
    console.error(`   ❌  ${loginRes.status}  body=${JSON.stringify(loginBody)}`)
    failed++
    process.exit(1)
  }

  if (masterCookieValue) {
    console.log(`   ✅  master-session cookie received (length=${masterCookieValue.length})`)
    passed++
  } else {
    console.error(`   ❌  master-session cookie NOT found in Set-Cookie`)
    console.error(`        Set-Cookie: ${setCookie}`)
    failed++
  }

  // ── Step 2: verify cookie can be decoded locally ──────────────────────────
  console.log("2) Decode master-session locally …")
  try {
    // The new format is base64url.  Try all three formats to mirror the middleware.
    const raw = masterCookieValue
    let session = null

    // base64url
    try {
      const b64 = raw.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(raw.length / 4) * 4, "=")
      session = JSON.parse(Buffer.from(b64, "base64").toString("utf8"))
    } catch { /* fall through */ }

    // raw JSON
    if (!session) {
      try { session = JSON.parse(raw) } catch { /* fall through */ }
    }

    // percent-encoded JSON
    if (!session) {
      try { session = JSON.parse(decodeURIComponent(raw)) } catch { /* fall through */ }
    }

    if (!session) throw new Error("All decode attempts failed")

    const roleKey = typeof session.roleKey === "string" ? session.roleKey.toUpperCase()
                  : typeof session.role    === "string" ? session.role.toUpperCase()
                  : "(missing)"

    const MASTER_ROLES = new Set(["OWNER", "MASTER_ADMIN", "SUPPORT"])
    if (MASTER_ROLES.has(roleKey)) {
      console.log(`   ✅  Decoded roleKey="${roleKey}" — accepted by MASTER_ROLES`)
      passed++
    } else {
      console.error(`   ❌  Decoded roleKey="${roleKey}" — NOT in MASTER_ROLES`)
      console.error(`        Full session: ${JSON.stringify(session)}`)
      failed++
    }
  } catch (e) {
    console.error(`   ❌  Decode error: ${e.message}`)
    failed++
  }

  // ── Step 3: access /api/master/centers with the cookie ────────────────────
  console.log("3) GET /api/master/centers (with master-session) …")
  if (masterCookieValue) {
    const centersRes = await fetch(`${BASE}/api/master/centers`, {
      headers: { Cookie: `master-session=${masterCookieValue}` },
      redirect: "manual",
    })
    if (centersRes.status === 200) {
      console.log(`   ✅  200 OK — middleware accepted master-session`)
      passed++
    } else if (centersRes.status === 302 || centersRes.status === 307 || centersRes.status === 308) {
      const loc = centersRes.headers.get("location") ?? ""
      console.error(`   ❌  Redirect → ${loc}  (middleware rejected session)`)
      failed++
    } else {
      console.error(`   ❌  ${centersRes.status}`)
      failed++
    }
  } else {
    console.warn("   ⏭  Skipped (no cookie from step 1)")
  }

  // ── Step 4: wrong password returns 401, not redirect ──────────────────────
  console.log("4) POST /api/master/auth/login — wrong password …")
  const badRes = await fetch(`${BASE}/api/master/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ username: USER, password: "wrong_password_xyz" }),
    redirect: "manual",
  })
  if (badRes.status === 401) {
    console.log(`   ✅  401 returned — login page stays on /master/login`)
    passed++
  } else {
    console.error(`   ❌  Expected 401, got ${badRes.status}`)
    failed++
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})
