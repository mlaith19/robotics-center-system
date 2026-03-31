import { NextResponse } from "next/server"
import { ensureDebugRouteAllowed } from "@/lib/debug-routes"

/** GET /api/_debug/ping — liveness probe */
export async function GET() {
  const blocked = ensureDebugRouteAllowed()
  if (blocked) return blocked
  return NextResponse.json({ status: "ok", time: Date.now(), env: process.env.NODE_ENV })
}
