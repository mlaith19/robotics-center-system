import { NextResponse } from "next/server"
import { requireTenant } from "@/lib/tenant/resolve-tenant"

export async function GET(req: Request) {
  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) {
    return NextResponse.json({ center_name: "מרכז רובוטיקה", logo: "/api/og-logo" })
  }

  try {
    const rows = await tenant.db`
      SELECT center_name, logo
      FROM center_settings
      WHERE id = 1
      LIMIT 1
    ` as { center_name?: string | null; logo?: string | null }[]

    const row = rows[0]
    const centerName = typeof row?.center_name === "string" && row.center_name.trim().length > 0
      ? row.center_name.trim()
      : "מרכז רובוטיקה"
    const logo = typeof row?.logo === "string" && row.logo.trim().length > 0
      ? row.logo.trim()
      : "/api/og-logo"

    return NextResponse.json({ center_name: centerName, logo })
  } catch {
    return NextResponse.json({ center_name: "מרכז רובוטיקה", logo: "/api/og-logo" })
  }
}
