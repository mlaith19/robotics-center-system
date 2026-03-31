/**
 * POST /api/master/centers/[id]/run-tenant-migrations
 * Uses same run-per-center runner; writes to master_migration_runs/items + ops_runs.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import { runMigrationsPerCenter } from "@/lib/master/migrations/run-per-center"
import { APP_SCHEMA_VERSION } from "@/lib/schema-version"
import { bumpGlobalSessionRevision } from "@/lib/session-revision"
import * as crypto from "crypto"

export const dynamic = "force-dynamic"
export const maxDuration = 120

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes
  const { id } = await params

  const rows = await sql`
    SELECT name, tenant_db_url FROM centers WHERE id = ${id} LIMIT 1
  ` as { name: string; tenant_db_url: string }[]
  if (!rows.length) return NextResponse.json({ error: "Center not found" }, { status: 404 })
  const rawUrl = rows[0].tenant_db_url
  if (!rawUrl) return NextResponse.json({ error: "No tenant DB configured" }, { status: 400 })

  await ensureMigrationTables()

  const runId = crypto.randomUUID()
  await bumpGlobalSessionRevision(session.id, `master center migrate centerId=${id} runId=${runId}`).catch(() => {})
  const summary = { runId, startedAt: new Date().toISOString(), totalCenters: 1, centerId: id }

  await sql`
    INSERT INTO master_migration_runs (id, created_by, mode, dry_run, summary_json, status)
    VALUES (${runId}, ${session.id}, 'one', false, ${JSON.stringify(summary)}::jsonb, 'running')
  `

  const [result] = await runMigrationsPerCenter({
    centers: [{ centerId: id, centerName: rows[0].name, tenantDbUrl: rawUrl }],
  })

  await sql`
    INSERT INTO master_migration_run_items (run_id, center_id, center_name, status, duration_ms, error_message, error_stack, applied_json)
    VALUES (${runId}, ${result.centerId}, ${result.centerName ?? null}, ${result.status}, ${result.durationMs},
            ${result.errorMessage ?? null}, ${result.errorStack ?? null},
            ${result.appliedMigrations ? JSON.stringify(result.appliedMigrations) : null}::jsonb)
  `

  const runStatus = result.status === "success" ? "completed" : "partial"
  await sql`
    UPDATE master_migration_runs
    SET status = ${runStatus}, completed_at = now(),
        summary_json = ${JSON.stringify({ ...summary, successCount: result.status === "success" ? 1 : 0, failedCount: result.status === "failed" ? 1 : 0 })}::jsonb
    WHERE id = ${runId}::uuid
  `

  await sql`
    INSERT INTO ops_runs (id, type, status, started_at, finished_at, details, created_at)
    VALUES (${crypto.randomUUID()}, 'migrate_center', ${result.status === "success" ? "success" : "failed"}, now(), now(),
            ${JSON.stringify({ centerId: id, centerName: rows[0].name, masterRunId: runId, error: result.errorMessage })}::jsonb, now())
  `

  if (result.status === "success") {
    await sql`
      CREATE TABLE IF NOT EXISTS center_schema_versions (
        center_id TEXT NOT NULL PRIMARY KEY,
        schema_version INTEGER NOT NULL DEFAULT 0,
        migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `
    await sql`
      INSERT INTO center_schema_versions (center_id, schema_version, migrated_at)
      VALUES (${id}, ${APP_SCHEMA_VERSION}, now())
      ON CONFLICT (center_id) DO UPDATE SET schema_version = ${APP_SCHEMA_VERSION}, migrated_at = now()
    `
    await sql`
      INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
      VALUES (${crypto.randomUUID()}, ${session.id}, 'center_migrations_run',
              ${JSON.stringify({ centerId: id, runId, schemaVersion: APP_SCHEMA_VERSION })}::jsonb, now())
    `
    return NextResponse.json({ ok: true, runId, files: result.appliedMigrations ?? [], schemaVersion: APP_SCHEMA_VERSION })
  }

  return NextResponse.json({ error: result.errorMessage ?? "Migration failed", runId }, { status: 500 })
}
