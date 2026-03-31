import { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createHash, randomUUID } from "crypto"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

function hashKey(key: string): string {
  return createHash("sha256").update(key.trim(), "utf8").digest("hex")
}

const ACTIVATE_FAILURE_LIMIT = 10
const ACTIVATE_WINDOW_MS = 10 * 60 * 1000
const activateAttempts = new Map<string, { count: number; firstAt: number }>()

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

function isRateLimited(req: NextRequest): boolean {
  const ip = clientIp(req)
  const cur = activateAttempts.get(ip)
  if (!cur) return false
  if (Date.now() - cur.firstAt > ACTIVATE_WINDOW_MS) {
    activateAttempts.delete(ip)
    return false
  }
  return cur.count >= ACTIVATE_FAILURE_LIMIT
}

function remainingSeconds(req: NextRequest): number {
  const ip = clientIp(req)
  const cur = activateAttempts.get(ip)
  if (!cur) return 0
  const remain = Math.max(0, ACTIVATE_WINDOW_MS - (Date.now() - cur.firstAt))
  return Math.ceil(remain / 1000)
}

function recordFailure(req: NextRequest): void {
  const ip = clientIp(req)
  const now = Date.now()
  const cur = activateAttempts.get(ip)
  if (!cur) {
    activateAttempts.set(ip, { count: 1, firstAt: now })
    return
  }
  cur.count += 1
}

function clearFailures(req: NextRequest): void {
  activateAttempts.delete(clientIp(req))
}

/**
 * POST /api/activate
 * Phase 8: Serial license activation.
 * Body: { key: string }
 * centerId from x-tenant-center-id header (set by middleware).
 * Validates key, binds to center if unbound, extends subscription, logs activation.
 */
export async function POST(request: NextRequest) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      { error: "Too many activation attempts. Try again later.", retryAfterSeconds: remainingSeconds(request) },
      { status: 429 }
    )
  }

  const centerId = request.headers.get("x-tenant-center-id")
  if (!centerId) {
    recordFailure(request)
    return NextResponse.json(
      { error: "Tenant context required. Use the center subdomain." },
      { status: 400 }
    )
  }

  let body: { key?: string }
  try {
    body = await request.json()
  } catch {
    recordFailure(request)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const rawKey = typeof body?.key === "string" ? body.key.trim() : ""
  if (!rawKey) {
    recordFailure(request)
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
      recordFailure(request)
      return NextResponse.json({ error: "Invalid or inactive license key" }, { status: 400 })
    }

    if (keyRow.center_id != null && keyRow.center_id !== centerId) {
      recordFailure(request)
      return NextResponse.json({ error: "This key is already bound to another center" }, { status: 400 })
    }

    const actCount = await sql`
      SELECT COUNT(*) as c FROM license_activations WHERE license_key_id = ${keyRow.id}
    `
    const count = Number((actCount[0] as { c: string })?.c ?? 0)
    if (count >= keyRow.max_activations) {
      recordFailure(request)
      return NextResponse.json({ error: "License key has reached maximum activations" }, { status: 400 })
    }

    const existingActivation = await sql`
      SELECT id FROM license_activations
      WHERE license_key_id = ${keyRow.id} AND center_id = ${centerId}
      LIMIT 1
    `
    if (existingActivation.length > 0) {
      recordFailure(request)
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

    clearFailures(request)
    return NextResponse.json({
      success: true,
      message: "License activated successfully",
    })
  } catch (err) {
    recordFailure(request)
    console.error("Activation error:", err)
    return NextResponse.json(
      { error: "Activation failed" },
      { status: 500 }
    )
  }
}
