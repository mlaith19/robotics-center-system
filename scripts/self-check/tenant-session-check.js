#!/usr/bin/env node
/**
 * scripts/self-check/tenant-session-check.js
 *
 * End-to-end validation of tenant session auth and Set-Cookie refresh.
 *
 * USAGE:
 *   1) With an existing cookie:
 *      $env:TENANT_COOKIE="tenant-session=<value>"
 *      node scripts/self-check/tenant-session-check.js
 *
 *   2) Auto-login (dev only, needs running server):
 *      node scripts/self-check/tenant-session-check.js --auto-login
 *
 *   3) Custom base URL + center:
 *      node scripts/self-check/tenant-session-check.js --base-url http://localhost:3000 --center-id <uuid>
 *
 * No external dependencies.
 */

const http  = require("http")
const https = require("https")

// ── Config ────────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2)
const BASE_URL   = getArg("--base-url")  || "http://localhost:3000"
const CENTER_ID  = getArg("--center-id") || ""
const AUTO_LOGIN = args.includes("--auto-login")

function getArg(flag) {
  const i = args.indexOf(flag)
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function req(method, path, { cookie, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const lib = url.protocol === "https:" ? https : http
    const opts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === "https:" ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    }

    const request = lib.request(opts, (res) => {
      let data = ""
      res.on("data", (chunk) => (data += chunk))
      res.on("end", () => {
        let json = null
        try { json = JSON.parse(data) } catch { /* binary or non-JSON */ }
        const setCookie = res.headers["set-cookie"] || []
        resolve({ status: res.statusCode, json, setCookie, raw: data })
      })
    })
    request.on("error", reject)
    if (body) request.write(JSON.stringify(body))
    request.end()
  })
}

// ── Colours ───────────────────────────────────────────────────────────────────
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", B = "\x1b[36m", Z = "\x1b[0m"
const OK   = `${G}✓${Z}`
const FAIL = `${R}✗${Z}`
const INFO = `${B}→${Z}`

function pass(msg) { console.log(`  ${OK} ${msg}`) }
function fail(msg) { console.log(`  ${FAIL} ${R}${msg}${Z}`); process.exitCode = 1 }
function info(msg) { console.log(`  ${INFO} ${Y}${msg}${Z}`) }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${B}=== Tenant Session Self-Check ===${Z}`)
  console.log(`  Base URL : ${BASE_URL}`)
  console.log(`  Center   : ${CENTER_ID || "(default)"}`)
  console.log()

  // ── Step 1: Ping ─────────────────────────────────────────────────────────
  console.log("1. Ping server")
  try {
    const r = await req("GET", "/api/_debug/ping")
    if (r.status === 200 && r.json?.status === "ok") {
      pass(`Server is up (${r.json.env})`)
    } else {
      fail(`Unexpected response: ${r.status}`)
    }
  } catch (e) {
    fail(`Cannot connect to ${BASE_URL} — is the server running? (${e.message})`)
    console.log()
    return
  }

  // ── Step 2: Auth without cookie ──────────────────────────────────────────
  console.log("\n2. Auth check (no cookie)")
  const noAuthPath = CENTER_ID ? `/api/_debug/auth?centerId=${CENTER_ID}` : "/api/_debug/auth"
  const noAuth = await req("GET", noAuthPath)
  if (noAuth.status === 200) {
    const reason = noAuth.json?.auth?.failureReason
    if (reason === "missing_cookie") {
      pass(`Correctly reports missing_cookie`)
    } else {
      info(`failureReason = ${reason}`)
    }
  } else {
    fail(`Expected 200 from /api/_debug/auth, got ${noAuth.status}`)
  }

  // ── Step 3: Obtain cookie ────────────────────────────────────────────────
  let TENANT_COOKIE = process.env.TENANT_COOKIE || ""

  if (!TENANT_COOKIE && AUTO_LOGIN) {
    console.log("\n3. Auto-login via /api/_debug/login-as-seed-admin")
    const loginPath = CENTER_ID
      ? `/api/_debug/login-as-seed-admin?centerId=${CENTER_ID}`
      : "/api/_debug/login-as-seed-admin"
    const login = await req("POST", loginPath)
    if (login.status === 200 && login.json?.ok) {
      const cookieHeader = login.setCookie.find((c) => c.startsWith("tenant-session="))
      if (cookieHeader) {
        TENANT_COOKIE = cookieHeader.split(";")[0]
        pass(`Logged in as ${login.json.username} (role: ${login.json.role})`)
        pass(`Cookie obtained: tenant-session=****`)
      } else {
        fail("No tenant-session Set-Cookie in response")
      }
    } else {
      fail(`Auto-login failed: ${login.status} — ${JSON.stringify(login.json)}`)
    }
  } else if (!TENANT_COOKIE) {
    console.log("\n3. No cookie provided")
    info("Set TENANT_COOKIE env var or use --auto-login flag")
    info("Skipping authenticated tests")
    console.log(`\n${Y}Partial check complete. Run with --auto-login to test full flow.${Z}\n`)
    return
  } else {
    console.log("\n3. Using provided TENANT_COOKIE")
    pass("Cookie loaded from env")
  }

  // ── Step 4: Auth with cookie ─────────────────────────────────────────────
  console.log("\n4. Auth check (with cookie)")
  const withAuth = await req("GET", noAuthPath, { cookie: TENANT_COOKIE })
  if (withAuth.status === 200) {
    const { ok, failureReason } = withAuth.json?.auth || {}
    if (ok) {
      pass(`Auth OK — user: ${withAuth.json?.user?.username}, role: ${withAuth.json?.user?.role}`)
    } else {
      fail(`Auth failed — reason: ${failureReason} — hint: ${withAuth.json?.auth?.hint}`)
    }
  } else {
    fail(`Expected 200 from /api/_debug/auth, got ${withAuth.status}`)
  }

  // ── Step 5: Call /api/students ───────────────────────────────────────────
  console.log("\n5. GET /api/students with cookie")
  const studentsPath = CENTER_ID ? `/api/students?centerId=${CENTER_ID}` : "/api/students"
  const students = await req("GET", studentsPath, { cookie: TENANT_COOKIE })

  if (students.status === 200) {
    pass(`Status 200 — returned ${Array.isArray(students.json) ? students.json.length : "?"} student(s)`)
  } else if (students.status === 401) {
    fail(`Status 401 — session is invalid or expired`)
    if (withAuth.json?.auth?.failureReason) {
      info(`Auth failure reason: ${withAuth.json.auth.failureReason}`)
    }
  } else if (students.status === 403) {
    info(`Status 403 — authenticated but role not in ALLOWED_ROLES (expected for some roles)`)
  } else {
    fail(`Unexpected status: ${students.status}`)
  }

  const refreshCookie = students.setCookie?.find((c) => c.startsWith("tenant-session="))
  if (refreshCookie) {
    pass(`Set-Cookie: tenant-session=**** present — session refresh working!`)
  } else {
    fail(`No Set-Cookie header returned — session will NOT be refreshed (check middleware.ts or withTenantAuth)`)
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log()
  if (process.exitCode === 1) {
    console.log(`${R}Some checks failed. See above for details.${Z}`)
  } else {
    console.log(`${G}All checks passed!${Z}`)
  }
  console.log()
}

main().catch((e) => {
  console.error(`\n${R}Fatal error:${Z}`, e.message)
  process.exit(1)
})
