import { requireTenant } from "@/lib/tenant/resolve-tenant"

function normalizeLogoUrl(logo: string, origin: string): string {
  const value = logo.trim()
  if (!value) return `${origin}/icon-light-32x32.png`
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("/")) return `${origin}${value}`
  return `${origin}/${value}`
}

export async function GET(req: Request) {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) {
    const origin = new URL(req.url).origin
    return Response.redirect(`${origin}/icon-light-32x32.png`, 302)
  }

  try {
    const rows = await tenant.db`
      SELECT logo
      FROM center_settings
      WHERE id = 1
      LIMIT 1
    ` as { logo?: string | null }[]

    const origin = new URL(req.url).origin
    const rawLogo = typeof rows[0]?.logo === "string" ? rows[0].logo : ""
    const target = normalizeLogoUrl(rawLogo, origin)
    return Response.redirect(target, 302)
  } catch {
    const origin = new URL(req.url).origin
    return Response.redirect(`${origin}/icon-light-32x32.png`, 302)
  }
}

