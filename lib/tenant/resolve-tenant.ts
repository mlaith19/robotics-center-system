/**
 * Single tenant resolution: production by subdomain (host), local by ?center=, tenant-id cookie (dev), or default slug.
 * All tenant API routes use requireTenant(req) from here.
 */

import { sql } from "@/lib/db"
import { getTenantDb } from "@/lib/tenant-db"
import { normalizeTenantDbUrl } from "@/lib/db/normalizeTenantDbUrl"
import type postgres from "postgres"

export interface ResolvedTenant {
  ok: true
  centerId: string
  subdomain: string
  centerName: string
  tenantDbUrl: string
  db: ReturnType<typeof postgres>
}

export interface TenantResolveFailure {
  ok: false
  reason: string
  host?: string
}

/** "center1.localhost:3000" → "center1"; "center1.example.com" → "center1" */
export function getSubdomainFromHost(host: string): string | null {
  if (!host) return null
  const withoutPort = host.split(":")[0]
  const parts = withoutPort.split(".")
  if (parts.length >= 2) return parts[0]
  return null
}

const DEFAULT_DEV_CENTER_SLUG = "demo"
const TENANT_ID_COOKIE = "tenant-id"
const CENTER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** התחברות / שינוי סיסמה: לא להשתמש ב-tenant-id ישן — אחרת מחפשים משתמש ב-DB של מרכז אחר */
function shouldSkipTenantIdCookie(url: string): boolean {
  try {
    const path = new URL(url, "http://localhost").pathname
    return (
      path === "/api/auth/login" ||
      path.endsWith("/api/auth/login") ||
      path === "/api/auth/change-password" ||
      path.endsWith("/api/auth/change-password")
    )
  } catch {
    return false
  }
}

function readCookie(req: { headers: { get(name: string): string | null } }, name: string): string | null {
  const raw = req.headers.get("cookie")
  if (!raw) return null
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  if (!m) return null
  try {
    return decodeURIComponent(m[1].trim())
  } catch {
    return m[1].trim()
  }
}

type CenterRow = { id: string; subdomain: string; name: string; tenant_db_url: string | null }

async function finalizeResolvedTenant(
  center: CenterRow,
  host: string,
  source: string
): Promise<ResolvedTenant | TenantResolveFailure> {
  if (!center.tenant_db_url) {
    console.warn("[RESOLVE_TENANT] NO_TENANT_DB centerId=", center.id)
    return { ok: false, reason: "NO_TENANT_DB", host }
  }

  const db = await getTenantDb(center.id)
  if (!db) {
    console.warn("[RESOLVE_TENANT] TENANT_DB_UNAVAILABLE centerId=", center.id)
    return { ok: false, reason: "TENANT_DB_UNAVAILABLE", host }
  }

  const tenantDbUrl = normalizeTenantDbUrl(center.tenant_db_url)
  console.log("[RESOLVE_TENANT] OK centerSlug=", center.subdomain, " centerId=", center.id, source)

  return {
    ok: true,
    centerId: center.id,
    subdomain: center.subdomain,
    centerName: center.name ?? center.subdomain,
    tenantDbUrl,
    db: db as unknown as ReturnType<typeof postgres>,
  }
}

/**
 * Resolve tenant: production by subdomain (host); local by ?center= or default "demo".
 * - Production: demo.ml-systems.net => centerSlug=demo
 * - Local: ?center=XYZ => centerSlug=XYZ; else default "demo"
 */
export async function resolveTenantBySubdomain(
  req: Request | { headers: { get(name: string): string | null }; url?: string }
): Promise<ResolvedTenant | TenantResolveFailure> {
  const host = req.headers.get("host") ?? ""
  const url = "url" in req && typeof req.url === "string" ? req.url : ""

  let subdomain = getSubdomainFromHost(host)

  if (process.env.NODE_ENV !== "production" && (host.startsWith("localhost") || host.startsWith("127.0.0.1"))) {
    const bare = host.split(":")[0]
    if (bare === "localhost" || bare === "127.0.0.1") {
      let slugFromQuery: string | null = null
      try {
        slugFromQuery = url ? new URL(url).searchParams.get("center")?.trim() || null : null
      } catch { /* ignore */ }
      if (slugFromQuery) {
        subdomain = subdomain ?? slugFromQuery
      }

      // Bare localhost + no ?center=: use HttpOnly tenant-id cookie (set at login) so API routes
      // match the same center as tenant-session — avoids TENANT_MISMATCH vs DEFAULT_DEV_CENTER.
      // לא ב-login/change-password — קוקי ישן מפנה לטננט הלא נכון ואז "משתמש לא נמצא" / סיסמה שגויה.
      if (!subdomain && !shouldSkipTenantIdCookie(url)) {
        const tid = readCookie(req, TENANT_ID_COOKIE)
        if (tid && CENTER_UUID_RE.test(tid)) {
          const byId = await sql`
            SELECT id, subdomain, name, tenant_db_url
            FROM centers
            WHERE id = ${tid} AND status IN ('active', 'trial')
            LIMIT 1
          ` as CenterRow[]
          if (byId.length > 0) {
            return finalizeResolvedTenant(byId[0], host, "source=tenant-id-cookie")
          }
        }
      }

      const devCenter = process.env.DEFAULT_DEV_CENTER ?? DEFAULT_DEV_CENTER_SLUG
      subdomain = subdomain ?? devCenter
    }
  }

  if (!subdomain) {
    console.warn("[RESOLVE_TENANT] NO_SUBDOMAIN host=", host)
    return { ok: false, reason: "NO_SUBDOMAIN", host }
  }

  const rows = await sql`
    SELECT id, subdomain, name, tenant_db_url
    FROM centers
    WHERE subdomain = ${subdomain} AND status IN ('active', 'trial')
    LIMIT 1
  ` as CenterRow[]

  if (rows.length === 0) {
    console.warn("[RESOLVE_TENANT] CENTER_NOT_FOUND subdomain=", subdomain, " host=", host)
    return { ok: false, reason: "CENTER_NOT_FOUND", host }
  }

  return finalizeResolvedTenant(rows[0], host, "source=subdomain")
}

/**
 * If session has centerId and it doesn't match the resolved tenant, return 403 so a session from center A
 * cannot be used on center B's subdomain. Use after requireTenant in tenant API routes.
 */
export function ensureSessionMatchesTenant(
  session: { centerId?: string },
  tenant: ResolvedTenant
): Response | null {
  // Session MUST have centerId — a missing centerId means the session is malformed or forged
  if (!session.centerId) {
    console.warn("[TENANT_MISMATCH] Session missing centerId — possible forged or legacy session")
    return new Response(
      JSON.stringify({
        error: "TENANT_MISMATCH",
        message: "ההתחברות אינה תקפה. התחבר מחדש.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    )
  }
  if (session.centerId === tenant.centerId) return null
  return new Response(
    JSON.stringify({
      error: "TENANT_MISMATCH",
      message: "ההתחברות שייכת למרכז אחר. התחבר מחדש למרכז זה.",
    }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  )
}

/**
 * requireTenant(req) => [tenant, null] | [null, Response(400)]
 * Use in tenant API routes and login. Returns 400 with TENANT_NOT_RESOLVED if subdomain missing or center not found.
 */
export async function requireTenant(
  req: Request | { headers: { get(name: string): string | null }; url: string }
): Promise<[ResolvedTenant, null] | [null, Response]> {
  const result = await resolveTenantBySubdomain(req)
  if (!result.ok) {
    return [
      null,
      new Response(
        JSON.stringify({
          error: "TENANT_NOT_RESOLVED",
          reason: result.reason,
          host: result.host,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ),
    ]
  }
  return [result, null]
}
