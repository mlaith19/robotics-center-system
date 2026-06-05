import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { buildTemplateXlsx } from "@/lib/import/templates"
import type { EntityType } from "@/lib/import/entity-fields"
import { withTenantAuth } from "@/lib/tenant-api-auth"

const ENTITIES: EntityType[] = ["students", "teachers", "payments"]

export const GET = withTenantAuth(async (req: NextRequest, session) => {
  const adminErr = requireAdmin(session)
  if (adminErr) return adminErr

  const { searchParams } = new URL(req.url)
  const entity = searchParams.get("entity") as EntityType | null
  const lang   = searchParams.get("lang") === "en" ? "en" : "he"

  if (!entity || !ENTITIES.includes(entity)) {
    return new Response(JSON.stringify({ error: "Invalid entity" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const buffer = buildTemplateXlsx(entity, lang)
    const filename = `import-${entity}-template-${lang}.xlsx`
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error("Import template error:", e)
    return new Response(JSON.stringify({ error: "Failed to generate template" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    })
  }
})
