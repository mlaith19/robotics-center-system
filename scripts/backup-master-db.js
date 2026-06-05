#!/usr/bin/env node

/**
 * Phase 14: Backup master database using pg_dump.
 * Usage: node scripts/backup-master-db.js [output_dir]
 * Output: output_dir/robotics_master_YYYY-MM-DD_HH-mm-ss.sql (default: ./backups)
 */

const { spawnSync } = require("child_process")
const path = require("path")
const fs = require("fs")

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.MASTER_DATABASE_URL
  if (url && url.trim().length > 0) return url.trim()
  const host = process.env.DB_HOST || "localhost"
  const port = process.env.DB_PORT || "5432"
  const name = process.env.DB_NAME || "robotics"
  const user = process.env.DB_USER || "robotics"
  const pass = process.env.DB_PASS || "robotics"
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${encodeURIComponent(name)}`
}

function parseUrl(url) {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: u.port || "5432",
    database: u.pathname.slice(1) || "robotics",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  }
}

function main() {
  const outDir = process.argv[2] || path.join(process.cwd(), "backups")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const url = getDatabaseUrl()
  const { host, port, database, user, password } = parseUrl(url)
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const outFile = path.join(outDir, `robotics_master_${ts}.sql`)

  const env = { ...process.env, PGPASSWORD: password }
  const r = spawnSync("pg_dump", ["-h", host, "-p", port, "-U", user, "-d", database, "-f", outFile], {
    env,
    stdio: "inherit",
  })
  if (r.status !== 0) {
    console.error("pg_dump failed")
    process.exit(1)
  }
  console.log("Master backup written:", outFile)
  process.exit(0)
}

main()
