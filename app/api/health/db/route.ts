import { NextResponse } from "next/server"
import { checkDbConnection } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const result = await checkDbConnection()

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", db: "unreachable", master: "unreachable", detail: result.error },
      { status: 503 }
    )
  }

  return NextResponse.json(
    { status: "ok", db: "connected", master: "connected" },
    { status: 200 }
  )
}
