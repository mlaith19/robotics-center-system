import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import { sql } from "@/lib/db"
import * as crypto from "crypto"
import { execFile } from "child_process"
import { promisify } from "util"
import * as path from "path"
import * as fs from "fs"

const execFileAsync = promisify(execFile)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes
  const { id } = await params

  const rows = await sql`SELECT name, tenant_db_url FROM centers WHERE id = ${id} LIMIT 1` as { name: string; tenant_db_url: string }[]
  if (!rows.length) return NextResponse.json({ error: "Center not found" }, { status: 404 })
  const rawUrl = rows[0].tenant_db_url
  if (!rawUrl) return NextResponse.json({ error: "No tenant DB configured" }, { status: 400 })

  const runId = crypto.randomUUID()
  await sql`
    INSERT INTO ops_runs (id, type, status, started_at, details, created_at)
    VALUES (${runId}, 'backup_center', 'running', now(),
            ${JSON.stringify({ centerId: id, centerName: rows[0].name })}::jsonb, now())
  `

  try {
    const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), "backups")
    fs.mkdirSync(backupDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const outFile = path.join(backupDir, `center-${id.slice(0, 8)}-${timestamp}.dump`)

    const { stderr } = await execFileAsync("pg_dump", [
      "--format=custom",
      `--file=${outFile}`,
      rawUrl,
    ])

    const details = { centerId: id, outFile, stderr: stderr?.slice(0, 500) }
    await sql`
      UPDATE ops_runs SET status = 'success', finished_at = now(),
        details = ${JSON.stringify(details)}::jsonb
      WHERE id = ${runId}
    `
    await sql`
      INSERT INTO audit_logs (id, master_user_id, action, details, created_at)
      VALUES (${crypto.randomUUID()}, ${session.id}, 'center_backup',
              ${JSON.stringify({ centerId: id, runId, outFile })}::jsonb, now())
    `
    return NextResponse.json({ ok: true, runId, outFile })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await sql`
      UPDATE ops_runs SET status = 'failed', finished_at = now(),
        details = ${JSON.stringify({ centerId: id, error: msg })}::jsonb
      WHERE id = ${runId}
    `
    return NextResponse.json({ error: msg, runId }, { status: 500 })
  }
}
