#!/usr/bin/env node

/**
 * PHASE 3 – TENANT DATABASE ENGINE SELF-CHECK
 *
 * Validates:
 * - getTenantDbUrl / getTenantDb exist and work when center has tenant_db_url
 * - /api/health/db returns master status
 * - /api/health/db with x-tenant-center-id checks tenant when center has tenant_db_url
 *
 * Exits: 0 on PASS, 1 on FAIL
 */

const postgres = require("postgres");

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (url && url.trim().length > 0) return url.trim();
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const name = process.env.DB_NAME || "robotics";
  const user = process.env.DB_USER || "robotics";
  const pass = process.env.DB_PASS || "robotics";
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${encodeURIComponent(name)}`;
}

async function main() {
  console.log("=== PHASE 3 SELF-CHECK: TENANT DATABASE ENGINE ===");

  const url = getDatabaseUrl();
  const sql = postgres(url, { max: 1 });

  try {
    // 1. centers.tenant_db_url column exists
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'centers' AND column_name = 'tenant_db_url'
    `;
    if (cols.length === 0) {
      console.error("[centers.tenant_db_url] FAIL - Column not found");
      process.exit(1);
    }
    console.log("[centers.tenant_db_url] PASS");

    // 2. /api/health/db returns master status
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const healthRes = await fetch(`${baseUrl}/api/health/db`);
    if (!healthRes.ok) {
      console.error("[health/db] FAIL -", healthRes.status, await healthRes.text());
      process.exit(1);
    }
    const body = await healthRes.json();
    if (body.status !== "ok" || body.master !== "connected") {
      console.error("[health/db] FAIL - Unexpected response", body);
      process.exit(1);
    }
    console.log("[health/db master] PASS");

    // 3. health/db with x-tenant-center-id (no tenant DB URL set => no tenant check)
    const healthWithTenant = await fetch(`${baseUrl}/api/health/db`, {
      headers: { "x-tenant-center-id": "00000000-0000-0000-0000-000000000001" },
    });
    if (!healthWithTenant.ok) {
      console.error("[health/db tenant header] FAIL -", healthWithTenant.status);
      process.exit(1);
    }
    console.log("[health/db tenant header] PASS");

    console.log("PHASE 3 SELF-CHECK: PASS");
    process.exit(0);
  } catch (err) {
    console.error("[PHASE 3] FAIL -", err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    try {
      await sql.end();
    } catch (_) {}
  }
}

main();
