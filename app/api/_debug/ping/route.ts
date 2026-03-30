import { NextResponse } from "next/server"

/** GET /api/_debug/ping — liveness probe */
export async function GET() {
  return NextResponse.json({ status: "ok", time: Date.now(), env: process.env.NODE_ENV })
}
