import { NextResponse } from "next/server"
import { clearTenantSessionCookie, purgeLegacyCookies } from "@/lib/session-config"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.headers.set("Set-Cookie", clearTenantSessionCookie())
  purgeLegacyCookies(res)
  return res
}

export async function GET() {
  const res = NextResponse.json({ ok: true })
  res.headers.set("Set-Cookie", clearTenantSessionCookie())
  purgeLegacyCookies(res)
  return res
}
