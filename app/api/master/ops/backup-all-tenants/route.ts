import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"
import { execFile } from "child_process"
import { promisify } from "util"
import * as path from "path"
import * as fs from "fs"

const execFileAsync = promisify(execFile)

export async function POST(req: NextRequest) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  const centers = await sql`
    SELECT id, name, tenant_db_url FROM centers WHERE status = 'active' AND tenant_db_url IS NOT NULL
  ` as { id: string; name: string; tenant_db_url: string }[]

  const runId = crypto.randomUUID()
  await sql`
    INSERT INTO ops_runs (id, type, status, started_at, details, created_at)
    VALUES (${runId}, 'backup_all', 'running', now(),
            ${JSON.stringify({ total: centers.length })}::jsonb, now())
  `

  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), "backups")
  fs.mkdirSync(backupDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")

  const results: { centerId: string; name: string; ok: boolean; outFile?: string; error?: string }[] = []

  for (const center of centers) {
    const outFile = path.join(backupDir, `center-${center.id.slice(0, 8)}-${timestamp}.dump`)
    try {
      await execFileAsync("pg_dump", ["--format=custom", `--file=${outFile}`, center.tenant_db_url])
      results.push({ centerId: center.id, name: center.name, ok: true, outFile })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ centerId: center.id, name: center.name, ok: false, error: msg })
    }
  }

  const failed = results.filter((r) => !r.ok).length
  const status = failed === 0 ? "success" : "failed"

  await sql`
    UPDATE ops_runs SET status = ${status}, finished_at = now(),
      details = ${JSON.stringify({ total: centers.length, failed, results })}::jsonb
    WHERE id = ${runId}
  `
  await sql`
    INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
    VALUES (${crypto.randomUUID()}, ${session.id}, 'ops_backup_all',
            ${JSON.stringify({ runId, total: centers.length, failed })}::jsonb, now())
  `

  return NextResponse.json({ runId, status, total: centers.length, failed, results })
}
