/**
 * Per-center tenant migration runner.
 * Runs tenant SQL migrations (prisma/tenant-migrations/*.sql) for each center in sequence.
 * One center failure does not stop others; results are collected.
 */

import * as fs from "fs"
import * as path from "path"
import postgres from "postgres"
import { normalizeTenantDbUrl } from "@/lib/db/normalizeTenantDbUrl"

const TENANT_MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "tenant-migrations")
const PER_CENTER_TIMEOUT_MS = 120_000

export interface CenterInput {
  centerId: string
  centerName: string
  tenantDbUrl: string
}

export interface RunResult {
  centerId: string
  centerName?: string
  status: "success" | "failed" | "skipped"
  durationMs: number
  errorMessage?: string
  errorStack?: string
  appliedMigrations?: string[]
}

export interface RunPerCenterOptions {
  centers: CenterInput[]
  migrationTag?: string
  dryRun?: boolean
  onProgress?: (centerId: string, status: string) => void
}

function getMigrationFiles(): string[] {
  if (!fs.existsSync(TENANT_MIGRATIONS_DIR)) return []
  return fs.readdirSync(TENANT_MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()
}

export async function runMigrationsPerCenter(options: RunPerCenterOptions): Promise<RunResult[]> {
  const { centers, dryRun = false, onProgress } = options
  const files = getMigrationFiles()
  const results: RunResult[] = []

  for (const center of centers) {
    const start = Date.now()
    onProgress?.(center.centerId, "running")

    if (!center.tenantDbUrl?.trim()) {
      results.push({
        centerId: center.centerId,
        centerName: center.centerName,
        status: "skipped",
        durationMs: 0,
        errorMessage: "No tenant_db_url configured",
      })
      onProgress?.(center.centerId, "skipped")
      continue
    }

    if (dryRun) {
      results.push({
        centerId: center.centerId,
        centerName: center.centerName,
        status: "success",
        durationMs: Date.now() - start,
        appliedMigrations: files,
      })
      onProgress?.(center.centerId, "success")
      continue
    }

    let tenantSql: ReturnType<typeof postgres> | null = null
    try {
      const tenantDbUrl = normalizeTenantDbUrl(center.tenantDbUrl)
      tenantSql = postgres(tenantDbUrl, { max: 1 })
      for (const file of files) {
        const content = fs.readFileSync(path.join(TENANT_MIGRATIONS_DIR, file), "utf8")
        await Promise.race([
          tenantSql.unsafe(content),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error(`timeout:${file}`)), PER_CENTER_TIMEOUT_MS)
          ),
        ])
      }
      await tenantSql.end()
      tenantSql = null
      results.push({
        centerId: center.centerId,
        centerName: center.centerName,
        status: "success",
        durationMs: Date.now() - start,
        appliedMigrations: files,
      })
      onProgress?.(center.centerId, "success")
    } catch (err) {
      if (tenantSql) {
        try { await tenantSql.end() } catch { /* ignore */ }
      }
      const msg = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      results.push({
        centerId: center.centerId,
        centerName: center.centerName,
        status: "failed",
        durationMs: Date.now() - start,
        errorMessage: msg,
        errorStack: stack,
      })
      onProgress?.(center.centerId, "failed")
    }
  }

  return results
}
