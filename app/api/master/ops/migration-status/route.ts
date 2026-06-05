/**
 * GET /api/master/ops/migration-status
 *
 * Returns migration status for all active centers:
 *   - appVersion: current APP_SCHEMA_VERSION
 *   - centers: [{ centerId, name, subdomain, migratedVersion, needsMigration }]
 *   - needsMigrationCount: number of centers behind
 *
 * Auto-creates the center_schema_versions tracking table if it doesn't exist.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import { APP_SCHEMA_VERSION, SCHEMA_CHANGELOG } from "@/lib/schema-version"

export const dynamic = "force-dynamic"

async function ensureVersionTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS center_schema_versions (
      center_id      TEXT NOT NULL PRIMARY KEY,
      schema_version INTEGER NOT NULL DEFAULT 0,
      migrated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
}

export async function GET(req: NextRequest) {
  const [, errRes] = await requireMaster(req)
  if (errRes) return errRes

  await ensureVersionTable()

  const centers = await sql`
    SELECT c.id, c.name, c.subdomain,
           COALESCE(v.schema_version, 0) AS migrated_version
    FROM centers c
    LEFT JOIN center_schema_versions v ON v.center_id = c.id
    WHERE c.status IN ('active', 'trial')
    ORDER BY c.name
  ` as { id: string; name: string; subdomain: string; migrated_version: number }[]

  const result = centers.map((c) => ({
    centerId: c.id,
    name: c.name,
    subdomain: c.subdomain,
    migratedVersion: c.migrated_version,
    appVersion: APP_SCHEMA_VERSION,
    needsMigration: c.migrated_version < APP_SCHEMA_VERSION,
  }))

  const needsMigrationCount = result.filter((c) => c.needsMigration).length

  if (needsMigrationCount > 0) {
    console.warn(
      `[MIGRATION REQUIRED] APP_SCHEMA_VERSION=${APP_SCHEMA_VERSION}. ` +
      `${needsMigrationCount} center(s) need migration. ` +
      `Changelog: v${APP_SCHEMA_VERSION} — ${SCHEMA_CHANGELOG[APP_SCHEMA_VERSION] ?? "see lib/schema-version.ts"}`
    )
  }

  return NextResponse.json({
    appVersion: APP_SCHEMA_VERSION,
    changelog: SCHEMA_CHANGELOG,
    needsMigrationCount,
    centers: result,
  })
}
