#!/usr/bin/env node

/**
 * Phase 14: Backup all tenant databases (from master centers.tenant_db_url).
 * Usage: node scripts/backup-tenant-dbs.js [output_dir]
 * Output: output_dir/<center_id>_YYYY-MM-DD_HH-mm-ss.sql
 */

const postgres = require("postgres")
const { spawnSync } = require("child_process")
const path = require("path")
const fs = require("fs")

function getMasterUrl() {
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

async function main() {
  const outDir = process.argv[2] || path.join(process.cwd(), "backups", "tenants")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const sql = postgres(getMasterUrl(), { max: 1 })
  const centers = await sql`SELECT id, name, tenant_db_url FROM centers WHERE tenant_db_url IS NOT NULL AND tenant_db_url != ''`
  await sql.end()

  if (centers.length === 0) {
    console.log("No tenant databases configured.")
    process.exit(0)
    return
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  for (const c of centers) {
    const { host, port, database, user, password } = parseUrl(c.tenant_db_url)
    const safeId = c.id.replace(/[^a-zA-Z0-9-_]/g, "_")
    const outFile = path.join(outDir, `${safeId}_${ts}.sql`)
    const env = { ...process.env, PGPASSWORD: password }
    const r = spawnSync("pg_dump", ["-h", host, "-p", port, "-U", user, "-d", database, "-f", outFile], { env, stdio: "inherit" })
    if (r.status !== 0) console.error("Backup failed for", c.id)
    else console.log("Backup:", outFile)
  }
  console.log("Tenant backups done.")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
