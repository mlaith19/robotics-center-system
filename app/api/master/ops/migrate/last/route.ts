/**
 * GET /api/master/ops/migrate/last — last run + failures (for failed_only and banner).
 */

import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

type RunRow = {
  id: string
  created_at: string
  created_by: string
  mode: string
  migration_tag: string | null
  dry_run: boolean
  summary_json: Record<string, unknown> | null
  status: string
  completed_at: string | null
}

export async function GET(req: NextRequest) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  let runs: RunRow[]
  try {
    runs = await sql`
      SELECT id, created_at, created_by, mode, migration_tag, dry_run, summary_json, status, completed_at
      FROM master_migration_runs
      ORDER BY created_at DESC LIMIT 1
    ` as RunRow[]
  } catch {
    return NextResponse.json({ run: null, failures: [] })
  }

  if (runs.length === 0) {
    return NextResponse.json({ run: null, failures: [] })
  }

  const run = runs[0]
  const failures = await sql`
    SELECT center_id, center_name, status, duration_ms, error_message, error_stack, created_at
    FROM master_migration_run_items
    WHERE run_id = ${run.id}::uuid AND status = 'failed'
    ORDER BY created_at
  ` as {
    center_id: string
    center_name: string | null
    status: string
    duration_ms: number
    error_message: string | null
    error_stack: string | null
    created_at: string
  }[]

  return NextResponse.json({
    run: {
      runId: run.id,
      startedAt: run.created_at,
      status: run.status,
      mode: run.mode,
      migrationTag: run.migration_tag ?? undefined,
      dryRun: run.dry_run,
      summary: run.summary_json ?? {},
      completedAt: run.completed_at ?? undefined,
    },
    failures: failures.map((f) => ({
      centerId: f.center_id,
      centerName: f.center_name ?? undefined,
      status: f.status,
      durationMs: f.duration_ms,
      errorMessage: f.error_message ?? undefined,
      errorStack: f.error_stack ?? undefined,
    })),
  })
}
