import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { executeImport } from "@/lib/import/execute"
import { parseBuffer, MAX_FILE_SIZE_BYTES } from "@/lib/import/parse"
import type { EntityType } from "@/lib/import/entity-fields"
import { withTenantAuth } from "@/lib/tenant-api-auth"

const ENTITIES: EntityType[] = ["students", "teachers", "payments"]

export const POST = withTenantAuth(async (req: NextRequest, session) => {
  const adminErr = requireAdmin(session)
  if (adminErr) return adminErr

  const userId = session.id

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid form data" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  const file = formData.get("file") as File | null
  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return new Response(JSON.stringify({ error: "FILE_TOO_LARGE", maxSize: MAX_FILE_SIZE_BYTES }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  const entity        = formData.get("entity") as string
  const mode          = (formData.get("mode") as string) || "create"
  const mappingStr    = formData.get("mapping") as string
  const selectedSheet = (formData.get("selectedSheet") as string) || undefined
  const lang          = (formData.get("lang") as string) || null

  if (!entity || !ENTITIES.includes(entity as EntityType)) {
    return new Response(JSON.stringify({ error: "Invalid entity" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
  if (mode !== "create" && mode !== "upsert") {
    return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  let mapping: Record<string, string>
  try {
    mapping = JSON.parse(mappingStr || "{}")
  } catch {
    return new Response(JSON.stringify({ error: "Invalid mapping JSON" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const type   = file.type
  let rows: Record<string, unknown>[]
  try {
    const parseResult = parseBuffer(buffer, type, selectedSheet, 0)
    rows = parseResult.rows
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "No data rows" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  try {
    const result = await executeImport(userId, entity as EntityType, mode as "create" | "upsert", mapping, rows, file.name, lang)
    return Response.json(result)
  } catch (e) {
    console.error("Import execute error:", e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Import failed" }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
