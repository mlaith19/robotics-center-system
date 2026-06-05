#!/usr/bin/env node
/**
 * DEV ONLY: Print OWNER username and email from master_users.
 * Never prints password hash.
 *
 * Usage: node scripts/print-owner-credentials.js
 */

require("dotenv").config()

if (process.env.NODE_ENV === "production") {
  console.error("ERROR: This script cannot run in production.")
  process.exit(1)
}

const postgres = require("postgres")

async function main() {
  const url =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || "robotics"}:${process.env.DB_PASS || "robotics"}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "5432"}/${process.env.DB_NAME || "robotics"}`

  const sql = postgres(url, { max: 1 })
  try {
    const rows = await sql`SELECT id, username, email, role FROM master_users WHERE role = 'OWNER' LIMIT 1`
    if (!rows.length) {
      console.log("No OWNER found in master_users.")
      return
    }
    const owner = rows[0]
    console.log("\n=== OWNER Credentials ===")
    console.log(`  ID       : ${owner.id}`)
    console.log(`  Username : ${owner.username}`)
    console.log(`  Email    : ${owner.email ?? "(none)"}`)
    console.log(`  Role     : ${owner.role}`)
    console.log("=========================\n")
    console.log("NOTE: Password hash is never printed. Use scripts/set-owner-password.js to reset.")
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
