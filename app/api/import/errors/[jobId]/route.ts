import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { sql } from "@/lib/db"
import * as fs from "fs"
import * as path from "path"
import { withTenantAuth } from "@/lib/tenant-api-auth"

type Ctx = { params: Promise<{ jobId: string }> }

export const GET = withTenantAuth(async (req: NextRequest, session, { params }: Ctx) => {
  const adminErr = requireAdmin(session)
  if (adminErr) return adminErr

  const { jobId } = await params
  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing job id" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  const rows = await sql`SELECT "errorFilePath" FROM "ImportJob" WHERE id = ${jobId} LIMIT 1`
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: { "Content-Type": "application/json" } })
  }
  const errorFilePath = (rows[0] as { errorFilePath: string | null }).errorFilePath
  if (!errorFilePath) {
    return new Response(JSON.stringify({ error: "No error file for this job" }), { status: 404, headers: { "Content-Type": "application/json" } })
  }

  const fullPath = path.join(process.cwd(), errorFilePath)
  if (!fs.existsSync(fullPath)) {
    return new Response(JSON.stringify({ error: "Error file not found" }), { status: 404, headers: { "Content-Type": "application/json" } })
  }

  const buf      = fs.readFileSync(fullPath)
  const filename = path.basename(fullPath)
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
})
