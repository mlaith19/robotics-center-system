import { NextResponse } from "next/server"
import { checkDbConnection } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const result = await checkDbConnection()
  const isProd = process.env.NODE_ENV === "production"

  if (!result.ok) {
    return NextResponse.json(
      isProd
        ? { status: "error", db: "unreachable", master: "unreachable" }
        : { status: "error", db: "unreachable", master: "unreachable", detail: result.error },
      { status: 503 }
    )
  }

  return NextResponse.json(
    { status: "ok", db: "connected", master: "connected" },
    { status: 200 }
  )
}
