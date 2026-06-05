/**
 * GET /api/health/docker
 * Returns Docker status: "running" | "unknown".
 * When DOCKER_EXPECTED=1 we try to infer from DB connectivity (e.g. postgres on localhost);
 * otherwise we return "unknown" (we don't lie).
 */

import { NextResponse } from "next/server"
import { checkDbConnection } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  if (process.env.DOCKER_EXPECTED !== "1") {
    return NextResponse.json({ status: "unknown", reason: "DOCKER_EXPECTED not set" })
  }

  try {
    const db = await checkDbConnection()
    if (db.ok) {
      const url = process.env.DATABASE_URL ?? ""
      if (url.includes("localhost") || url.includes("127.0.0.1")) {
        return NextResponse.json({ status: "running", reason: "db_connected_local" })
      }
      return NextResponse.json({ status: "unknown", reason: "db_connected_remote" })
    }
  } catch (_) {}

  return NextResponse.json({ status: "unknown", reason: "db_unreachable" })
}
