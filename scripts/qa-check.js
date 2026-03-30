#!/usr/bin/env node
/**
 * qa-check.js — Pre-production automated QA gate
 *
 * Usage:
 *   node scripts/qa-check.js [--base-url http://localhost:3000]
 *
 * Checks:
 *   1. All health endpoints return 200
 *   2. Public pages return 200
 *   3. Protected API endpoints return 401/403 (not 500)
 *   4. Master portal protected endpoints return 401/403
 *   5. Static assets accessible
 */

const BASE_URL = (() => {
  const arg = process.argv.find((a) => a.startsWith("--base-url="))
  if (arg) return arg.split("=")[1]
  const idx = process.argv.indexOf("--base-url")
  if (idx !== -1) return process.argv[idx + 1]
  return "http://localhost:3000"
})()

const TIMEOUT_MS = 8000

// ── Colors ────────────────────────────────────────────────────────────────────
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function get(path, { expectedStatuses = [200], label } = {}) {
  const url = `${BASE_URL}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "manual", // don't follow redirects, we check them explicitly
    })
    clearTimeout(timer)
    const ok = expectedStatuses.includes(res.status)
    return { ok, status: res.status, url, label: label || path }
  } catch (err) {
    clearTimeout(timer)
    const isTimeout = err.name === "AbortError"
    return {
      ok: false,
      status: isTimeout ? "TIMEOUT" : "ERROR",
      url,
      label: label || path,
      error: isTimeout ? `Timed out after ${TIMEOUT_MS}ms` : err.message,
    }
  }
}

function printResult(result) {
  const icon = result.ok ? c.green("✓") : c.red("✗")
  const status = result.ok
    ? c.green(result.status)
    : c.red(result.status)
  const label = result.label.padEnd(55)
  const extra = result.error ? c.dim(` (${result.error})`) : ""
  console.log(`  ${icon} ${label} ${status}${extra}`)
}

async function runGroup(name, checks) {
  console.log(`\n${c.cyan(c.bold(`── ${name}`))}`)
  const results = await Promise.all(checks.map((c) => get(c.path, c)))
  results.forEach(printResult)
  const failed = results.filter((r) => !r.ok)
  return { total: results.length, failed: failed.length, results }
}

// ── Check groups ──────────────────────────────────────────────────────────────

const HEALTH = [
  { path: "/api/health",       label: "Health: basic",    expectedStatuses: [200] },
  { path: "/api/health/db",    label: "Health: DB",       expectedStatuses: [200] },
  { path: "/api/health/ready", label: "Health: readiness",expectedStatuses: [200] },
]

const PUBLIC_PAGES = [
  { path: "/login",            label: "Page: /login",     expectedStatuses: [200] },
  { path: "/master/login",     label: "Page: /master/login", expectedStatuses: [200] },
]

// These should redirect to login (3xx) or return 401, NOT 500
const PROTECTED_PAGES = [
  { path: "/dashboard",        label: "Protected page: /dashboard",  expectedStatuses: [200, 302, 307, 308, 401, 403] },
  { path: "/master",           label: "Protected page: /master",     expectedStatuses: [200, 302, 307, 308, 401, 403] },
]

// API endpoints must return 401/403 when called without a session
const PROTECTED_APIS = [
  { path: "/api/auth/me",                  label: "API: /api/auth/me (no session)",         expectedStatuses: [401, 403] },
  { path: "/api/students",                 label: "API: /api/students (no session)",         expectedStatuses: [401, 403] },
  { path: "/api/teachers",                 label: "API: /api/teachers (no session)",         expectedStatuses: [401, 403] },
  { path: "/api/courses",                  label: "API: /api/courses (no session)",          expectedStatuses: [401, 403] },
  { path: "/api/master/centers",           label: "API: /api/master/centers (no session)",   expectedStatuses: [401, 403] },
  { path: "/api/master/plans",             label: "API: /api/master/plans (no session)",     expectedStatuses: [401, 403] },
  { path: "/api/master/licenses",          label: "API: /api/master/licenses (no session)",  expectedStatuses: [401, 403] },
  { path: "/api/master/audit",             label: "API: /api/master/audit (no session)",     expectedStatuses: [401, 403] },
  { path: "/api/master/auth/me",           label: "API: /api/master/auth/me (no session)",   expectedStatuses: [401, 403] },
]

// These should NOT return 500 (we don't care about exact status without data)
const SHOULD_NOT_500 = [
  { path: "/api/schools",        label: "No 500: /api/schools",      expectedStatuses: [200, 401, 403, 404] },
  { path: "/api/cashier",        label: "No 500: /api/cashier",      expectedStatuses: [200, 401, 403, 404] },
  { path: "/api/attendance",     label: "No 500: /api/attendance",   expectedStatuses: [200, 401, 403, 404] },
  { path: "/api/schedule",       label: "No 500: /api/schedule",     expectedStatuses: [200, 401, 403, 404] },
  { path: "/api/settings",       label: "No 500: /api/settings",     expectedStatuses: [200, 401, 403, 404] },
  { path: "/api/reports/finance/revenue", label: "No 500: /api/reports/finance/revenue", expectedStatuses: [200, 401, 403, 404] },
]

// ── Authenticated tenant test (dev-only) ─────────────────────────────────────

/**
 * Uses /api/_debug/login-as-seed-admin to obtain a tenant-session cookie,
 * then calls /api/students and expects 200.
 * Skip gracefully when in production (endpoint returns 404).
 */
async function runAuthenticatedStudentsCheck(centerId) {
  const label = "Authenticated: GET /api/students (seed admin)"
  const icon  = (ok) => ok ? c.green("✓") : c.red("✗")

  try {
    const loginUrl = centerId
      ? `${BASE_URL}/api/_debug/login-as-seed-admin?centerId=${centerId}`
      : `${BASE_URL}/api/_debug/login-as-seed-admin`

    const loginRes = await fetch(loginUrl, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (loginRes.status === 404) {
      console.log(`  ${c.yellow("–")} ${label.padEnd(55)} ${c.yellow("SKIP")} (endpoint not available in prod)`)
      return { ok: true, status: "SKIP", label }
    }

    if (!loginRes.ok) {
      const body = await loginRes.text().catch(() => "")
      console.log(`  ${icon(false)} ${label.padEnd(55)} ${c.red(loginRes.status)} login-as-seed-admin failed: ${body}`)
      return { ok: false, status: loginRes.status, label }
    }

    // Extract Set-Cookie from login response
    const setCookieHeader = loginRes.headers.get("set-cookie") ?? ""
    const sessionCookie   = setCookieHeader
      .split(/,(?=[^ ])/)                       // split multiple Set-Cookie headers
      .map((h) => h.split(";")[0].trim())        // keep only name=value part
      .filter((h) => h.startsWith("tenant-session"))
      .join("; ")

    if (!sessionCookie) {
      console.log(`  ${icon(false)} ${label.padEnd(55)} ${c.red("FAIL")} no tenant-session in Set-Cookie`)
      return { ok: false, status: "NO_COOKIE", label }
    }

    // Now call /api/students with the cookie
    const studentsUrl = centerId
      ? `${BASE_URL}/api/students?centerId=${centerId}`
      : `${BASE_URL}/api/students`

    const studentsRes = await fetch(studentsUrl, {
      headers: { Cookie: sessionCookie },
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    })

    const ok = studentsRes.status === 200
    console.log(`  ${icon(ok)} ${label.padEnd(55)} ${ok ? c.green(studentsRes.status) : c.red(studentsRes.status)}`)
    return { ok, status: studentsRes.status, label }

  } catch (err) {
    const isTimeout = err.name === "AbortError"
    const status    = isTimeout ? "TIMEOUT" : "ERROR"
    console.log(`  ${icon(false)} ${label.padEnd(55)} ${c.red(status)} ${err.message}`)
    return { ok: false, status, label, error: err.message }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(c.bold("\n═══════════════════════════════════════════════════"))
  console.log(c.bold("  🔍 Robotics Center — QA Pre-Production Check"))
  console.log(c.bold(`  Target: ${BASE_URL}`))
  console.log(c.bold("═══════════════════════════════════════════════════"))

  // Phase 0: connectivity check
  console.log(`\n${c.cyan(c.bold("── Phase 0: Server connectivity"))}`)
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      console.log(`  ${c.green("✓")} Server is reachable at ${BASE_URL}`)
    } else {
      console.log(`  ${c.yellow("⚠")} Server responded with ${res.status} — continuing anyway`)
    }
  } catch {
    console.log(`  ${c.red("✗")} Cannot reach ${BASE_URL}`)
    console.log(`  ${c.yellow("→")} Start the server first: npm run dev`)
    process.exit(1)
  }

  const allGroups = []

  allGroups.push(await runGroup("Health Endpoints", HEALTH))
  allGroups.push(await runGroup("Public Pages (expect 200)", PUBLIC_PAGES))
  allGroups.push(await runGroup("Protected Pages (expect 200/3xx/401/403, NOT 500)", PROTECTED_PAGES))
  allGroups.push(await runGroup("Protected APIs — no session (expect 401/403)", PROTECTED_APIS))
  allGroups.push(await runGroup("API Endpoints — must NOT return 500", SHOULD_NOT_500))

  // ── Authenticated tenant access test (dev-only) ───────────────────────────
  const centerId = process.argv.find((a) => a.startsWith("--center-id="))?.split("=")[1] ?? null
  console.log(`\n${c.cyan(c.bold("── Authenticated Tenant Access (dev-only)"))}`)
  if (centerId) console.log(`  ${c.dim(`Using centerId: ${centerId}`)}`)
  const authResult = await runAuthenticatedStudentsCheck(centerId)
  allGroups.push({ total: 1, failed: authResult.ok ? 0 : 1, results: [authResult] })

  // Summary
  const totalChecks = allGroups.reduce((a, g) => a + g.total, 0)
  const totalFailed = allGroups.reduce((a, g) => a + g.failed, 0)
  const totalPassed = totalChecks - totalFailed

  console.log("\n" + c.bold("═══════════════════════════════════════════════════"))
  console.log(c.bold("  Summary"))
  console.log(c.bold("═══════════════════════════════════════════════════"))
  console.log(`  Total checks : ${totalChecks}`)
  console.log(`  ${c.green("Passed")}       : ${totalPassed}`)
  if (totalFailed > 0) {
    console.log(`  ${c.red("Failed")}       : ${totalFailed}`)
  }
  console.log("")

  if (totalFailed === 0) {
    console.log(c.green(c.bold("  ✅  All checks passed — ready for production!")))
  } else {
    console.log(c.red(c.bold(`  ❌  ${totalFailed} check(s) failed — fix before deploying!`)))
    console.log("")
    console.log("  Failed checks:")
    for (const g of allGroups) {
      for (const r of g.results) {
        if (!r.ok) {
          console.log(`    ${c.red("✗")} ${r.label} → got ${c.red(r.status)}${r.error ? ` (${r.error})` : ""}`)
        }
      }
    }
  }
  console.log("")

  process.exit(totalFailed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(c.red("Unexpected error:"), err)
  process.exit(1)
})
