import { NextResponse } from "next/server"

/**
 * GET /api/_debug/cookies
 *
 * Returns cookie names present in the request.
 * Never returns cookie values — only names + safe metadata.
 * Blocked in production.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  const raw = req.headers.get("cookie") ?? ""

  const parsed = raw
    ? raw.split(";").map((c) => {
        const [name, ...rest] = c.trim().split("=")
        const value = rest.join("=")
        const len = value.length
        const preview = len === 0
          ? "(empty)"
          : len <= 12
          ? "*".repeat(len)
          : `${value.slice(0, 6)}…${value.slice(-4)}`
        return { name: name.trim(), length: len, preview }
      })
    : []

  const cookieNames = parsed.map((c) => c.name)

  return NextResponse.json({
    cookieNames,
    hasTenantSession: cookieNames.includes("tenant-session"),
    hasMasterSession: cookieNames.includes("master-session"),
    hasLegacySession: cookieNames.includes("robotics-session"),
    count: parsed.length,
    cookies: parsed,
  })
}
