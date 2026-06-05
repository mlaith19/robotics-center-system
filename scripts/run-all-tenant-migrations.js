#!/usr/bin/env node

/**
 * Phase 13: Run tenant migrations across all tenant DBs from master.
 * Logs success/failure per center; retries failed once.
 * Usage: node scripts/run-all-tenant-migrations.js
 */

const postgres = require("postgres")
const { spawnSync } = require("child_process")
const path = require("path")

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

const tenantMigrateScript = path.join(__dirname, "run-tenant-migrations.js")

async function main() {
  const sql = postgres(getMasterUrl(), { max: 1 })
  const results = []

  try {
    const centers = await sql`
      SELECT id, name, tenant_db_url FROM centers
      WHERE tenant_db_url IS NOT NULL AND tenant_db_url != ''
    `
    if (centers.length === 0) {
      console.log("No tenant databases configured. Exiting.")
      process.exit(0)
      return
    }

    for (const c of centers) {
      const url = c.tenant_db_url
      const id = c.id
      const name = c.name || id
      const run = (attempt) => {
        const r = spawnSync(process.execPath, [tenantMigrateScript, url], {
          cwd: path.join(__dirname, ".."),
          env: { ...process.env, TENANT_DATABASE_URL: url },
          encoding: "utf8",
        })
        return r
      }
      let r = run(1)
      if (r.status !== 0) {
        console.log(`Retry center ${name} (${id})...`)
        r = run(2)
      }
      const success = r.status === 0
      results.push({ centerId: id, name, success, status: r.status })
      console.log(success ? `[OK] ${name} (${id})` : `[FAIL] ${name} (${id}) exit ${r.status}`)
    }

    const failed = results.filter((x) => !x.success)
    if (failed.length > 0) {
      console.error("Failed centers:", failed.length)
      process.exit(1)
    }
    console.log("All tenant migrations completed successfully.")
    process.exit(0)
  } catch (err) {
    console.error("Runner failed:", err.message)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
