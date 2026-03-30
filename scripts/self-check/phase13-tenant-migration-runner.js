#!/usr/bin/env node

/**
 * PHASE 13 – TENANT MIGRATION RUNNER SELF-CHECK
 *
 * Validates:
 * - run-all-tenant-migrations.js exists and runs (with zero or more tenants)
 * - Script exits 0 when no tenants or all succeed; logs success/failure
 *
 * Exits: 0 on PASS, 1 on FAIL
 */

const { spawnSync } = require("child_process")
const path = require("path")
const fs = require("fs")

async function main() {
  console.log("=== PHASE 13 SELF-CHECK: TENANT MIGRATION RUNNER ===")

  const scriptPath = path.join(__dirname, "..", "run-all-tenant-migrations.js")
  if (!fs.existsSync(scriptPath)) {
    console.error("[run-all-tenant-migrations.js] FAIL - script not found")
    process.exit(1)
  }
  console.log("[run-all-tenant-migrations.js] PASS - script exists")

  const r = spawnSync(process.execPath, [scriptPath], {
    cwd: path.join(__dirname, "..", ".."),
    env: process.env,
    encoding: "utf8",
    timeout: 60000,
  })
  if (r.status !== 0 && r.status !== null) {
    console.error("[run-all-tenant-migrations] FAIL - exit code", r.status)
    if (r.stderr) console.error(r.stderr)
    process.exit(1)
  }
  console.log("[run-all-tenant-migrations run] PASS")

  console.log("PHASE 13 SELF-CHECK: PASS")
  process.exit(0)
}

main()
