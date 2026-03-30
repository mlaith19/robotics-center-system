#!/usr/bin/env node

/**
 * PHASE 14 – BACKUP SYSTEM SELF-CHECK
 *
 * Validates:
 * - backup-master-db.js and backup-tenant-dbs.js exist
 * - DEPLOY.md documents backup and restore procedure
 *
 * Exits: 0 on PASS, 1 on FAIL
 */

const fs = require("fs")
const path = require("path")

function main() {
  console.log("=== PHASE 14 SELF-CHECK: BACKUP SYSTEM ===")

  const scriptsDir = path.join(__dirname, "..")
  const deployPath = path.join(__dirname, "..", "..", "DEPLOY.md")

  if (!fs.existsSync(path.join(scriptsDir, "backup-master-db.js"))) {
    console.error("[backup-master-db.js] FAIL - not found")
    process.exit(1)
  }
  console.log("[backup-master-db.js] PASS")

  if (!fs.existsSync(path.join(scriptsDir, "backup-tenant-dbs.js"))) {
    console.error("[backup-tenant-dbs.js] FAIL - not found")
    process.exit(1)
  }
  console.log("[backup-tenant-dbs.js] PASS")

  if (!fs.existsSync(deployPath)) {
    console.error("[DEPLOY.md] FAIL - not found")
    process.exit(1)
  }
  const deploy = fs.readFileSync(deployPath, "utf8")
  if (!deploy.includes("backup-master-db") || !deploy.includes("backup-tenant-dbs") || !deploy.includes("Restore")) {
    console.error("[DEPLOY.md] FAIL - backup/restore section missing or incomplete")
    process.exit(1)
  }
  console.log("[DEPLOY.md backup/restore] PASS")

  console.log("PHASE 14 SELF-CHECK: PASS")
  process.exit(0)
}

main()
