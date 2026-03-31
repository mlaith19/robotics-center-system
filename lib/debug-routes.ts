import { NextResponse } from "next/server"

export function ensureDebugRouteAllowed(): Response | null {
  const enabled = process.env.ENABLE_DEBUG_ROUTES === "1"
  if (!enabled) {
    return NextResponse.json({ error: "Not available" }, { status: 404 })
  }
  return null
}
