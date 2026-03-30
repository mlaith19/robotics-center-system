import { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createHash, randomUUID } from "crypto"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

function hashKey(key: string): string {
  return createHash("sha256").update(key.trim(), "utf8").digest("hex")
}

/**
 * POST /api/activate
 * Phase 8: Serial license activation.
 * Body: { key: string }
 * centerId from x-tenant-center-id header (set by middleware).
 * Validates key, binds to center if unbound, extends subscription, logs activation.
 */
export async function POST(request: NextRequest) {
  const centerId = request.headers.get("x-tenant-center-id")
  if (!centerId) {
    return NextResponse.json(
      { error: "Tenant context required. Use the center subdomain." },
      { status: 400 }
    )
  }

  let body: { key?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const rawKey = typeof body?.key === "string" ? body.key.trim() : ""
  if (!rawKey) {
    return NextResponse.json({ error: "License key is required" }, { status: 400 })
  }

  const keyHash = hashKey(rawKey)

  try {
    const keys = await sql`
      SELECT id, plan_id, duration_days, max_activations, status, center_id
      FROM license_keys
      WHERE key_hash = ${keyHash} AND status = 'active'
      LIMIT 1
    `
    const keyRow = keys[0] as { id: string; plan_id: string; duration_days: number; max_activations: number; center_id: string | null } | undefined

    if (!keyRow) {
      return NextResponse.json({ error: "Invalid or inactive license key" }, { status: 400 })
    }

    if (keyRow.center_id != null && keyRow.center_id !== centerId) {
      return NextResponse.json({ error: "This key is already bound to another center" }, { status: 400 })
    }

    const actCount = await sql`
      SELECT COUNT(*) as c FROM license_activations WHERE license_key_id = ${keyRow.id}
    `
    const count = Number((actCount[0] as { c: string })?.c ?? 0)
    if (count >= keyRow.max_activations) {
      return NextResponse.json({ error: "License key has reached maximum activations" }, { status: 400 })
    }

    const existingActivation = await sql`
      SELECT id FROM license_activations
      WHERE license_key_id = ${keyRow.id} AND center_id = ${centerId}
      LIMIT 1
    `
    if (existingActivation.length > 0) {
      return NextResponse.json({ error: "This center has already activated this key" }, { status: 400 })
    }

    await sql.begin(async (tx) => {
      if (keyRow.center_id == null) {
        await tx`UPDATE license_keys SET center_id = ${centerId} WHERE id = ${keyRow.id}`
      }

      const now = new Date()
      const endDate = new Date(now)
      endDate.setDate(endDate.getDate() + keyRow.duration_days)
      const startStr = now.toISOString().slice(0, 10)
      const endStr = endDate.toISOString().slice(0, 10)

      const existingSub = await tx`
        SELECT id, end_date FROM subscriptions
        WHERE center_id = ${centerId}
        ORDER BY created_at DESC
        LIMIT 1
      `
      const sub = existingSub[0] as { id: string; end_date: string } | undefined

      if (sub) {
        const currentEnd = new Date(sub.end_date)
        const extendEnd = new Date(currentEnd)
        extendEnd.setDate(extendEnd.getDate() + keyRow.duration_days)
        const newEndStr = extendEnd.toISOString().slice(0, 10)
        await tx`
          UPDATE subscriptions
          SET plan_id = ${keyRow.plan_id}, end_date = ${newEndStr}
          WHERE id = ${sub.id}
        `
      } else {
        const subId = randomUUID()
        await tx`
          INSERT INTO subscriptions (id, center_id, plan_id, start_date, end_date, is_trial, created_at)
          VALUES (${subId}, ${centerId}, ${keyRow.plan_id}, ${startStr}, ${endStr}, false, now())
        `
      }

      const actId = randomUUID()
      await tx`
        INSERT INTO license_activations (id, license_key_id, center_id, activated_at)
        VALUES (${actId}, ${keyRow.id}, ${centerId}, now())
      `

      await tx`
        INSERT INTO audit_logs (id, action, details, created_at)
        VALUES (${randomUUID()}, 'license_activated', ${JSON.stringify({ license_key_id: keyRow.id, center_id: centerId })}::jsonb, now())
      `
    })

    return NextResponse.json({
      success: true,
      message: "License activated successfully",
    })
  } catch (err) {
    console.error("Activation error:", err)
    return NextResponse.json(
      { error: "Activation failed" },
      { status: 500 }
    )
  }
}
