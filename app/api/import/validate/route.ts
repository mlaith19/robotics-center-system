import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { validateMapping, validateRows } from "@/lib/import/validate"
import type { EntityType } from "@/lib/import/entity-fields"
import { withTenantAuth } from "@/lib/tenant-api-auth"

const ENTITIES: EntityType[] = ["students", "teachers", "payments"]

export const POST = withTenantAuth(async (req: NextRequest, session) => {
  const adminErr = requireAdmin(session)
  if (adminErr) return adminErr

  let body: { entity?: string; mapping?: Record<string, string>; rows?: Record<string, unknown>[] }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  const entity  = body.entity  as EntityType | undefined
  const mapping = body.mapping as Record<string, string> | undefined
  const rows    = body.rows    as Record<string, unknown>[] | undefined

  if (!entity || !ENTITIES.includes(entity)) {
    return new Response(JSON.stringify({ error: "Invalid entity" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
  if (!mapping || typeof mapping !== "object") {
    return new Response(JSON.stringify({ error: "Mapping is required" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
  if (!Array.isArray(rows)) {
    return new Response(JSON.stringify({ error: "Rows array is required" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  const { missingRequired, duplicates } = validateMapping(entity, mapping)
  const rowValidations = validateRows(entity, mapping, rows)
  const valid = missingRequired.length === 0 && duplicates.length === 0 && rowValidations.every((r) => r.errors.length === 0)

  return Response.json({ valid, missingRequiredMappings: missingRequired, duplicateMappings: duplicates, rowValidations })
})
