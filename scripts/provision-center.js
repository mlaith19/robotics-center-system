#!/usr/bin/env node

/**
 * Phase 5: Center provisioning.
 * Creates center record, domain, runs tenant migrations, creates center admin user.
 * Usage: node scripts/provision-center.js <name> <subdomain> <tenantDbUrl> <adminEmail> <tempPassword>
 * Or with env: CENTER_NAME, SUBDOMAIN, TENANT_DATABASE_URL, ADMIN_EMAIL, TEMP_PASSWORD
 */

const postgres = require("postgres")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const bcrypt = require("bcryptjs")

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

function generateId() {
  return crypto.randomUUID()
}

async function runTenantMigrations(tenantSql) {
  const migrationsDir = path.join(__dirname, "..", "prisma", "tenant-migrations")
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()
  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), "utf8")
    await tenantSql.unsafe(content)
  }
}

async function main() {
  const name = process.env.CENTER_NAME || process.argv[2]
  const subdomain = process.env.SUBDOMAIN || process.argv[3]
  const tenantDbUrl = process.env.TENANT_DATABASE_URL || process.argv[4]
  const adminEmail = process.env.ADMIN_EMAIL || process.argv[5]
  const tempPassword = process.env.TEMP_PASSWORD || process.argv[6]

  if (!name || !subdomain || !tenantDbUrl || !adminEmail || !tempPassword) {
    console.error("Usage: CENTER_NAME=... SUBDOMAIN=... TENANT_DATABASE_URL=... ADMIN_EMAIL=... TEMP_PASSWORD=... node scripts/provision-center.js")
    console.error("Or: node scripts/provision-center.js <name> <subdomain> <tenantDbUrl> <adminEmail> <tempPassword>")
    process.exit(1)
  }

  const baseDomain = process.env.BASE_DOMAIN || "localhost"
  const host = subdomain === "www" || subdomain === "main" ? baseDomain : `${subdomain}.${baseDomain}`

  const masterSql = postgres(getMasterUrl(), { max: 1 })
  const tenantSql = postgres(tenantDbUrl, { max: 1 })

  const centerId = generateId()
  const domainId = generateId()
  const adminUserId = generateId()

  try {
    await masterSql.begin(async (tx) => {
      await tx`
        INSERT INTO centers (id, name, subdomain, status, tenant_db_url, created_at, updated_at)
        VALUES (${centerId}, ${name}, ${subdomain}, 'active', ${tenantDbUrl}, now(), now())
      `
      await tx`
        INSERT INTO domains (id, center_id, host, created_at)
        VALUES (${domainId}, ${centerId}, ${host}, now())
      `
      const planRows = await tx`SELECT id FROM plans LIMIT 1`
      const planId = planRows[0] ? planRows[0].id : null
      if (planId) {
        const subId = generateId()
        const startDate = new Date().toISOString().slice(0, 10)
        const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        const endDate = trialEnd.toISOString().slice(0, 10)
        await tx`
          INSERT INTO subscriptions (id, center_id, plan_id, start_date, end_date, is_trial, trial_start_date, trial_end_date, created_at)
          VALUES (${subId}, ${centerId}, ${planId}, ${startDate}, ${endDate}, true, ${startDate}, ${endDate}, now())
        `
      }
      await tx`
        INSERT INTO audit_logs (id, action, details, created_at)
        VALUES (${generateId()}, 'center_provisioned', ${JSON.stringify({ centerId, name, subdomain, host })}, now())
      `
    })

    console.log("Running tenant migrations...")
    await runTenantMigrations(tenantSql)

    const passwordHash = await bcrypt.hash(tempPassword, 10)
    const username = adminEmail.split("@")[0] + "_" + centerId.slice(0, 8)
    await tenantSql`
      INSERT INTO "User" (id, username, name, email, password, role, status, "force_password_reset", "createdAt", "updatedAt")
      VALUES (${adminUserId}, ${username}, ${name + " Admin"}, ${adminEmail}, ${passwordHash}, 'center_admin', 'active', true, now(), now())
    `

    console.log("Center provisioned:", { centerId, name, subdomain, host, adminEmail, username })
  } catch (err) {
    console.error("Provisioning failed:", err.message)
    process.exit(1)
  } finally {
    await masterSql.end()
    await tenantSql.end()
  }
}

main()
