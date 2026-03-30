/**
 * Phase 6: Log login attempts and enforce per-user lockout.
 * All functions accept an optional db client so tenant APIs can pass
 * the correct tenant DB instead of the shared master DB.
 */

import { sql as masterSql } from "@/lib/db"
import { randomUUID } from "crypto"
import type postgres from "postgres"

type DbClient = ReturnType<typeof postgres>

const FAILURE_THRESHOLD = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

export async function logLoginAttempt(
  req: Request,
  userId: string | null,
  username: string,
  success: boolean,
  db: DbClient = masterSql as unknown as DbClient
): Promise<void> {
  const ip = getClientIp(req)
  try {
    await (db as unknown as typeof masterSql)`
      INSERT INTO login_attempts (id, user_id, username, success, ip_address, created_at)
      VALUES (${randomUUID()}, ${userId}, ${username}, ${success}, ${ip}, now())
    `
  } catch (_) {
    // Table may not exist before Phase 6 migration
  }
}

export async function checkUserLocked(
  userId: string,
  db: DbClient = masterSql as unknown as DbClient
): Promise<{ locked: boolean; lockedUntil?: Date }> {
  try {
    const rows = await (db as unknown as typeof masterSql)`
      SELECT "locked_until" FROM "User" WHERE id = ${userId} LIMIT 1
    `
    const row = rows[0] as { locked_until?: Date | null } | undefined
    const lockedUntil = row?.locked_until
    if (!lockedUntil) return { locked: false }
    const until = new Date(lockedUntil).getTime()
    if (Date.now() < until) return { locked: true, lockedUntil: new Date(until) }
    await (db as unknown as typeof masterSql)`UPDATE "User" SET "locked_until" = NULL WHERE id = ${userId}`
    return { locked: false }
  } catch (_) {
    return { locked: false }
  }
}

export async function maybeLockUser(
  userId: string,
  db: DbClient = masterSql as unknown as DbClient
): Promise<void> {
  try {
    const since = new Date(Date.now() - LOCKOUT_MS).toISOString()
    const failed = await (db as unknown as typeof masterSql)`
      SELECT COUNT(*) as c FROM login_attempts
      WHERE user_id = ${userId} AND success = false AND created_at > ${since}
    `
    const count = Number((failed[0] as { c: string })?.c ?? 0)
    if (count >= FAILURE_THRESHOLD) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString()
      await (db as unknown as typeof masterSql)`UPDATE "User" SET "locked_until" = ${lockedUntil} WHERE id = ${userId}`
    }
  } catch (_) {
    // login_attempts table or locked_until column may not exist yet
  }
}

export async function clearUserLock(
  userId: string,
  db: DbClient = masterSql as unknown as DbClient
): Promise<void> {
  try {
    await (db as unknown as typeof masterSql)`UPDATE "User" SET "locked_until" = NULL WHERE id = ${userId}`
  } catch (_) {
    // locked_until column may not exist yet
  }
}
