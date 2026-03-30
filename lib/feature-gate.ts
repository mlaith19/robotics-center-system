/**
 * Phase 10: Feature gating by plan.
 * When x-tenant-center-id is present, only features in plan_features are allowed.
 */

import { getTenantContext } from "@/lib/tenant"
import { sessionRolesGrantFullAccess } from "@/lib/permissions"

export type FeatureGateResult =
  | { allowed: true }
  | { allowed: false; reason: string }

/** Known feature keys (must match plan_features.feature_key). */
export const FEATURE_KEYS = [
  "students",
  "teachers",
  "courses",
  "schools",
  "gafan",
  "reports",
  "payments",
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

/**
 * Check if a feature is enabled for the tenant.
 * - If centerId is null (no tenant), allow (single-tenant / localhost).
 * - If centerId is set, resolve tenant context and check enabledFeatures.
 */
export async function requireFeature(
  centerId: string | null,
  featureKey: string
): Promise<FeatureGateResult> {
  if (!centerId) return { allowed: true }
  const ctx = await getTenantContext(centerId)
  if (!ctx) return { allowed: false, reason: "Tenant not found" }
  const enabled = ctx.enabledFeatures || []
  if (enabled.includes(featureKey)) return { allowed: true }
  return { allowed: false, reason: `Feature "${featureKey}" is not enabled for this plan` }
}

/**
 * Get enabled features for a tenant (for UI). Returns all FEATURE_KEYS if no tenant.
 */
export async function getEnabledFeatures(centerId: string | null): Promise<string[]> {
  if (!centerId) return [...FEATURE_KEYS]
  const ctx = await getTenantContext(centerId)
  return ctx?.enabledFeatures ?? []
}

/** אותה לוגיקה כמו גישה מלאה ב־UI — אדמין/מנהל/מזכירה/רכז וכו' עוברים מנוי גם אם plan_features חסר */
export function isPrivilegedForFeatureGate(session: { roleKey?: string; role?: string } | null): boolean {
  if (!session) return false
  return sessionRolesGrantFullAccess(session.roleKey, session.role)
}

/**
 * Use in API routes: pass request, feature key, and optionally session.
 * If session is provided and user is admin/center_admin etc., always allow (return null).
 * Otherwise returns 403 Response if feature not enabled for plan.
 */
export async function requireFeatureFromRequest(
  req: Request,
  featureKey: string,
  session?: { roleKey?: string; role?: string } | null
): Promise<Response | null> {
  if (session && isPrivilegedForFeatureGate(session)) return null
  const centerId = req.headers.get("x-tenant-center-id")
  const result = await requireFeature(centerId, featureKey)
  if (result.allowed) return null
  return new Response(
    JSON.stringify({ error: "errors.featureNotEnabled", reason: result.reason }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  )
}
