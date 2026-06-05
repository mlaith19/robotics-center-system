#!/usr/bin/env node

/**
 * Tenant schema bootstrap.
 * Usage:
 *   node scripts/tenant-bootstrap.js <subdomain>
 *
 * Resolves the tenant DB from the master DB, then creates minimal
 * tenant tables using CREATE TABLE IF NOT EXISTS.
 */

"use strict"

const postgres = require("postgres")

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMasterDbUrl() {
  const url = process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL
  if (url && url.trim().length > 0) return url.trim()
  const host = process.env.DB_HOST || "localhost"
  const port = process.env.DB_PORT || "5432"
  const name = process.env.DB_NAME || "robotics"
  const user = process.env.DB_USER || "robotics"
  const pass = process.env.DB_PASS || "robotics"
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${encodeURIComponent(name)}`
}

/** Mirror of lib/db/normalizeTenantDbUrl.ts */
function normalizeTenantDbUrl(url) {
  if (!url) throw new Error("tenant_db_url missing")
  let normalized = url
    .replace("postgresql://postgres@", "postgresql://robotics:robotics@")
    .replace("postgres://postgres@",   "postgresql://robotics:robotics@")
  if (normalized.startsWith("postgres://") && !normalized.startsWith("postgresql://")) {
    normalized = "postgresql://" + normalized.slice("postgres://".length)
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("TENANT DB:", normalized.replace(/:.*@/, ":***@"))
  }
  return normalized
}

// ─── Schema DDL ───────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  CREATE TABLE IF NOT EXISTS center_settings (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    key        TEXT        NOT NULL UNIQUE,
    value      TEXT,
    created_at TIMESTAMP   NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS schools (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    city       TEXT,
    created_at TIMESTAMP   NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    email      TEXT,
    phone      TEXT,
    created_at TIMESTAMP   NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS students (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    email      TEXT,
    phone      TEXT,
    school_id  UUID        REFERENCES schools(id) ON DELETE SET NULL,
    created_at TIMESTAMP   NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS course_categories (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMP   NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS courses (
    id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT      NOT NULL,
    category_id  UUID      REFERENCES course_categories(id) ON DELETE SET NULL,
    teacher_id   UUID      REFERENCES teachers(id) ON DELETE SET NULL,
    max_students INTEGER,
    created_at   TIMESTAMP NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id  UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP   NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS payments (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
    method     TEXT,
    created_at TIMESTAMP   NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id  UUID        REFERENCES courses(id) ON DELETE SET NULL,
    status     TEXT        NOT NULL DEFAULT 'present',
    created_at TIMESTAMP   NOT NULL DEFAULT now()
  );
`

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const subdomain = process.argv[2]

  if (!subdomain) {
    console.error("Usage: node scripts/tenant-bootstrap.js <subdomain>")
    process.exit(1)
  }

  const masterSql = postgres(getMasterDbUrl(), { max: 1 })
  let tenantSql

  try {
    // Step 1: resolve tenant from master DB
    console.log(`Resolving subdomain "${subdomain}" from master DB …`)
    const rows = await masterSql`
      SELECT id, name, tenant_db_url FROM centers WHERE subdomain = ${subdomain} LIMIT 1
    `
    if (rows.length === 0) {
      console.error(`ERROR: No center found with subdomain "${subdomain}".`)
      process.exit(1)
    }
    const center = rows[0]
    if (!center.tenant_db_url) {
      console.error(`ERROR: Center "${subdomain}" has no tenant_db_url set.`)
      process.exit(1)
    }
    console.log(`Found center: ${center.name} (id=${center.id})`)

    // Step 2: connect to tenant DB
    const tenantUrl = normalizeTenantDbUrl(center.tenant_db_url)
    tenantSql = postgres(tenantUrl, { max: 1 })

    // Step 3: run schema DDL
    console.log("Applying tenant schema …")
    await tenantSql.unsafe(SCHEMA_SQL)

    console.log("\nTenant schema ready.")
    process.exit(0)
  } catch (err) {
    console.error("Bootstrap failed:", err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    try { await masterSql.end() } catch { /* ignore */ }
    try { if (tenantSql) await tenantSql.end() } catch { /* ignore */ }
  }
}

main()
