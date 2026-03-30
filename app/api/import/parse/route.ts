import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { parseBuffer, MAX_FILE_SIZE_BYTES } from "@/lib/import/parse"
import { withTenantAuth } from "@/lib/tenant-api-auth"

export const POST = withTenantAuth(async (req: NextRequest, session) => {
  const adminErr = requireAdmin(session)
  if (adminErr) return adminErr

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

  const type = file.type
  const name = file.name.toLowerCase()
  const isXlsx = name.endsWith(".xlsx") || type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  const isCsv  = name.endsWith(".csv") || type === "text/csv" || type === "application/csv"
  if (!isXlsx && !isCsv) {
    return new Response(JSON.stringify({ error: "Only .xlsx and .csv are allowed" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  const selectedSheet = (formData.get("selectedSheet") as string) || undefined
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = parseBuffer(buffer, type, selectedSheet)
    return Response.json({ sheetNames: result.sheetNames, columns: result.columns, rows: result.rows, selectedSheet: result.selectedSheet })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
})
