import { NextResponse } from "next/server"
import postgres from "postgres"

export const runtime = "nodejs"

/**
 * Readiness probe — checks:
 * 1. Master DB reachable
 * 2. Required tables exist (master_users, centers)
 */
export async function GET() {
  const url = process.env.DATABASE_URL || process.env.MASTER_DATABASE_URL
  if (!url) {
    return NextResponse.json(
      { ready: false, reason: "DATABASE_URL not set" },
      { status: 503 }
    )
  }

  let sql: ReturnType<typeof postgres> | null = null
  try {
    sql = postgres(url, { max: 1, connect_timeout: 5 })

    // Check DB connectivity
    await sql`SELECT 1`

    // Check required tables exist
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('centers', 'master_users', 'plans', 'license_keys')
    `
    const found = tables.map((t) => t.table_name)
    const required = ["centers", "master_users", "plans"]
    const missing = required.filter((t) => !found.includes(t))

    if (missing.length > 0) {
      return NextResponse.json(
        {
          ready: false,
          reason: "missing required tables",
          missing,
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        ready: true,
        db: "connected",
        tables: found,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error"
    return NextResponse.json(
      { ready: false, reason: msg },
      { status: 503 }
    )
  } finally {
    if (sql) await sql.end().catch(() => {})
  }
}
