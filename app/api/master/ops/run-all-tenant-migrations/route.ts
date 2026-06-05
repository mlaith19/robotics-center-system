/**
 * POST /api/master/ops/run-all-tenant-migrations
 * Unified path: uses same run-per-center runner and writes to master_migration_runs/items.
 * Keeps ops_runs + center_schema_versions + audit for backward compatibility.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import { runMigrationsPerCenter } from "@/lib/master/migrations/run-per-center"
import { APP_SCHEMA_VERSION } from "@/lib/schema-version"
import { bumpGlobalSessionRevision } from "@/lib/session-revision"
import * as crypto from "crypto"

export const dynamic = "force-dynamic"
export const maxDuration = 300

async function ensureMigrationTables() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS master_migration_runs (
      id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT, mode TEXT NOT NULL, migration_tag TEXT,
      dry_run BOOLEAN NOT NULL DEFAULT false, summary_json JSONB,
      status TEXT NOT NULL DEFAULT 'running', completed_at TIMESTAMPTZ
    )
  `)
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS master_migration_run_items (
      id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL, center_id TEXT NOT NULL, center_name TEXT,
      status TEXT NOT NULL, duration_ms INTEGER NOT NULL DEFAULT 0,
      error_message TEXT, error_stack TEXT, applied_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

export async function POST(req: NextRequest) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  await ensureMigrationTables()

  const centers = await sql`
    SELECT id, name, tenant_db_url FROM centers
    WHERE status IN ('active', 'trial') AND tenant_db_url IS NOT NULL
  ` as { id: string; name: string; tenant_db_url: string }[]

  const runId = crypto.randomUUID()
  await bumpGlobalSessionRevision(session.id, `master run-all migrations runId=${runId}`).catch(() => {})
  const summary = { runId, startedAt: new Date().toISOString(), totalCenters: centers.length }

  await sql`
    INSERT INTO master_migration_runs (id, created_by, mode, dry_run, summary_json, status)
    VALUES (${runId}, ${session.id}, 'all', false, ${JSON.stringify(summary)}::jsonb, 'running')
  `

  const centersInput = centers.map((c) => ({
    centerId: c.id,
    centerName: c.name ?? c.id,
    tenantDbUrl: c.tenant_db_url ?? "",
  }))

  const results = await runMigrationsPerCenter({ centers: centersInput })

  for (const r of results) {
    await sql`
      INSERT INTO master_migration_run_items (run_id, center_id, center_name, status, duration_ms, error_message, error_stack, applied_json)
      VALUES (${runId}, ${r.centerId}, ${r.centerName ?? null}, ${r.status}, ${r.durationMs},
              ${r.errorMessage ?? null}, ${r.errorStack ?? null},
              ${r.appliedMigrations ? JSON.stringify(r.appliedMigrations) : null}::jsonb)
    `
  }

  const failedCount = results.filter((x) => x.status === "failed").length
  const successCount = results.filter((x) => x.status === "success").length
  const runStatus = failedCount === 0 ? "completed" : "partial"
  await sql`
    UPDATE master_migration_runs
    SET status = ${runStatus}, completed_at = now(),
        summary_json = ${JSON.stringify({ ...summary, successCount, failedCount, completedAt: new Date().toISOString() })}::jsonb
    WHERE id = ${runId}::uuid
  `

  await sql`
    CREATE TABLE IF NOT EXISTS center_schema_versions (
      center_id TEXT NOT NULL PRIMARY KEY,
      schema_version INTEGER NOT NULL DEFAULT 0,
      migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  for (const r of results.filter((r) => r.status === "success")) {
    await sql`
      INSERT INTO center_schema_versions (center_id, schema_version, migrated_at)
      VALUES (${r.centerId}, ${APP_SCHEMA_VERSION}, now())
      ON CONFLICT (center_id) DO UPDATE SET schema_version = ${APP_SCHEMA_VERSION}, migrated_at = now()
    `
  }

  const opsRunId = crypto.randomUUID()
  await sql`
    INSERT INTO ops_runs (id, type, status, started_at, finished_at, details, created_at)
    VALUES (${opsRunId}, 'migrate_all', ${failedCount === 0 ? "success" : "failed"}, now(), now(),
            ${JSON.stringify({ total: centers.length, failed: failedCount, results, masterRunId: runId })}::jsonb, now())
  `

  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'ops_migrate_all',
            ${JSON.stringify({ runId, total: centers.length, failed: failedCount, schemaVersion: APP_SCHEMA_VERSION })}::jsonb, now())
  `.catch(() => {})

  return NextResponse.json({
    runId,
    status: failedCount === 0 ? "success" : "failed",
    total: centers.length,
    failed: failedCount,
    results: results.map((r) => ({ centerId: r.centerId, name: r.centerName, ok: r.status === "success", error: r.errorMessage })),
    schemaVersion: APP_SCHEMA_VERSION,
  })
}
