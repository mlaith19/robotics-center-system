/**
 * POST /api/master/ops/migrate — start per-center migration run.
 * GET  /api/master/ops/migrate?runId=... — poll run status + items.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import { runMigrationsPerCenter, type RunResult } from "@/lib/master/migrations/run-per-center"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type MigrateMode = "all" | "one" | "failed_only" | "selected"

async function ensureMigrationTables() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS master_migration_runs (
      id           UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
      created_by   TEXT,
      mode         TEXT          NOT NULL,
      migration_tag TEXT,
      dry_run      BOOLEAN       NOT NULL DEFAULT false,
      summary_json JSONB,
      status       TEXT          NOT NULL DEFAULT 'running',
      completed_at TIMESTAMPTZ
    )
  `)
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS master_migration_run_items (
      id            UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id        UUID         NOT NULL,
      center_id     TEXT         NOT NULL,
      center_name   TEXT,
      status        TEXT         NOT NULL,
      duration_ms   INTEGER      NOT NULL DEFAULT 0,
      error_message TEXT,
      error_stack   TEXT,
      applied_json  JSONB,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
  `)
  try {
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS master_migration_run_items_run_id_idx ON master_migration_run_items(run_id)`)
  } catch (_) {}
}

interface MigrateBody {
  mode: MigrateMode
  centerId?: string
  centerIds?: string[]
  dryRun?: boolean
  migrationTag?: string
}

async function getCentersForMode(
  mode: MigrateMode,
  centerId?: string,
  centerIds?: string[]
): Promise<{ id: string; name: string; tenant_db_url: string }[]> {
  if (mode === "one" && centerId) {
    const rows = await sql`
      SELECT id, name, tenant_db_url FROM centers
      WHERE id = ${centerId} AND status IN ('active', 'trial')
    ` as { id: string; name: string; tenant_db_url: string }[]
    return rows
  }
  if (mode === "selected" && centerIds?.length) {
    const rows = await sql`
      SELECT id, name, tenant_db_url FROM centers
      WHERE id = ANY(${centerIds}) AND status IN ('active', 'trial') AND tenant_db_url IS NOT NULL
    ` as { id: string; name: string; tenant_db_url: string }[]
    return rows
  }
  if (mode === "failed_only") {
    const lastRun = await sql`
      SELECT id FROM master_migration_runs
      WHERE status IN ('completed', 'partial')
      ORDER BY created_at DESC LIMIT 1
    ` as { id: string }[]
    if (lastRun.length === 0) return []
    const failedCenterIds = await sql`
      SELECT DISTINCT center_id FROM master_migration_run_items
      WHERE run_id = ${lastRun[0].id} AND status = 'failed'
    ` as { center_id: string }[]
    const ids = failedCenterIds.map((r) => r.center_id)
    if (ids.length === 0) return []
    const rows = await sql`
      SELECT id, name, tenant_db_url FROM centers
      WHERE id = ANY(${ids}) AND tenant_db_url IS NOT NULL
    ` as { id: string; name: string; tenant_db_url: string }[]
    return rows
  }
  // all
  const rows = await sql`
    SELECT id, name, tenant_db_url FROM centers
    WHERE status IN ('active', 'trial') AND tenant_db_url IS NOT NULL
    ORDER BY name
  ` as { id: string; name: string; tenant_db_url: string }[]
  return rows
}

export async function POST(req: NextRequest) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  await ensureMigrationTables()

  let body: MigrateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { mode = "all", centerId, centerIds, dryRun = false, migrationTag } = body
  if (!["all", "one", "failed_only", "selected"].includes(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  }
  if (mode === "one" && !centerId) {
    return NextResponse.json({ error: "mode 'one' requires centerId" }, { status: 400 })
  }
  if (mode === "selected" && (!centerIds || !Array.isArray(centerIds) || centerIds.length === 0)) {
    return NextResponse.json({ error: "mode 'selected' requires non-empty centerIds" }, { status: 400 })
  }

  const centers = await getCentersForMode(mode, centerId, centerIds)
  const runId = crypto.randomUUID()

  const summary = {
    runId,
    startedAt: new Date().toISOString(),
    totalCenters: centers.length,
    dryRun,
    migrationTag: migrationTag ?? null,
  }

  await sql`
    INSERT INTO master_migration_runs (id, created_by, mode, migration_tag, dry_run, summary_json, status)
    VALUES (
      ${runId},
      ${session.id},
      ${mode},
      ${migrationTag ?? null},
      ${dryRun},
      ${JSON.stringify(summary)}::jsonb,
      'running'
    )
  `

  const centersInput = centers.map((c) => ({
    centerId: c.id,
    centerName: c.name ?? c.id,
    tenantDbUrl: c.tenant_db_url ?? "",
  }))

  const run = async () => {
    const results = await runMigrationsPerCenter({
      centers: centersInput,
      migrationTag: migrationTag ?? undefined,
      dryRun,
      onProgress() {},
    })
    for (const r of results) {
      await sql`
        INSERT INTO master_migration_run_items (run_id, center_id, center_name, status, duration_ms, error_message, error_stack, applied_json)
        VALUES (
          ${runId},
          ${r.centerId},
          ${r.centerName ?? null},
          ${r.status},
          ${r.durationMs},
          ${r.errorMessage ?? null},
          ${r.errorStack ?? null},
          ${r.appliedMigrations ? JSON.stringify(r.appliedMigrations) : null}::jsonb
        )
      `
    }
    const failedCount = results.filter((x) => x.status === "failed").length
    const successCount = results.filter((x) => x.status === "success").length
    const finalSummary = {
      ...summary,
      successCount,
      failedCount,
      completedAt: new Date().toISOString(),
    }
    const runStatus = failedCount === 0 ? "completed" : "partial"
    await sql`
      UPDATE master_migration_runs
      SET status = ${runStatus}, completed_at = now(), summary_json = ${JSON.stringify(finalSummary)}::jsonb
      WHERE id = ${runId}
    `
  }

  setImmediate(() => {
    run().catch(async (err) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("[ops/migrate] background run error:", err)
      }
      try {
        const errPayload = JSON.stringify({ error: String(err) })
        await sql`
          UPDATE master_migration_runs
          SET status = 'partial', completed_at = now(),
              summary_json = COALESCE(summary_json, '{}'::jsonb) || ${errPayload}::jsonb
          WHERE id = ${runId}::uuid
        `
      } catch (_) {}
    })
  })

  const response: {
    runId: string
    startedAt: string
    totalCenters: number
    results?: RunResult[]
  } = {
    runId,
    startedAt: summary.startedAt,
    totalCenters: centers.length,
  }

  return NextResponse.json(response)
}

export async function GET(req: NextRequest) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  await ensureMigrationTables()

  const runId = req.nextUrl.searchParams.get("runId")
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 })
  }

  const runs = await sql`
    SELECT id, created_at, created_by, mode, migration_tag, dry_run, summary_json, status, completed_at
    FROM master_migration_runs WHERE id = ${runId}::uuid LIMIT 1
  ` as {
    id: string
    created_at: string
    created_by: string
    mode: string
    migration_tag: string | null
    dry_run: boolean
    summary_json: Record<string, unknown> | null
    status: string
    completed_at: string | null
  }[]

  if (runs.length === 0) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  const run = runs[0]
  const items = await sql`
    SELECT center_id, center_name, status, duration_ms, error_message, error_stack, applied_json, created_at
    FROM master_migration_run_items WHERE run_id = ${runId}::uuid ORDER BY created_at
  ` as {
    center_id: string
    center_name: string | null
    status: string
    duration_ms: number
    error_message: string | null
    error_stack: string | null
    applied_json: string[] | null
    created_at: string
  }[]

  const results = items.map((i) => ({
    centerId: i.center_id,
    centerName: i.center_name ?? undefined,
    status: i.status,
    durationMs: i.duration_ms,
    errorMessage: i.error_message ?? undefined,
    errorStack: i.error_stack ?? undefined,
    appliedMigrations: i.applied_json ?? undefined,
  }))

  return NextResponse.json({
    runId: run.id,
    startedAt: run.created_at,
    status: run.status,
    mode: run.mode,
    migrationTag: run.migration_tag ?? undefined,
    dryRun: run.dry_run,
    summary: run.summary_json ?? {},
    completedAt: run.completed_at ?? undefined,
    totalCenters: results.length,
    results,
  })
}
