import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import * as fs from "fs"
import * as path from "path"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"

type Ctx = { params: Promise<{ jobId: string }> }

export const GET = withTenantAuth(async (req: NextRequest, session, { params }: Ctx) => {
  const { jobId } = await params
  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing job id" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db

  const rows = await db`
    SELECT "errorFilePath", "userId"
    FROM "ImportJob"
    WHERE id = ${jobId}
    LIMIT 1
  `
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: { "Content-Type": "application/json" } })
  }
  const row = rows[0] as { errorFilePath: string | null; userId: string | null }
  const isAdmin = requireAdmin(session) === null
  const isOwner = typeof row.userId === "string" && row.userId === session.id
  if (!isAdmin && !isOwner) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } })
  }

  const errorFilePath = row.errorFilePath
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
