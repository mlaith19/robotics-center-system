#!/usr/bin/env node
/**
 * scripts/self-check/phase5-session-refresh.js
 *
 * Verifies that:
 *   1. /api/_debug/auth reports correct failure reason when no cookie present.
 *   2. /api/_debug/login-as-seed-admin sets a tenant-session cookie.
 *   3. With that cookie, /api/_debug/auth returns authOk=true.
 *   4. With that cookie, GET /api/students returns 200.
 *   5. The response to /api/students contains Set-Cookie (session refresh).
 *
 * Usage:
 *   node scripts/self-check/phase5-session-refresh.js [--base-url http://localhost:3000] [--center-id <uuid>]
 *
 * Required env (optional override):
 *   TENANT_COOKIE   — provide an existing cookie value to skip the login step
 *
 * Exit codes:
 *   0  all checks passed
 *   1  at least one check failed
 */

const BASE_URL = (() => {
  const arg = process.argv.find((a) => a.startsWith("--base-url="))
  if (arg) return arg.split("=").slice(1).join("=")
  const idx = process.argv.indexOf("--base-url")
  if (idx !== -1) return process.argv[idx + 1]
  return "http://localhost:3000"
})()

const CENTER_ID = (() => {
  const arg = process.argv.find((a) => a.startsWith("--center-id="))
  if (arg) return arg.split("=").slice(1).join("=")
  const idx = process.argv.indexOf("--center-id")
  if (idx !== -1) return process.argv[idx + 1]
  return null
})()

const PRE_BAKED_COOKIE = process.env.TENANT_COOKIE || null

// ── Colors ────────────────────────────────────────────────────────────────────
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
}

function pass(label, detail = "") {
  console.log(`  ${c.green("✓")} ${label}${detail ? c.dim(` — ${detail}`) : ""}`)
  return true
}
function fail(label, detail = "") {
  console.log(`  ${c.red("✗")} ${label}${detail ? c.dim(` — ${detail}`) : ""}`)
  return false
}

async function get(url, cookieHeader) {
  const headers = {}
  if (cookieHeader) headers["Cookie"] = cookieHeader
  const res = await fetch(url, { headers, redirect: "manual" })
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body, headers: res.headers }
}

async function post(url, cookieHeader) {
  const headers = { "Content-Type": "application/json" }
  if (cookieHeader) headers["Cookie"] = cookieHeader
  const res = await fetch(url, { method: "POST", headers, redirect: "manual" })
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body, headers: res.headers }
}

function extractTenantCookie(setCookieHeader) {
  if (!setCookieHeader) return null
  const parts = setCookieHeader.split(/,(?=[^ ])/)
  for (const part of parts) {
    const nameVal = part.split(";")[0].trim()
    if (nameVal.startsWith("tenant-session=")) return nameVal
  }
  return null
}

async function main() {
  console.log(c.bold("\n═══════════════════════════════════════════════════"))
  console.log(c.bold("  Phase 5 — Session Refresh Self-Check"))
  console.log(c.bold(`  Target : ${BASE_URL}`))
  if (CENTER_ID) console.log(c.bold(`  CenterId: ${CENTER_ID}`))
  console.log(c.bold("═══════════════════════════════════════════════════\n"))

  let passed = 0
  let failed = 0
  const ok = (r) => { if (r) passed++; else failed++; return r }

  // ── Phase 0: server alive ──────────────────────────────────────────────────
  console.log(c.cyan("── Phase 0: Server alive"))
  try {
    const ping = await get(`${BASE_URL}/api/_debug/ping`)
    ok(pass("Ping responded", `status=${ping.status}`))
  } catch (e) {
    ok(fail("Cannot reach server", e.message))
    console.log(c.red(`\n  Run the dev server first: npm run dev\n`))
    process.exit(1)
  }

  // ── Phase 1: No-cookie auth diagnosis ─────────────────────────────────────
  console.log(c.cyan("\n── Phase 1: Auth diagnosis (no cookie)"))
  {
    const r = await get(`${BASE_URL}/api/_debug/auth`)
    if (ok(r.status !== 500, `GET /api/_debug/auth status=${r.status}`)) {
      const reason = r.body?.auth?.failureReason
      if (reason === "missing_cookie") {
        ok(pass("failureReason=missing_cookie as expected"))
      } else {
        ok(fail(`Unexpected failureReason`, reason ?? "null"))
      }
    }
  }

  // ── Phase 2: Obtain session via login-as-seed-admin ────────────────────────
  console.log(c.cyan("\n── Phase 2: Obtain tenant-session"))
  let sessionCookie = PRE_BAKED_COOKIE

  if (!sessionCookie) {
    const loginUrl = CENTER_ID
      ? `${BASE_URL}/api/_debug/login-as-seed-admin?centerId=${CENTER_ID}`
      : `${BASE_URL}/api/_debug/login-as-seed-admin`

    const r = await post(loginUrl)
    if (r.status === 404) {
      ok(fail("login-as-seed-admin not available", "is NODE_ENV=development?"))
      process.exit(1)
    }
    if (!ok(r.status === 200, `login-as-seed-admin status=${r.status}`)) {
      console.log(c.dim(`  Body: ${JSON.stringify(r.body)}`))
      process.exit(1)
    }
    const setCookie = r.headers.get("set-cookie") ?? ""
    sessionCookie = extractTenantCookie(setCookie)
    if (!ok(!!sessionCookie, "tenant-session cookie in Set-Cookie")) {
      process.exit(1)
    }
    pass("Session obtained", `user=${r.body?.username ?? "?"} role=${r.body?.role ?? "?"}`)
  } else {
    pass("Using pre-baked cookie from TENANT_COOKIE env var")
  }

  // ── Phase 3: Auth diagnosis WITH cookie ────────────────────────────────────
  console.log(c.cyan("\n── Phase 3: Auth diagnosis (with cookie)"))
  {
    const r = await get(`${BASE_URL}/api/_debug/auth`, sessionCookie)
    ok(r.status !== 500, `GET /api/_debug/auth status=${r.status}`)
    const authOk = r.body?.auth?.ok
    if (ok(authOk === true, "auth.ok=true")) {
      pass("Session is valid", `user=${r.body?.user?.username ?? "?"} role=${r.body?.user?.role ?? "?"}`)
    } else {
      fail("Session invalid", `failureReason=${r.body?.auth?.failureReason}`)
    }
  }

  // ── Phase 4: /api/students returns 200 ────────────────────────────────────
  console.log(c.cyan("\n── Phase 4: GET /api/students with session"))
  {
    const studentsUrl = CENTER_ID
      ? `${BASE_URL}/api/students?centerId=${CENTER_ID}`
      : `${BASE_URL}/api/students`

    const r = await get(studentsUrl, sessionCookie)
    ok(r.status === 200, `GET /api/students status=${r.status}`)
    if (r.status === 200) {
      const count = Array.isArray(r.body) ? r.body.length : "?"
      pass("Students returned", `count=${count}`)
    } else {
      fail("Unexpected status", JSON.stringify(r.body).slice(0, 120))
    }
  }

  // ── Phase 5: Set-Cookie present in /api/students response ─────────────────
  console.log(c.cyan("\n── Phase 5: Session refresh cookie in /api/students response"))
  {
    const studentsUrl = CENTER_ID
      ? `${BASE_URL}/api/students?centerId=${CENTER_ID}`
      : `${BASE_URL}/api/students`

    const r = await get(studentsUrl, sessionCookie)
    const setCookie = r.headers.get("set-cookie") ?? ""
    const hasRefresh = setCookie.includes("tenant-session=")
    ok(hasRefresh, "Set-Cookie: tenant-session present")

    if (!hasRefresh) {
      fail("No cookie refresh in response — check middleware or withTenantAuth wrapper")
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(c.bold("\n═══════════════════════════════════════════════════"))
  console.log(`  Passed: ${c.green(passed)}   Failed: ${failed > 0 ? c.red(failed) : c.green(failed)}`)
  if (failed === 0) {
    console.log(c.green(c.bold("  ✅  All session-refresh checks passed!")))
  } else {
    console.log(c.red(c.bold(`  ❌  ${failed} check(s) failed`)))
  }
  console.log("")
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(c.red("Unexpected error:"), err)
  process.exit(1)
})
