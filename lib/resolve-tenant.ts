/**
 * lib/resolve-tenant.ts — Unified tenant resolver for API routes.
 *
 * Resolution order (all environments):
 *  1. Query param  ?centerId=<uuid>       (UUID — direct, no DB needed)
 *  2. Query param  ?center=<slug>         (slug  — one DB lookup by subdomain)
 *  3. Header       x-center-id            (explicit caller override)
 *  4. Header       x-tenant-center-id     (injected by proxy.ts / middleware.ts)
 *  5. Cookie       tenant-id              (set after successful login)
 *  6. Host         subdomain / DEFAULT_DEV_CENTER (getCenterIdByHost)
 *
 * Returns ResolvedTenant or null (caller should return 400 TENANT_NOT_RESOLVED).
 *
 * Structured logs:
 *   [TENANT_RESOLVE] source=query   centerId=<id>
 *   [TENANT_RESOLVE] source=slug    centerId=<id>
 *   [TENANT_RESOLVE] source=header  centerId=<id>
 *   [TENANT_RESOLVE] source=cookie  centerId=<id>
 *   [TENANT_RESOLVE] source=host    centerId=<id>
 *   [TENANT_RESOLVE] FAILED centerId not found
 */

import { sql } from "@/lib/db"
import { getTenantDb } from "@/lib/tenant-db"
import { getCenterIdByHost } from "@/lib/tenant"
import { normalizeTenantDbUrl } from "@/lib/db/normalizeTenantDbUrl"
import type postgres from "postgres"

export interface ResolvedTenant {
  centerId: string
  centerSlug: string
  centerName: string
  tenantDbUrl: string
  tenantDbName: string
  db: ReturnType<typeof postgres>
}

const MIDDLEWARE_HEADER = "x-tenant-center-id"
const EXPLICIT_HEADER   = "x-center-id"
const TENANT_ID_COOKIE  = "tenant-id"
const UUID_RE           = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Slug-to-UUID cache (dev only) ─────────────────────────────────────────────
const slugCache = new Map<string, string>()

async function resolveSlugToId(slug: string): Promise<string | null> {
  if (!slug) return null
  // If already a UUID, return as-is
  if (UUID_RE.test(slug)) return slug
  // Check in-memory cache first
  if (slugCache.has(slug)) return slugCache.get(slug)!
  try {
    const rows = await sql`SELECT id FROM centers WHERE subdomain = ${slug} LIMIT 1`
    const id   = rows.length > 0 ? (rows[0] as { id: string }).id : null
    if (id) slugCache.set(slug, id)
    return id
  } catch {
    return null
  }
}

// ── Cookie parser (raw header string) ────────────────────────────────────────
function getCookieValue(req: { headers: { get(name: string): string | null } }, name: string): string | null {
  const raw = req.headers.get("cookie") ?? ""
  if (!raw) return null
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=")
    if (k.trim() === name) return v.join("=").trim()
  }
  return null
}

// ── Main resolver ─────────────────────────────────────────────────────────────

export async function resolveTenant(
  req: Request | { headers: { get(name: string): string | null }; url: string }
): Promise<ResolvedTenant | null> {
  let centerId: string | null = null
  let source = "none"
  const host = req.headers.get("host") ?? ""

  // 1. ?centerId=<uuid>
  try {
    const qs = new URL(req.url).searchParams
    const qc = qs.get("centerId")
    if (qc) {
      centerId = UUID_RE.test(qc) ? qc : await resolveSlugToId(qc)
      if (centerId) source = "query-centerId"
    }
  } catch { /* ignore URL parse errors */ }

  // 2. ?center=<slug-or-uuid>
  if (!centerId) {
    try {
      const qs = new URL(req.url).searchParams
      const qc = qs.get("center")
      if (qc) {
        centerId = await resolveSlugToId(qc)
        if (centerId) source = "query-center"
      }
    } catch { /* ignore */ }
  }

  // 3. x-center-id header
  if (!centerId) {
    const h = req.headers.get(EXPLICIT_HEADER)
    if (h) { centerId = h; source = "header-x-center-id" }
  }

  // 4. x-tenant-center-id header (set by proxy.ts/middleware.ts from host)
  if (!centerId) {
    const h = req.headers.get(MIDDLEWARE_HEADER)
    if (h) { centerId = h; source = "header-x-tenant-center-id" }
  }

  // 5. tenant-id cookie (set after successful login)
  if (!centerId) {
    const c = getCookieValue(req, TENANT_ID_COOKIE)
    if (c) { centerId = UUID_RE.test(c) ? c : await resolveSlugToId(c); source = "cookie" }
  }

  // 6. Host-based resolution (subdomain or DEFAULT_DEV_CENTER)
  if (!centerId && host) {
    centerId = await getCenterIdByHost(host)
    if (centerId) source = "host"
  }

  if (!centerId) {
    console.warn("[TENANT_RESOLVE] FAILED centerId not found (check ?center=, cookie tenant-id, or DEFAULT_DEV_CENTER in .env.local)")
    return null
  }

  console.log(`[TENANT_RESOLVE] source=${source} centerId=${centerId}`)

  // ── Load center row from master DB ────────────────────────────────────────
  const rows = await sql`
    SELECT id, subdomain, name, tenant_db_url
    FROM centers
    WHERE id = ${centerId}
    LIMIT 1
  ` as { id: string; subdomain: string; name: string; tenant_db_url: string | null }[]

  const center = rows[0]
  if (!center) {
    console.warn(`[TENANT_RESOLVE] centerId=${centerId} not found in centers table`)
    return null
  }
  if (!center.tenant_db_url) {
    console.warn(`[TENANT_RESOLVE] centerId=${centerId} has no tenant_db_url`)
    return null
  }

  const tenantDbUrl = normalizeTenantDbUrl(center.tenant_db_url)
  let tenantDbName = "unknown"
  try { tenantDbName = new URL(tenantDbUrl).pathname.replace(/^\//, "") } catch { /* ignore */ }

  const db = await getTenantDb(centerId)
  if (!db) {
    console.warn(`[TENANT_RESOLVE] getTenantDb returned null for centerId=${centerId}`)
    return null
  }

  console.log(`[TENANT_RESOLVE] OK centerId=${centerId} slug=${center.subdomain} db=${tenantDbName}`)

  return {
    centerId,
    centerSlug: center.subdomain,
    centerName: center.name ?? center.subdomain,
    tenantDbUrl,
    tenantDbName,
    db: db as unknown as ReturnType<typeof postgres>,
  }
}
