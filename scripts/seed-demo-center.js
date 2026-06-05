#!/usr/bin/env node
/**
 * scripts/seed-demo-center.js
 *
 * Creates a default "demo" center in the master DB if it doesn't exist.
 * Also ensures a default plan exists.
 *
 * USAGE:
 *   node scripts/seed-demo-center.js
 *   node scripts/seed-demo-center.js --slug dem --name "Demo Center"
 *
 * WHAT IT DOES:
 *   1. Ensures a default plan ("starter") exists in the plans table
 *   2. Creates a center with slug=dem, name="Demo Center" if not exists
 *   3. Creates a subscription linking the center to the plan
 *   4. Prints the centerId to use in DEFAULT_DEV_CENTER
 */

const { Client } = require("pg")
const crypto     = require("path")
const fs         = require("fs")
const path       = require("path")

// ── Load .env.local ───────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local")
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, "utf8").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

// ── CLI args ──────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2)
function getArg(flag) {
  const i = args.indexOf(flag)
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null
}

const SLUG        = getArg("--slug") ?? process.env.DEFAULT_DEV_CENTER ?? "dem"
const CENTER_NAME = getArg("--name") ?? "Demo Center"
const MASTER_URL  = process.env.MASTER_DATABASE_URL ?? process.env.DATABASE_URL

// ── Colours ───────────────────────────────────────────────────────────────────
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", B = "\x1b[36m", Z = "\x1b[0m"
function log(msg)  { console.log(`  ${G}✔${Z}  ${msg}`) }
function info(msg) { console.log(`  ${B}→${Z}  ${msg}`) }
function warn(msg) { console.log(`  ${Y}⚠${Z}  ${msg}`) }
function err(msg)  { console.log(`  ${R}❌${Z} ${msg}`); process.exitCode = 1 }

// ── UUID ──────────────────────────────────────────────────────────────────────
const { randomUUID } = require("crypto")

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${B}=== Seed Demo Center ===${Z}`)
  console.log(`  Slug: ${SLUG}`)
  console.log(`  Name: ${CENTER_NAME}`)
  console.log()

  if (!MASTER_URL) {
    err("MASTER_DATABASE_URL or DATABASE_URL is not set. Check .env.local")
    process.exit(1)
  }

  const client = new Client({ connectionString: MASTER_URL, connectionTimeoutMillis: 5000 })
  try {
    await client.connect()
    log("Connected to master DB")
  } catch (e) {
    err(`Cannot connect to DB: ${e.message}`)
    info("Start Docker: docker start robotics-db")
    process.exit(1)
  }

  try {
    // ── 1. Ensure default plan exists ────────────────────────────────────────
    const PLAN_SLUG = "starter"
    const existingPlan = await client.query(
      "SELECT id FROM plans WHERE id = $1 OR name = $2 LIMIT 1",
      [PLAN_SLUG, "Starter"]
    )
    let planId
    if (existingPlan.rows.length > 0) {
      planId = existingPlan.rows[0].id
      info(`Using existing plan: id=${planId}`)
    } else {
      planId = PLAN_SLUG
      await client.query(`
        INSERT INTO plans (id, name, price, duration_months, max_students, max_teachers, created_at, updated_at)
        VALUES ($1, $2, 0, 12, 100, 20, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [planId, "Starter"])
      log(`Created plan: id=${planId} name=Starter`)
    }

    // ── 2. Ensure center exists ───────────────────────────────────────────────
    const existingCenter = await client.query(
      "SELECT id, subdomain, name FROM centers WHERE subdomain = $1 LIMIT 1",
      [SLUG]
    )
    let centerId
    if (existingCenter.rows.length > 0) {
      const c = existingCenter.rows[0]
      centerId = c.id
      warn(`Center already exists: id=${c.id} slug=${c.subdomain} name="${c.name}"`)
    } else {
      centerId = randomUUID()
      const tenantDbName = SLUG.replace(/[^a-z0-9_]/gi, "_")
      const tenantDbUrl  = MASTER_URL.replace(/\/[^/]*$/, `/${tenantDbName}`)
      await client.query(`
        INSERT INTO centers (id, name, subdomain, status, tenant_db_url, created_at, updated_at)
        VALUES ($1, $2, $3, 'active', $4, NOW(), NOW())
      `, [centerId, CENTER_NAME, SLUG, tenantDbUrl])
      log(`Created center: id=${centerId} slug=${SLUG} name="${CENTER_NAME}"`)
      info(`Tenant DB URL: ${tenantDbUrl}`)
    }

    // ── 3. Ensure subscription exists ────────────────────────────────────────
    const existingSub = await client.query(
      "SELECT id FROM subscriptions WHERE center_id = $1 LIMIT 1",
      [centerId]
    )
    if (existingSub.rows.length > 0) {
      warn(`Subscription already exists for center ${centerId}`)
    } else {
      const subId    = randomUUID()
      const start    = new Date().toISOString()
      const end      = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      await client.query(`
        INSERT INTO subscriptions (id, center_id, plan_id, start_date, end_date, is_trial, created_at)
        VALUES ($1, $2, $3, $4, $5, false, NOW())
      `, [subId, centerId, planId, start, end])
      log(`Created subscription: id=${subId} plan=${planId} valid until ${end.slice(0, 10)}`)
    }

    // ── Result ────────────────────────────────────────────────────────────────
    console.log()
    console.log(`${G}Done!${Z}`)
    console.log()
    console.log(`${B}Update .env.local:${Z}`)
    console.log(`  DEFAULT_DEV_CENTER=${centerId}`)
    console.log()
    console.log(`${B}Or use slug directly:${Z}`)
    console.log(`  DEFAULT_DEV_CENTER=${SLUG}`)
    console.log()
    console.log(`${B}Test login:${Z}`)
    console.log(`  http://localhost:3000/login?center=${SLUG}`)
    console.log()

  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(`\n${R}Fatal:${Z}`, e.message)
  process.exit(1)
})
