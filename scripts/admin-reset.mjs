#!/usr/bin/env node
/**
 * DEV-only: Reset user password to admin123 (bcrypt).
 * Usage:
 *   npm run admin:reset
 *   npm run admin:reset -- <username>
 *   npm run admin:reset -- <username> <centerSubdomain>
 * When <centerSubdomain> is set (e.g. thnik), DATABASE_URL is used as master DB to read
 * centers.tenant_db_url, then the tenant DB is updated. Without it, DATABASE_URL is the DB updated.
 * Requires: .env or .env.local with DATABASE_URL (or DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS).
 */
import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, "..")

function loadEnv(path) {
  const full = join(root, path)
  if (!existsSync(full)) return
  const content = readFileSync(full, "utf8")
  content.split("\n").forEach((line) => {
    const i = line.indexOf("=")
    if (i > 0 && !line.trim().startsWith("#")) {
      const k = line.slice(0, i).trim()
      let v = line.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      process.env[k] = v
    }
  })
}

loadEnv(".env")
loadEnv(".env.local")

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (url && url.trim().length > 0) return url.trim()
  const host = process.env.DB_HOST || "localhost"
  const port = process.env.DB_PORT || "5432"
  const name = process.env.DB_NAME || "robotics"
  const user = process.env.DB_USER || "robotics"
  const pass = process.env.DB_PASS || "robotics"
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${encodeURIComponent(name)}`
}

function normalizeTenantDbUrl(url) {
  if (!url) throw new Error("tenant_db_url missing")
  let normalized = url
    .replace("postgresql://postgres@", "postgresql://robotics:robotics@")
    .replace("postgres://postgres@", "postgresql://robotics:robotics@")
  if (normalized.startsWith("postgres://") && !normalized.startsWith("postgresql://")) {
    normalized = "postgresql://" + normalized.slice("postgres://".length)
  }
  return normalized
}

async function main() {
  const postgres = (await import("postgres")).default
  const bcrypt = await import("bcryptjs")
  const usernameArg = process.argv[2]
  const centerSubdomainArg = process.argv[3]
  const targetUsername = (typeof usernameArg === "string" && usernameArg.trim().length > 0)
    ? usernameArg.trim()
    : "admin"
  const centerSubdomain = (typeof centerSubdomainArg === "string" && centerSubdomainArg.trim().length > 0)
    ? centerSubdomainArg.trim()
    : null

  const masterUrl = getDatabaseUrl()
  let tenantUrl = masterUrl
  if (centerSubdomain) {
    const masterSql = postgres(masterUrl, { max: 1 })
    try {
      const rows = await masterSql`
        SELECT tenant_db_url FROM centers WHERE subdomain = ${centerSubdomain} LIMIT 1
      `
      if (!rows.length || !rows[0].tenant_db_url) {
        console.error(`No center with subdomain '${centerSubdomain}' or missing tenant_db_url.`)
        process.exit(1)
      }
      tenantUrl = normalizeTenantDbUrl(rows[0].tenant_db_url)
      console.log("Tenant DB:", tenantUrl.replace(/:.*@/, ":***@"))
    } finally {
      await masterSql.end()
    }
  }

  const sql = postgres(tenantUrl, { max: 1 })
  try {
    const hash = await bcrypt.hash("admin123", 10)
    const res = await sql`
      UPDATE "User"
      SET password = ${hash}
      WHERE username = ${targetUsername}
      RETURNING id, username
    `
    if (res.length === 0) {
      console.error(`No user with username '${targetUsername}' found in tenant DB.`)
      process.exit(1)
    }
    console.log("Password reset to admin123 for user:", res[0].username)
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
