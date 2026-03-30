/**
 * Phase 3: Tenant database engine.
 * getTenantDb(center_id) with pool caching and TTL.
 */

import postgres from "postgres"
import { sql } from "@/lib/db"
import { normalizeTenantDbUrl } from "@/lib/db/normalizeTenantDbUrl"

const POOL_TTL_MS = 60_000 // 60 seconds - close pool after idle
const poolCache = new Map<
  string,
  { client: ReturnType<typeof postgres>; lastUsed: number }
>()

/**
 * Get tenant DB URL from master (centers.tenant_db_url).
 * Returns null if center has no dedicated tenant DB (single-tenant mode).
 */
export async function getTenantDbUrl(centerId: string): Promise<string | null> {
  const rows = await sql`
    SELECT tenant_db_url FROM centers WHERE id = ${centerId} LIMIT 1
  `
  const row = rows[0] as { tenant_db_url: string | null } | undefined
  return row?.tenant_db_url ?? null
}

/**
 * Get a postgres client for the tenant's database.
 * Pools are cached per center_id; idle pools are closed after POOL_TTL_MS.
 */
export async function getTenantDb(centerId: string): Promise<ReturnType<typeof postgres> | null> {
  const url = await getTenantDbUrl(centerId)
  if (!url) return null

  const now = Date.now()
  const cached = poolCache.get(centerId)
  if (cached) {
    cached.lastUsed = now
    return cached.client
  }

  // Close any stale pools
  for (const [id, entry] of poolCache.entries()) {
    if (now - entry.lastUsed > POOL_TTL_MS) {
      try {
        await entry.client.end()
      } catch (_) {}
      poolCache.delete(id)
    }
  }

  const tenantUrl = normalizeTenantDbUrl(url)
  const client = postgres(tenantUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  })
  poolCache.set(centerId, { client, lastUsed: now })
  return client
}

/**
 * Check connection to a tenant database by URL.
 */
export async function checkTenantDbConnection(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = postgres(normalizeTenantDbUrl(url), { max: 1 })
    await client`SELECT 1`
    await client.end()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
