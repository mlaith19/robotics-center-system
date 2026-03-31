import { sql } from "@/lib/db"

let cachedRevision = 0
let cachedAt = 0
const CACHE_MS = 15000

async function ensureRuntimeTable() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS master_runtime_flags (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by TEXT,
      note TEXT
    )
  `)
}

export async function getGlobalSessionRevision(): Promise<number> {
  const now = Date.now()
  if (now - cachedAt < CACHE_MS) return cachedRevision

  await ensureRuntimeTable()
  const rows = await sql`
    SELECT value
    FROM master_runtime_flags
    WHERE key = 'tenant_session_revision'
    LIMIT 1
  ` as { value: string }[]

  const parsed = Number(rows[0]?.value ?? "0")
  cachedRevision = Number.isFinite(parsed) ? parsed : 0
  cachedAt = now
  return cachedRevision
}

export async function bumpGlobalSessionRevision(updatedBy?: string, note?: string): Promise<number> {
  await ensureRuntimeTable()
  const rows = await sql`
    INSERT INTO master_runtime_flags (key, value, updated_by, note, updated_at)
    VALUES ('tenant_session_revision', '1', ${updatedBy ?? null}, ${note ?? null}, now())
    ON CONFLICT (key) DO UPDATE
    SET value = (COALESCE(NULLIF(master_runtime_flags.value, ''), '0')::int + 1)::text,
        updated_by = EXCLUDED.updated_by,
        note = EXCLUDED.note,
        updated_at = now()
    RETURNING value
  ` as { value: string }[]

  const parsed = Number(rows[0]?.value ?? "0")
  cachedRevision = Number.isFinite(parsed) ? parsed : 0
  cachedAt = Date.now()
  return cachedRevision
}
