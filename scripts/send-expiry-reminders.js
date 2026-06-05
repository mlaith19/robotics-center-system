#!/usr/bin/env node

/**
 * Phase 12: Subscription expiry reminder job.
 * Run via cron (e.g. daily). Sends reminders at 14, 7, 3, 1 days before and on expiry day.
 * Prevents duplicates using notification_logs (center_id, kind, target_date).
 */

const postgres = require("postgres")
const crypto = require("crypto")

const REMINDER_DAYS = [14, 7, 3, 1, 0]

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.MASTER_DATABASE_URL
  if (url && url.trim().length > 0) return url.trim()
  const host = process.env.DB_HOST || "localhost"
  const port = process.env.DB_PORT || "5432"
  const name = process.env.DB_NAME || "robotics"
  const user = process.env.DB_USER || "robotics"
  const pass = process.env.DB_PASS || "robotics"
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${encodeURIComponent(name)}`
}

function daysBetween(from, to) {
  const a = new Date(from)
  const b = new Date(to)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

async function main() {
  const sql = postgres(getDatabaseUrl(), { max: 1 })
  const today = new Date().toISOString().slice(0, 10)

  try {
    const subs = await sql`
      SELECT id, center_id, end_date
      FROM subscriptions
      WHERE end_date >= ${today}
      ORDER BY end_date ASC
    `
    let sent = 0
    for (const sub of subs) {
      const endDate = sub.end_date
      const daysLeft = daysBetween(today, endDate)
      if (!REMINDER_DAYS.includes(daysLeft)) continue

      const kind = daysLeft === 0 ? "expiry_0d" : `expiry_${daysLeft}d`
      const existing = await sql`
        SELECT id FROM notification_logs
        WHERE center_id = ${sub.center_id} AND kind = ${kind} AND target_date = ${endDate}
        LIMIT 1
      `
      if (existing.length > 0) continue

      const id = crypto.randomUUID()
      await sql`
        INSERT INTO notification_logs (id, center_id, kind, target_date, sent_at)
        VALUES (${id}, ${sub.center_id}, ${kind}, ${endDate}, now())
      `
      sent++
      console.log("Reminder logged:", { centerId: sub.center_id, kind, endDate })
    }
    console.log("Done. Reminders logged:", sent)
  } catch (err) {
    console.error("Reminder job failed:", err.message)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
