#!/usr/bin/env node
/**
 * scripts/fix-admin-role.js
 *
 * Fixes tenant admin users that have role=NULL or role='user'.
 * Sets their role to 'center_admin' so they can access the dashboard.
 *
 * Root cause: provision-center.js previously did not set role in the User INSERT.
 * Login fell back to role="user" which is not in ALLOWED_ROLES → 403 on all API routes.
 *
 * USAGE:
 *   node scripts/fix-admin-role.js
 *   node scripts/fix-admin-role.js --slug dem
 *   node scripts/fix-admin-role.js --all
 */

const { Client } = require("pg")
const path       = require("path")
const fs         = require("fs")

// ── Load .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local")
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

// ── CLI args ─────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2)
const SLUG     = args.includes("--slug")  ? args[args.indexOf("--slug")  + 1] : process.env.DEFAULT_DEV_CENTER
const FIX_ALL  = args.includes("--all")
const MASTER_URL = process.env.MASTER_DATABASE_URL ?? process.env.DATABASE_URL

// ── Colours ──────────────────────────────────────────────────────────────────
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", B = "\x1b[36m", Z = "\x1b[0m"
function log(m)  { console.log(`  ${G}✔${Z}  ${m}`) }
function info(m) { console.log(`  ${B}→${Z}  ${m}`) }
function warn(m) { console.log(`  ${Y}⚠${Z}  ${m}`) }
function err(m)  { console.log(`  ${R}❌${Z} ${m}`); process.exitCode = 1 }

// ── Fix one tenant DB ─────────────────────────────────────────────────────────
async function fixTenantDb(tenantDbUrl, centerSlug) {
  const client = new Client({ connectionString: tenantDbUrl, connectionTimeoutMillis: 5000 })
  try {
    await client.connect()
  } catch (e) {
    err(`Cannot connect to tenant DB for "${centerSlug}": ${e.message}`)
    return
  }
  try {
    // Find users with missing or "user" role
    const bad = await client.query(`
      SELECT id, username, role, "roleId"
      FROM "User"
      WHERE status = 'active'
        AND (role IS NULL OR role = '' OR role = 'user')
    `)

    if (bad.rows.length === 0) {
      log(`[${centerSlug}] No users with broken role — already OK`)
      return
    }

    info(`[${centerSlug}] Found ${bad.rows.length} user(s) with missing/bad role:`)
    for (const u of bad.rows) {
      info(`  username="${u.username}" role="${u.role ?? 'NULL'}"`)
    }

    // Update them all to center_admin
    const res = await client.query(`
      UPDATE "User"
      SET role = 'center_admin', "updatedAt" = now()
      WHERE status = 'active'
        AND (role IS NULL OR role = '' OR role = 'user')
      RETURNING username, role
    `)

    for (const u of res.rows) {
      log(`[${centerSlug}] Fixed: username="${u.username}" → role="${u.role}"`)
    }

    console.log()
    console.log(`  ${Y}⚡ Log out and log back in for the new role to take effect.${Z}`)
  } finally {
    await client.end()
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${B}=== Fix Admin Role ===${Z}\n`)

  if (!MASTER_URL) {
    err("MASTER_DATABASE_URL not set. Check .env.local")
    process.exit(1)
  }

  const master = new Client({ connectionString: MASTER_URL, connectionTimeoutMillis: 5000 })
  try {
    await master.connect()
    log("Connected to master DB")
  } catch (e) {
    err(`Cannot connect to master DB: ${e.message}`)
    info("Start Docker: docker start robotics-db")
    process.exit(1)
  }

  try {
    let centers
    if (FIX_ALL) {
      const r = await master.query("SELECT id, subdomain, tenant_db_url FROM centers WHERE status='active' AND tenant_db_url IS NOT NULL")
      centers = r.rows
      info(`Fixing all ${centers.length} active centers`)
    } else if (SLUG) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const r = uuidRe.test(SLUG)
        ? await master.query("SELECT id, subdomain, tenant_db_url FROM centers WHERE id=$1 LIMIT 1", [SLUG])
        : await master.query("SELECT id, subdomain, tenant_db_url FROM centers WHERE subdomain=$1 LIMIT 1", [SLUG])
      centers = r.rows
      if (!centers.length) {
        err(`Center "${SLUG}" not found`)
        process.exit(1)
      }
      info(`Fixing center: slug="${centers[0].subdomain}"`)
    } else {
      console.log(`${Y}Usage:${Z}
  node scripts/fix-admin-role.js --slug dem       # fix specific center
  node scripts/fix-admin-role.js --all            # fix all centers

  Or set DEFAULT_DEV_CENTER in .env.local to auto-detect.`)
      process.exit(0)
    }

    console.log()
    for (const center of centers) {
      // Normalise URL (replace localhost with 127.0.0.1 if needed)
      const rawUrl = center.tenant_db_url.replace("localhost", "127.0.0.1")
      await fixTenantDb(rawUrl, center.subdomain)
    }
  } finally {
    await master.end()
  }

  console.log()
  if (!process.exitCode) {
    console.log(`${G}Done! Next steps:${Z}`)
    console.log(`  1. Log out of the tenant dashboard`)
    console.log(`  2. Log in again at: http://localhost:3000/login?center=${SLUG || "dem"}`)
    console.log(`  3. You should now have full access`)
  }
  console.log()
}

main().catch(e => {
  console.error(`\n${R}Fatal:${Z}`, e.message)
  process.exit(1)
})
