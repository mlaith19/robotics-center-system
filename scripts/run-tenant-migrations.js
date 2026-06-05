#!/usr/bin/env node

/**
 * Run tenant schema migrations against a database URL.
 * Usage: TENANT_DATABASE_URL=postgres://... node scripts/run-tenant-migrations.js
 * Or: node scripts/run-tenant-migrations.js <database_url>
 */

const postgres = require("postgres")
const fs = require("fs")
const path = require("path")

const url = process.env.TENANT_DATABASE_URL || process.argv[2]
if (!url) {
  console.error("Usage: TENANT_DATABASE_URL=postgres://... node scripts/run-tenant-migrations.js")
  process.exit(1)
}

const migrationsDir = path.join(__dirname, "..", "prisma", "tenant-migrations")
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()

async function main() {
  const sql = postgres(url, { max: 1 })
  try {
    for (const file of files) {
      const filePath = path.join(migrationsDir, file)
      const content = fs.readFileSync(filePath, "utf8")
      console.log(`Running ${file}...`)
      await sql.unsafe(content)
      console.log(`  OK`)
    }
    console.log("Tenant migrations complete.")
  } catch (err) {
    console.error("Migration failed:", err.message)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
