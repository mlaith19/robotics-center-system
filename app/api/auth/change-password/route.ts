import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { validatePassword } from "@/lib/password-policy"
import { getRequestDb } from "@/lib/get-request-db"
import { withTenantAuth } from "@/lib/tenant-api-auth"

export const dynamic = "force-dynamic"

export const POST = withTenantAuth(async (request: NextRequest, session) => {
  try {
    const body = await request.json()
    const currentPassword = body?.currentPassword
    const newPassword     = body?.newPassword

    if (typeof currentPassword !== "string" || !currentPassword.trim()) {
      return NextResponse.json({ error: "סיסמה נוכחית נדרשת" }, { status: 400 })
    }
    if (typeof newPassword !== "string" || !newPassword.trim()) {
      return NextResponse.json({ error: "סיסמה חדשה נדרשת" }, { status: 400 })
    }

    const policy = validatePassword(newPassword)
    if (!policy.valid) {
      return NextResponse.json({ error: policy.error }, { status: 400 })
    }

    const db = await getRequestDb(request)

    const users = await db`SELECT id, password FROM "User" WHERE id = ${session.id} LIMIT 1`
    const user  = users[0] as { id: string; password: string | null } | undefined
    if (!user) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 })
    if (!user.password) return NextResponse.json({ error: "סיסמה נוכחית שגויה" }, { status: 401 })

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return NextResponse.json({ error: "סיסמה נוכחית שגויה" }, { status: 401 })

    const hashed = await bcrypt.hash(newPassword.trim(), 10)
    await db`
      UPDATE "User"
      SET password = ${hashed}, "force_password_reset" = false, "updatedAt" = now()
      WHERE id = ${session.id}
    `
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("Change password error:", e)
    return NextResponse.json({ error: "שגיאה בעדכון סיסמה" }, { status: 500 })
  }
})
