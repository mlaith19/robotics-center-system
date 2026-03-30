#!/usr/bin/env node
/**
 * DEV ONLY: Set a new password for the OWNER in master_users.
 *
 * Usage: node scripts/set-owner-password.js --i-know-this-is-dev <new-password>
 *
 * Safety flags:
 *   --i-know-this-is-dev  required confirmation flag
 *   <new-password>        the new plaintext password (will be bcrypt-hashed)
 */

require("dotenv").config()

const args = process.argv.slice(2)

if (!args.includes("--i-know-this-is-dev")) {
  console.error("ERROR: You must pass --i-know-this-is-dev to confirm this is a dev operation.")
  console.error("Usage: node scripts/set-owner-password.js --i-know-this-is-dev <new-password>")
  process.exit(1)
}

if (process.env.NODE_ENV === "production") {
  console.error("ERROR: This script cannot run in production.")
  process.exit(1)
}

const passwordArg = args.find((a) => !a.startsWith("--"))
if (!passwordArg) {
  console.error("ERROR: Provide the new password as an argument.")
  console.error("Usage: node scripts/set-owner-password.js --i-know-this-is-dev <new-password>")
  process.exit(1)
}
if (passwordArg.length < 8) {
  console.error("ERROR: Password must be at least 8 characters.")
  process.exit(1)
}

const postgres = require("postgres")
const bcrypt = require("bcryptjs")

async function main() {
  const url =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || "robotics"}:${process.env.DB_PASS || "robotics"}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "5432"}/${process.env.DB_NAME || "robotics"}`

  const sql = postgres(url, { max: 1 })
  try {
    const rows = await sql`SELECT id, username FROM master_users WHERE role = 'OWNER' LIMIT 1`
    if (!rows.length) {
      console.error("ERROR: No OWNER found in master_users. Run migrations first.")
      process.exit(1)
    }
    const owner = rows[0]
    const hash = await bcrypt.hash(passwordArg, 12)
    await sql`
      UPDATE master_users
      SET password_hash = ${hash}, force_password_reset = false, updated_at = now()
      WHERE id = ${owner.id}
    `
    console.log(`\nPassword updated for OWNER: ${owner.username}`)
    console.log("force_password_reset set to false.\n")
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
