import { NextRequest, NextResponse } from "next/server"
import { requireMaster } from "@/lib/master-auth"
import {
  buildMasterSessionCookie,
  purgeLegacyCookies,
  MASTER_SESSION_ABSOLUTE_MS,
} from "@/lib/session-config"

export async function GET(req: NextRequest) {
  const [session, errRes] = await requireMaster(req)
  if (errRes) return errRes

  // Refresh lastActivity so the master session stays alive while in use
  const refreshed = { ...session, lastActivity: new Date().toISOString() }
  const cookie = await buildMasterSessionCookie(
    JSON.stringify(refreshed),
    Math.floor(MASTER_SESSION_ABSOLUTE_MS / 1000)
  )

  const response = NextResponse.json({
    id:       session.id,
    username: session.username,
    email:    session.email,
    role:     session.role,
  })
  response.headers.set("Set-Cookie", cookie)
  purgeLegacyCookies(response)
  return response
}
