/**
 * Tenant resolution (Phase 2).
 * Extracts subdomain from Host header, looks up domain in Master DB,
 * returns tenant context (center_id, plan, enabledFeatures, subscription, accessMode).
 */

import { sql } from "@/lib/db"
import { normalizeTenantDbUrl } from "@/lib/db/normalizeTenantDbUrl"

export type TenantContext = {
  centerId: string | null
  plan: { id: string; name: string } | null
  enabledFeatures: string[]
  subscription: {
    id: string
    planId: string
    startDate: string
    endDate: string
    isTrial: boolean
  } | null
  accessMode: "ACTIVE" | "EXPIRED_READONLY" | "ACTIVATION_ONLY" | "SUSPENDED" | "TRIAL_ACTIVE" | "TRIAL_EXPIRED_READONLY" | "TRIAL_ACTIVATION_ONLY"
  tenantDbUrl: string | null
}

/**
 * Extract subdomain from Host header.
 * E.g. "center1.localhost:3000" -> "center1", "center1.example.com" -> "center1"
 */
export function getSubdomainFromHost(host: string): string | null {
  if (!host) return null
  const withoutPort = host.split(":")[0]
  const parts = withoutPort.split(".")
  if (parts.length >= 2) {
    return parts[0]
  }
  return null
}

const HOST_TO_CENTER_CACHE_TTL_MS = 60_000 // 60 seconds
const hostCache = new Map<string, { centerId: string | null; expiresAt: number }>()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Cache the resolved dev center UUID for the lifetime of the process (dev only)
let devCenterCache: { value: string; resolved: string | null } | null = null

/**
 * Resolve DEFAULT_DEV_CENTER to a center UUID.
 * Accepts either a UUID directly or a subdomain/name — looks up by subdomain if not a UUID.
 * Result is cached in-process so only one DB query is made per server restart.
 */
async function resolveDevCenter(value: string): Promise<string | null> {
  if (devCenterCache && devCenterCache.value === value) return devCenterCache.resolved
  if (UUID_RE.test(value)) {
    devCenterCache = { value, resolved: value }
    return value
  }
  // Treat as subdomain: look up center by subdomain (runs once per server restart)
  try {
    const rows = await sql`SELECT id FROM centers WHERE subdomain = ${value} LIMIT 1`
    const resolved = rows.length > 0 ? (rows[0] as { id: string }).id : null
    devCenterCache = { value, resolved }
    return resolved
  } catch {
    return null
  }
}

/**
 * Look up domain in Master DB by host and return center_id.
 * domains.host is UNIQUE and stores full host without port (e.g. "center1.localhost").
 * Result cached for 60 seconds.
 *
 * LOCAL DEV: if host is localhost or 127.0.0.1, resolves DEFAULT_DEV_CENTER
 * (supports both UUID and subdomain name — no manual UUID lookup needed).
 */
export async function getCenterIdByHost(host: string): Promise<string | null> {
  const hostWithoutPort = host.split(":")[0]

  if (hostWithoutPort === "localhost" || hostWithoutPort === "127.0.0.1") {
    const devCenter = process.env.DEFAULT_DEV_CENTER ?? null
    if (!devCenter) return null
    return resolveDevCenter(devCenter)
  }

  const now = Date.now()
  const cached = hostCache.get(hostWithoutPort)
  if (cached && cached.expiresAt > now) return cached.centerId

  try {
    const rows = await sql`
      SELECT center_id
      FROM domains
      WHERE host = ${hostWithoutPort}
      LIMIT 1
    `
    const centerId = rows.length > 0 ? (rows[0] as { center_id: string }).center_id : null
    hostCache.set(hostWithoutPort, { centerId, expiresAt: now + HOST_TO_CENTER_CACHE_TTL_MS })
    return centerId
  } catch {
    return null
  }
}

/**
 * Get full tenant context for a center_id (plan, subscription, enabledFeatures, accessMode).
 */
export async function getTenantContext(centerId: string): Promise<TenantContext | null> {
  try {
    const centerRows = await sql`
      SELECT id, name, subdomain, status, tenant_db_url
      FROM centers
      WHERE id = ${centerId}
      LIMIT 1
    `
    const centerRow = centerRows[0] as { id: string; name: string; tenant_db_url: string | null } | undefined
    if (!centerRow) return null

    const subRows = await sql`
      SELECT id, plan_id, start_date, end_date, is_trial
      FROM subscriptions
      WHERE center_id = ${centerId}
      ORDER BY created_at DESC
      LIMIT 1
    `
    const subRow = subRows[0] as { id: string; plan_id: string; start_date: string; end_date: string; is_trial: boolean } | undefined

    let planRow: { id: string; name: string } | null = null
    if (subRow) {
      const planRows = await sql`SELECT id, name FROM plans WHERE id = ${subRow.plan_id} LIMIT 1`
      planRow = planRows[0] as { id: string; name: string } ?? null
    }

    let planFeatures: string[] = []
    if (planRow) {
      const pfRows = await sql`SELECT feature_key FROM plan_features WHERE plan_id = ${planRow.id}`
      planFeatures = (pfRows as { feature_key: string }[]).map((r) => r.feature_key)
    }

    // תוכניות עם plan_features חלקי: אם יש קורסים/תלמידים/מורים — בתי ספר וגפ"ן הם חלק מאותה חבילה תפעולית
    const hasTeachingCore = planFeatures.some(
      (f) => f === "courses" || f === "students" || f === "teachers",
    )
    if (hasTeachingCore) {
      const merged = new Set(planFeatures)
      merged.add("schools")
      merged.add("gafan")
      planFeatures = [...merged]
    }

    const accessMode = computeAccessMode(subRow)
    const rawTenantDbUrl = centerRow.tenant_db_url ?? null
    const tenantDbUrl = rawTenantDbUrl ? normalizeTenantDbUrl(rawTenantDbUrl) : null

    return {
      centerId,
      plan: planRow,
      enabledFeatures: planFeatures,
      subscription: subRow
        ? {
            id: subRow.id,
            planId: subRow.plan_id,
            startDate: subRow.start_date,
            endDate: subRow.end_date,
            isTrial: subRow.is_trial,
          }
        : null,
      accessMode,
      tenantDbUrl,
    }
  } catch {
    return null
  }
}

function computeAccessMode(
  sub: { end_date: string; is_trial: boolean } | undefined
): TenantContext["accessMode"] {
  if (!sub) return "ACTIVATION_ONLY"
  const end = new Date(sub.end_date).getTime()
  const now = Date.now()
  const daysSinceExpiry = (now - end) / (24 * 60 * 60 * 1000)
  if (daysSinceExpiry < 0) return sub.is_trial ? "TRIAL_ACTIVE" : "ACTIVE"
  if (daysSinceExpiry <= 7) return sub.is_trial ? "TRIAL_EXPIRED_READONLY" : "EXPIRED_READONLY"
  return sub.is_trial ? "TRIAL_ACTIVATION_ONLY" : "ACTIVATION_ONLY"
}
