#!/usr/bin/env node
/**
 * start-dev.js — מפעיל DB + שרת Next.js בפקודה אחת
 *
 * שימוש: npm run start:dev
 *
 * מה הסקריפט עושה:
 *  1. מריץ docker compose up -d (DB)
 *  2. ממתין 3 שניות
 *  3. בודק אם פורט 3000 תפוס — ומשחרר אותו אוטומטית
 *  4. מוחק את .next/dev/lock אם קיים
 *  5. מפעיל npm run dev
 */

const { execSync, spawn } = require("child_process")
const fs = require("fs")
const path = require("path")
const net = require("net")

const ROOT = path.resolve(__dirname, "..")
const PORT = 3000

// Colors
const g = (s) => `\x1b[32m${s}\x1b[0m`
const y = (s) => `\x1b[33m${s}\x1b[0m`
const b = (s) => `\x1b[36m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: "inherit", ...opts })
    return true
  } catch {
    return false
  }
}

function findPidOnPort(port) {
  try {
    const out = execSync(`netstat -ano`, { encoding: "utf8" })
    const lines = out.split("\n")
    for (const line of lines) {
      if (line.includes(`:${port} `) && line.includes("LISTENING")) {
        const parts = line.trim().split(/\s+/)
        const pid = parseInt(parts[parts.length - 1])
        if (!isNaN(pid) && pid > 0) return pid
      }
    }
  } catch {}
  return null
}

function killPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: "pipe" })
    return true
  } catch {}
  return false
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.once("error", () => resolve(false))
    s.once("listening", () => { s.close(); resolve(true) })
    s.listen(port)
  })
}

async function main() {
  console.log("")
  console.log(bold(b("══════════════════════════════════════════")))
  console.log(bold(b("  🚀 Robotics Center — Dev Startup")))
  console.log(bold(b("  מאסטר: /master    |    משנה: /dashboard")))
  console.log(bold(b("══════════════════════════════════════════")))
  console.log("")

  // 1. Start DB
  console.log(b("▶ Step 1: Starting database (Docker)..."))
  const dbOk = run("docker compose up -d", { cwd: ROOT })
  if (dbOk) {
    console.log(g("  ✓ DB is running"))
  } else {
    console.log(y("  ⚠ Docker not available or already running — continuing"))
  }

  // 2. Clean up port 3000 if busy
  console.log(b(`\n▶ Step 2: Checking port ${PORT}...`))
  const portFree = await isPortFree(PORT)
  if (!portFree) {
    const pid = findPidOnPort(PORT)
    if (pid) {
      console.log(y(`  ⚠ Port ${PORT} is in use by PID ${pid} — killing it...`))
      const killed = killPid(pid)
      if (killed) {
        console.log(g(`  ✓ PID ${pid} terminated`))
        await new Promise((r) => setTimeout(r, 1500))
      } else {
        console.log(y(`  ⚠ Could not kill PID ${pid} — dev server may use another port`))
      }
    }
  } else {
    console.log(g(`  ✓ Port ${PORT} is free`))
  }

  // 3. Remove stale Next.js lock
  console.log(b("\n▶ Step 3: Clearing Next.js dev lock..."))
  const lockPath = path.join(ROOT, ".next", "dev", "lock")
  if (fs.existsSync(lockPath)) {
    try {
      fs.rmSync(lockPath, { force: true })
      console.log(g("  ✓ Lock file removed"))
    } catch {
      console.log(y("  ⚠ Could not remove lock file — may cause issues"))
    }
  } else {
    console.log(g("  ✓ No lock file (clean)"))
  }

  // 4. Start Next.js dev (with auto-restart on crash)
  console.log(b("\n▶ Step 4: Starting Next.js dev server..."))
  console.log(g(`  ✓ Server will be available at http://localhost:${PORT}`))
  console.log(g(`  ✓ Tenant Dashboard: http://localhost:${PORT}/dashboard`))
  console.log(g(`  ✓ Master Portal:    http://localhost:${PORT}/master/login`))
  console.log(g(`  ✓ Master login:     owner / Master@12345`))
  console.log(y(`  ↺ Auto-restart enabled — server will recover from crashes`))

  // Schema version reminder
  try {
    const { APP_SCHEMA_VERSION } = require("../lib/schema-version")
    console.log(b(`\n  📋 APP_SCHEMA_VERSION = v${APP_SCHEMA_VERSION}`))
    console.log(y(`  ⚠  Remember: after schema changes, run "Run All Migrations" in /master/ops`))
  } catch { /* schema-version.ts not yet compiled in dev — skip */ }
  console.log("")

  let restartCount = 0
  let intentionalExit = false

  function startNext() {
    const dev = spawn("npm", ["run", "dev"], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
      shell: true,
    })

    dev.on("exit", (code) => {
      if (intentionalExit) { process.exit(0); return }
      if (code === 0) { process.exit(0); return }

      restartCount++
      const delay = Math.min(2000 * restartCount, 10000)
      console.log("")
      console.log(y(`  ⚠ Server crashed (exit ${code}). Restarting in ${delay / 1000}s... [attempt #${restartCount}]`))
      setTimeout(() => {
        // Clean stale lock before restart
        const lockPath = path.join(ROOT, ".next", "dev", "lock")
        if (fs.existsSync(lockPath)) {
          try { fs.rmSync(lockPath, { force: true }) } catch {}
        }
        startNext()
      }, delay)
    })

    process.on("SIGINT", () => {
      intentionalExit = true
      dev.kill("SIGINT")
      process.exit(0)
    })
  }

  startNext()
}

main().catch((err) => {
  console.error("Startup failed:", err.message)
  process.exit(1)
})
