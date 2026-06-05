/**
 * getRequestDb — resolve the correct postgres client for a dashboard API request.
 *
 * Priority:
 *  1. centerId stored in session cookie (most reliable — set at login)
 *  2. x-tenant-center-id header set by middleware
 *  3. Host-based resolution (getCenterIdByHost) — handles localhost + subdomains
 *  4. Fall back to master DB (sql) — dev single-DB mode
 *
 * Usage in any API route:
 *   const db = await getRequestDb(req)
 *   const rows = await db`SELECT ...`
 */

import { sql } from "@/lib/db"
import { getTenantDb } from "@/lib/tenant-db"
import { getCenterIdByHost } from "@/lib/tenant"
import { TENANT_SESSION_COOKIE_NAME } from "@/lib/session-config"
import { verifyAndDecodeSession } from "@/lib/session-codec"
import type postgres from "postgres"

type DbClient = ReturnType<typeof postgres>

const TENANT_HEADER = "x-tenant-center-id"

async function getCenterIdFromSession(req: Request): Promise<string | null> {
  try {
    const cookie = req.headers.get("cookie") ?? ""
    const match = cookie.match(
      new RegExp(`(?:^|;\\s*)${TENANT_SESSION_COOKIE_NAME}=([^;]+)`)
    )
    if (!match) return null
    const raw = match[1].trim()
    const session = await verifyAndDecodeSession(raw)
    if (!session) return null
    return typeof session.centerId === "string" ? session.centerId : null
  } catch {
    return null
  }
}

export async function getRequestDb(req: Request): Promise<DbClient> {
  // 1. Session centerId (most reliable — works with signed base64url tenant-session)
  let centerId: string | null = await getCenterIdFromSession(req)

  // 2. Middleware header
  if (!centerId) centerId = req.headers.get(TENANT_HEADER)

  // 3. Host-based resolution
  if (!centerId) {
    const host = req.headers.get("host") ?? ""
    if (host) centerId = await getCenterIdByHost(host)
  }

  if (centerId) {
    const tenantClient = await getTenantDb(centerId)
    if (tenantClient) return tenantClient as unknown as DbClient
  }

  // 4. Fall back to master DB
  return sql as unknown as DbClient
}
