/**
 * lib/with-tenant-auth.ts
 *
 * Global tenant API auth wrapper.
 * Authenticates user, refreshes lastActivity, re-issues tenant-session cookie.
 *
 * USAGE — simple route:
 *   export const GET = withTenantAuth(async (req, session) => {
 *     return Response.json({ user: session.username })
 *   })
 *
 * USAGE — dynamic route with params:
 *   type Ctx = { params: Promise<{ id: string }> }
 *   export const GET = withTenantAuth(async (req, session, { params }: Ctx) => {
 *     const { id } = await params
 *     return Response.json({ id })
 *   })
 */
export { withTenantAuth, type SessionUser } from "@/lib/tenant-api-auth"
