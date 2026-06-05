import { NextResponse } from "next/server"
import { clearMasterSessionCookie, purgeLegacyCookies } from "@/lib/session-config"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.headers.set("Set-Cookie", clearMasterSessionCookie())
  purgeLegacyCookies(res)
  return res
}
