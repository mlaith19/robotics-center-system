import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { sql } from "@/lib/db"
import { getTenantDb } from "@/lib/tenant-db"

function normalizeLogoUrl(logo: string, origin: string): string {
  const value = logo.trim()
  if (!value) return `${origin}/icon-light-32x32.png`
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("/")) return `${origin}${value}`
  return `${origin}/${value}`
}

async function resolveLogoByCenterSlug(centerSlug: string): Promise<string | null> {
  const slug = centerSlug.trim()
  if (!slug) return null

  const centers = await sql`
    SELECT id
    FROM centers
    WHERE subdomain = ${slug}
      AND status IN ('active', 'trial')
    LIMIT 1
  ` as { id: string }[]
  const centerId = centers[0]?.id
  if (!centerId) return null

  const tenantDb = await getTenantDb(centerId)
  if (!tenantDb) return null

  const rows = await tenantDb`
    SELECT logo
    FROM center_settings
    WHERE id = 1
    LIMIT 1
  ` as { logo?: string | null }[]

  return typeof rows[0]?.logo === "string" ? rows[0].logo : null
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url)
  const origin = reqUrl.origin

  // If request includes ?center=slug (or arrives from a referer with center query),
  // resolve tenant logo explicitly so links shared from the root domain still get center branding.
  const centerFromQuery = reqUrl.searchParams.get("center")?.trim() ?? ""
  const centerFromReferer = (() => {
    const raw = req.headers.get("referer")
    if (!raw) return ""
    try {
      return new URL(raw).searchParams.get("center")?.trim() ?? ""
    } catch {
      return ""
    }
  })()
  const centerSlug = centerFromQuery || centerFromReferer

  if (centerSlug) {
    try {
      const logo = await resolveLogoByCenterSlug(centerSlug)
      if (logo) {
        return Response.redirect(normalizeLogoUrl(logo, origin), 302)
      }
    } catch {
      // fall through to default tenant resolution
    }
  }

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) {
    return Response.redirect(`${origin}/icon-light-32x32.png`, 302)
  }

  try {
    const rows = await tenant.db`
      SELECT logo
      FROM center_settings
      WHERE id = 1
      LIMIT 1
    ` as { logo?: string | null }[]

    const rawLogo = typeof rows[0]?.logo === "string" ? rows[0].logo : ""
    const target = normalizeLogoUrl(rawLogo, origin)
    return Response.redirect(target, 302)
  } catch {
    return Response.redirect(`${origin}/icon-light-32x32.png`, 302)
  }
}

