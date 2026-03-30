#!/usr/bin/env node

/**
 * Master self-check runner.
 * Runs all phase self-checks sequentially.
 */

const { spawn } = require("child_process")
const path = require("path")
const fs = require("fs")

// Load .env.local into process.env so all child scripts inherit it
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "../../.env.local")
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, "utf8").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
    if (key && !process.env[key]) process.env[key] = val
  }
}
loadEnvLocal()

const checks = [
  "phase0-baseline.js",
  "phase1-master-plane.js",
  "phase2-subdomain-resolution.js",
  "phase3-tenant-db.js",
  "phase4-tenant-schema.js",
  "phase6-center-admin-security.js",
  "phase8-serial-activation.js",
  "phase9-trial-system.js",
  "phase10-feature-gating.js",
  "phase11-upgrade-downgrade.js",
  "phase12-notification-system.js",
  "phase13-tenant-migration-runner.js",
  "phase14-backup-system.js",
  "phase16-master-portal.js",
]

function runScript(scriptPath) {
  return new Promise((resolve) => {
    console.log(`\n>>> Running self-check: ${scriptPath}`)
    const proc = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      cwd: path.join(__dirname),
      env: process.env, // pass loaded .env.local vars to child processes
    })
    proc.on("exit", (code) => {
      if (code !== 0) {
        console.error(`<<< Self-check FAILED: ${scriptPath} (exit code ${code})`)
        resolve({ script: scriptPath, code })
      } else {
        console.log(`<<< Self-check PASSED: ${scriptPath}`)
        resolve({ script: scriptPath, code: 0 })
      }
    })
  })
}

async function main() {
  console.log("=== RUNNING ALL SELF-CHECKS ===")
  for (const script of checks) {
    const res = await runScript(script)
    if (res.code !== 0) {
      console.error("SELF-CHECK SUITE: FAIL")
      process.exit(res.code)
    }
  }
  console.log("\nSELF-CHECK SUITE: ALL PASS")
  process.exit(0)
}

main().catch((err) => {
  console.error("SELF-CHECK SUITE: UNEXPECTED ERROR", err)
  process.exit(1)
})

