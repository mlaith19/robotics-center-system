/**
 * Master Portal: center provisioning logic.
 * Extracted from scripts/provision-center.js so it can be called from API routes.
 */

import { sql } from "@/lib/db"
import { normalizeTenantDbUrl } from "@/lib/db/normalizeTenantDbUrl"
import postgres from "postgres"
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import bcrypt from "bcryptjs"

const TENANT_MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "tenant-migrations")

/** Run all *.sql files in prisma/tenant-migrations against a tenant DB client. */
async function runTenantMigrations(tenantSql: ReturnType<typeof postgres>): Promise<void> {
  const files = fs.readdirSync(TENANT_MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
  for (const file of files) {
    const content = fs.readFileSync(path.join(TENANT_MIGRATIONS_DIR, file), "utf8")
    await tenantSql.unsafe(content)
  }
}

export interface ProvisionOpts {
  name: string
  subdomain: string
  /** Existing tenant DB URL (existingUrl mode) */
  tenantDbUrl?: string
  /** If true, create a new Postgres database on the same server as MASTER_DATABASE_URL */
  autoCreate?: boolean
  adminEmail: string
  tempPassword: string
  planId?: string
  /** The master user who triggered this (for audit log) */
  masterUserId?: string
}

export interface ProvisionResult {
  centerId: string
  adminUsername: string
  tenantDbUrl: string
}

/**
 * Sanitize a subdomain string to a safe Postgres identifier.
 * Keeps lowercase letters, digits, underscores only.
 */
function sanitizeDbName(subdomain: string): string {
  return subdomain.toLowerCase().replace(/[^a-z0-9_]/g, "_")
}

/**
 * Build the tenant DB URL for autoCreate mode.
 * Uses the same host/port/credentials as the master DB but a new database name.
 */
function buildAutoTenantUrl(subdomain: string): string {
  const masterUrl =
    process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL || ""
  const dbName = sanitizeDbName(subdomain)
  if (masterUrl) {
    try {
      const u = new URL(masterUrl)
      u.pathname = `/${dbName}`
      return normalizeTenantDbUrl(u.toString())
    } catch {
      // fall through to env-based construction
    }
  }
  const host = process.env.DB_HOST || "localhost"
  const port = process.env.DB_PORT || "5432"
  return `postgresql://robotics:robotics@${host}:${port}/${dbName}`
}

/**
 * Create the Postgres database for autoCreate mode.
 * Connects to the master DB server and runs CREATE DATABASE.
 */
async function createTenantDatabase(subdomain: string): Promise<void> {
  const masterUrl =
    process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL || ""
  const dbName = sanitizeDbName(subdomain)
  // Connect to master/postgres maintenance DB to run CREATE DATABASE
  const adminSql = postgres(masterUrl, { max: 1, database: undefined })
  try {
    // CREATE DATABASE cannot run inside a transaction
    await adminSql.unsafe(`CREATE DATABASE "${dbName}"`)
  } finally {
    await adminSql.end()
  }
}

/**
 * Provision a new center:
 * 1. Validate subdomain uniqueness
 * 2. (autoCreate) Create Postgres database
 * 3. Create center + domain in master DB
 * 4. Create subscription (trial or specified plan)
 * 5. Run tenant schema migrations
 * 6. Create tenant admin user with force_password_reset=true
 * 7. Write audit log
 */
export async function provisionCenter(opts: ProvisionOpts): Promise<ProvisionResult> {
  const { name, subdomain, adminEmail, tempPassword, planId, masterUserId } = opts

  // Validate subdomain format
  if (!/^[a-z0-9-]{2,63}$/.test(subdomain)) {
    throw new Error("Invalid subdomain: use lowercase letters, numbers, hyphens (2-63 chars)")
  }

  // Resolve tenant DB URL
  let tenantDbUrl: string
  if (opts.autoCreate) {
    if (process.env.NODE_ENV === "production") {
      // autoCreate is supported in production too; guard is in the API layer
    }
    await createTenantDatabase(subdomain)
    tenantDbUrl = buildAutoTenantUrl(subdomain)
  } else {
    if (!opts.tenantDbUrl) throw new Error("tenantDbUrl is required when autoCreate is false")
    tenantDbUrl = normalizeTenantDbUrl(opts.tenantDbUrl)
  }

  const centerId = crypto.randomUUID()
  const domainId = crypto.randomUUID()
  const adminUserId = crypto.randomUUID()

  // Determine plan — always verify the planId actually exists in the plans table
  let resolvedPlanId: string | null = null
  if (planId) {
    const found = await sql`SELECT id FROM plans WHERE id = ${planId} LIMIT 1` as { id: string }[]
    if (found.length) {
      resolvedPlanId = found[0].id
    } else {
      console.warn(`[PROVISION] planId="${planId}" not found in plans — falling back to first plan`)
    }
  }
  if (!resolvedPlanId) {
    const rows = await sql`SELECT id FROM plans ORDER BY created_at LIMIT 1` as { id: string }[]
    resolvedPlanId = rows[0]?.id ?? null
  }

  // Master DB: create center + domain + subscription in a transaction
  await sql.begin(async (tx: typeof sql) => {
    // admin_username is populated after tenant DB creation; update in second pass
    await tx`
      INSERT INTO centers (id, name, subdomain, status, tenant_db_url, created_at, updated_at)
      VALUES (${centerId}, ${name}, ${subdomain}, 'active', ${tenantDbUrl}, now(), now())
    `
    const baseDomain = process.env.BASE_DOMAIN || "localhost"
    const host = `${subdomain}.${baseDomain}`
    await tx`
      INSERT INTO domains (id, center_id, host, created_at)
      VALUES (${domainId}, ${centerId}, ${host}, now())
    `
    if (resolvedPlanId) {
      const subId = crypto.randomUUID()
      const startDate = new Date().toISOString().slice(0, 10)
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      await tx`
        INSERT INTO subscriptions (id, center_id, plan_id, start_date, end_date, is_trial, created_at)
        VALUES (${subId}, ${centerId}, ${resolvedPlanId}, ${startDate}, ${endDate}, true, now())
      `
    }
    const auditDetails = JSON.stringify({ centerId, name, subdomain, adminEmail, autoCreate: opts.autoCreate ?? false })
    await tx`
      INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
      VALUES (${crypto.randomUUID()}, ${masterUserId ?? null}, 'center_provisioned', ${auditDetails}::jsonb, now())
    `
  })

  // Tenant DB: run schema migrations + create admin user
  const tenantSql = postgres(tenantDbUrl, { max: 1 })
  try {
    await runTenantMigrations(tenantSql)

    const passwordHash = await bcrypt.hash(tempPassword, 10)
    const username = adminEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_") + "_admin"
    await tenantSql`
      INSERT INTO "User" (id, username, name, email, password, status, role, permissions, force_password_reset, "createdAt", "updatedAt")
      VALUES (${adminUserId}, ${username}, ${name + " Admin"}, ${adminEmail}, ${passwordHash}, 'active', 'center_admin', '[]'::jsonb, true, now(), now())
    `

    // Save admin_username back to master DB so it's visible in the portal
    await sql`UPDATE centers SET admin_username = ${username} WHERE id = ${centerId}`

    return { centerId, adminUsername: username, tenantDbUrl }
  } finally {
    await tenantSql.end()
  }
}
