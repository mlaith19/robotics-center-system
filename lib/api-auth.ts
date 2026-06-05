/**
 * lib/api-auth.ts — re-exports from lib/tenant-api-auth.ts
 *
 * Kept for backward compatibility. All new code should import from
 * @/lib/tenant-api-auth directly.
 */
export { withTenantAuth, type SessionUser } from "@/lib/tenant-api-auth"
