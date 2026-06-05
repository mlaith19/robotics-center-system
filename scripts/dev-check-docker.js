#!/usr/bin/env node
/**
 * scripts/dev-check-docker.js
 *
 * Checks Docker container status and PostgreSQL connectivity.
 *
 * USAGE:
 *   node scripts/dev-check-docker.js
 *
 * WHAT IT CHECKS:
 *   1. Docker is running (docker info)
 *   2. "robotics-db" container is running (docker ps)
 *   3. Master DB connection (DATABASE_URL / MASTER_DATABASE_URL)
 *   4. DEFAULT_DEV_CENTER exists in centers table
 *
 * No external dependencies beyond what's already in the project.
 */

const { execSync }     = require("child_process")
const { Client }       = require("pg")
const path             = require("path")
const fs               = require("fs")

// ── Load .env.local ───────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local")
  if (!fs.existsSync(envPath)) {
    console.warn("  ⚠  .env.local not found")
    return
  }
  const lines = fs.readFileSync(envPath, "utf8").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

// ── Colours ───────────────────────────────────────────────────────────────────
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", B = "\x1b[36m", Z = "\x1b[0m"
const OK   = `${G}✔${Z}`
const FAIL = `${R}❌${Z}`
const WARN = `${Y}⚠ ${Z}`

function pass(msg) { console.log(`  ${OK}  ${G}${msg}${Z}`) }
function fail(msg) { console.log(`  ${FAIL} ${R}${msg}${Z}`); process.exitCode = 1 }
function warn(msg) { console.log(`  ${WARN} ${Y}${msg}${Z}`) }
function info(msg) { console.log(`     ${B}→${Z} ${msg}`) }

// ── Docker helpers ────────────────────────────────────────────────────────────
function runShell(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: "utf8", stdio: ["pipe","pipe","pipe"] }).trim() }
  } catch (e) {
    return { ok: false, out: (e.stderr || e.message || "").trim() }
  }
}

// ── DB helper ─────────────────────────────────────────────────────────────────
async function tryConnect(url, label) {
  if (!url) {
    warn(`${label}: not set in env`)
    return null
  }
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 })
  try {
    await client.connect()
    const res = await client.query("SELECT version()")
    const ver = res.rows[0]?.version?.split(" ").slice(0, 2).join(" ") ?? "unknown"
    pass(`${label} connected — ${ver}`)
    return client
  } catch (e) {
    fail(`${label} connection FAILED: ${e.message}`)
    info("Make sure Docker is running: docker start robotics-db")
    return null
  } finally {
    try { await client.end() } catch { /* ignore */ }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${B}=== Dev Environment Check ===${Z}`)
  console.log(`  ${new Date().toLocaleString("he-IL")}\n`)

  // ── Step 1: Docker daemon ─────────────────────────────────────────────────
  console.log("1. Docker daemon")
  const dockerInfo = runShell("docker info --format \"{{.ServerVersion}}\"")
  if (dockerInfo.ok && dockerInfo.out) {
    pass(`Docker is running (Engine ${dockerInfo.out})`)
  } else {
    fail("Docker is NOT running")
    info("Open Docker Desktop and wait for it to start")
    info("Then run this check again")
    console.log()
    process.exit(1)
  }

  // ── Step 2: robotics-db container ────────────────────────────────────────
  console.log("\n2. PostgreSQL container (robotics-db)")
  const psResult = runShell("docker ps --filter name=robotics-db --format \"{{.Names}}|{{.Status}}\"")
  if (psResult.ok && psResult.out.includes("robotics-db")) {
    const status = psResult.out.split("|")[1] ?? ""
    if (status.toLowerCase().startsWith("up")) {
      pass(`Container robotics-db is UP — ${status}`)
    } else {
      warn(`Container robotics-db exists but status: ${status}`)
      info("Try: docker start robotics-db")
    }
  } else {
    // Container may be named differently — list all postgres containers
    const allPs = runShell("docker ps --filter ancestor=postgres --format \"{{.Names}}|{{.Status}}\"")
    if (allPs.ok && allPs.out) {
      warn(`Container 'robotics-db' not found but other postgres containers running:`)
      allPs.out.split("\n").forEach((l) => info(l))
    } else {
      fail("No PostgreSQL container found")
      info("Start with:  docker run --name robotics-db -e POSTGRES_USER=robotics -e POSTGRES_PASSWORD=robotics -e POSTGRES_DB=robotics -p 5432:5432 -d postgres:16-alpine")
    }
  }

  // ── Step 3: Database connections ──────────────────────────────────────────
  console.log("\n3. Database connectivity")
  const masterUrl = process.env.MASTER_DATABASE_URL ?? process.env.DATABASE_URL
  const client    = await tryConnect(masterUrl, "Master DB")

  // ── Step 4: Verify DEFAULT_DEV_CENTER ─────────────────────────────────────
  const devCenter = process.env.DEFAULT_DEV_CENTER
  console.log(`\n4. DEFAULT_DEV_CENTER`)
  if (!devCenter) {
    warn("DEFAULT_DEV_CENTER is not set in .env.local")
    info("Add: DEFAULT_DEV_CENTER=dem  (or use the center slug/UUID)")
  } else {
    info(`DEFAULT_DEV_CENTER = "${devCenter}"`)
    if (client) {
      // Re-connect for query
      const c2 = new Client({ connectionString: masterUrl, connectionTimeoutMillis: 5000 })
      try {
        await c2.connect()
        // Try as UUID first, then as subdomain
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        let row
        if (uuidRe.test(devCenter)) {
          const r = await c2.query("SELECT id, subdomain, name FROM centers WHERE id = $1 LIMIT 1", [devCenter])
          row = r.rows[0]
        } else {
          const r = await c2.query("SELECT id, subdomain, name FROM centers WHERE subdomain = $1 LIMIT 1", [devCenter])
          row = r.rows[0]
        }

        if (row) {
          pass(`Center found: id=${row.id} slug=${row.subdomain} name="${row.name}"`)
        } else {
          fail(`Center "${devCenter}" NOT found in centers table`)
          info("Run: node scripts/seed-demo-center.js")
          info("Or create a center from the Master Portal first")
        }
      } catch (e) {
        warn(`Could not query centers table: ${e.message}`)
      } finally {
        try { await c2.end() } catch { /* ignore */ }
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log()
  if (process.exitCode === 1) {
    console.log(`${R}Some checks failed. Fix the issues above and run again.${Z}`)
    console.log()
    console.log(`${Y}Quick fix:${Z}`)
    console.log(`  1. Open Docker Desktop`)
    console.log(`  2. Run: docker start robotics-db`)
    console.log(`  3. Run: node scripts/dev-check-docker.js`)
    console.log(`  4. Run: npm run dev`)
  } else {
    console.log(`${G}All checks passed! The system is ready.${Z}`)
    console.log()
    console.log(`${B}Test login:${Z}`)
    console.log(`  http://localhost:3000/login?center=${devCenter || "dem"}`)
  }
  console.log()
}

main().catch((e) => {
  console.error(`\n${R}Fatal error:${Z}`, e.message)
  process.exit(1)
})
