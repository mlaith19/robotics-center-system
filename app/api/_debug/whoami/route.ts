/**
 * DEV-ONLY: Tenant resolved + session safe summary + first 20 permissions.
 * GET /api/_debug/whoami
 */

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-server"
import { resolveTenantBySubdomain } from "@/lib/tenant/resolve-tenant"
import { ensureDebugRouteAllowed } from "@/lib/debug-routes"

export async function GET(req: NextRequest) {
  const blocked = ensureDebugRouteAllowed()
  if (blocked) return blocked

  const tenant = await resolveTenantBySubdomain(req)
  const session = await getSession(req)

  const tenantSummary = tenant.ok
    ? { ok: true, centerId: tenant.centerId, subdomain: tenant.subdomain, centerName: tenant.centerName }
    : { ok: false, reason: tenant.reason, host: tenant.host }

  const sessionSummary = session
    ? {
        id: session.id,
        username: session.username,
        role: session.role,
        roleKey: session.roleKey,
        permissionsCount: session.permissions?.length ?? 0,
        first20Permissions: (session.permissions ?? []).slice(0, 20),
      }
    : null

  return NextResponse.json({
    tenant: tenantSummary,
    session: sessionSummary,
    now: new Date().toISOString(),
  })
}
