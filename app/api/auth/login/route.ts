import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import {
  isLoginRateLimited,
  getRemainingLockoutMs,
  recordLoginFailure,
  clearLoginFailure,
} from "@/lib/login-rate-limit"
import { buildTenantSessionCookie, purgeLegacyCookies, SESSION_ABSOLUTE_MS } from "@/lib/session-config"
import {
  logLoginAttempt,
  checkUserLocked,
  maybeLockUser,
  clearUserLock,
} from "@/lib/login-attempts"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { getPermissionsForRole, hasFullAccessRole, type RoleType } from "@/lib/permissions"

const ACCOUNT_LOCKED = "החשבון ננעל לאחר ניסיונות כושלים. נסה שוב מאוחר יותר."

const LOGIN_ERRORS = {
  user_not_found:
    "לא נמצא משתמש עם שם המשתמש או האימייל שהזנת. בדוק איות או פנה למנהל — בדף 'משתמשים' מופיעה עמודת 'שם משתמש' לכניסה.",
  invalid_password: "שם משתמש או סיסמה שגויים",
  no_password:
    "לחשבון זה לא הוגדרה סיסמה. פנה למנהל המערכת להגדרת סיסמה או איפוס.",
  rate_limited: "ננעלת לאחר ניסיונות כושלים רבים. המתן דקה ונסה שוב.",
  user_inactive: "המשתמש מושבת. פנה למנהל.",
} as const

export async function POST(request: NextRequest) {
  console.log("[AUTH] login start")

  if (isLoginRateLimited(request)) {
    const remaining = Math.ceil(getRemainingLockoutMs(request) / 1000)
    return NextResponse.json(
      {
        error: `${LOGIN_ERRORS.rate_limited} (נסה שוב בעוד ${remaining} שניות)`,
        reason: "rate_limited",
        retryAfterSeconds: remaining,
      },
      { status: 429 }
    )
  }

  const [tenant, tenantErr] = await requireTenant(request)
  if (tenantErr) {
    const body = await tenantErr.json().catch(() => ({}))
    return NextResponse.json(
      { error: "TENANT_NOT_RESOLVED", reason: (body as { reason?: string }).reason ?? "NO_SUBDOMAIN", host: (body as { host?: string }).host },
      { status: 400 }
    )
  }

  const { centerId, subdomain: centerSlug, centerName, db } = tenant
  const tenantDbName = tenant.tenantDbUrl?.split("/").pop() ?? "tenant"

  let username: string | undefined
  let password: string | undefined

  try {
    const body = await request.json()
    username = body.username
    password = body.password

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "שם משתמש וסיסמה נדרשים" }, { status: 400 })
    }
    username = username.trim()
    if (!username) {
      return NextResponse.json({ error: "שם משתמש וסיסמה נדרשים" }, { status: 400 })
    }

    let users = await db`
      SELECT u.id, u.username, u.name, u.email, u.password, u."roleId",
             u.status, u.role as user_role_text,
             u.permissions,
             u."force_password_reset", u."locked_until",
             r.name as role_name, r.key as role_key
      FROM "User" u
      LEFT JOIN "Role" r ON u."roleId" = r.id
      WHERE (u.username = ${username} OR u.email = ${username})
    `
    if (users.length === 0) {
      const byName = await db`
        SELECT u.id, u.username, u.name, u.email, u.password, u."roleId",
               u.status, u.role as user_role_text,
               u.permissions,
               u."force_password_reset", u."locked_until",
               r.name as role_name, r.key as role_key
        FROM "User" u
        LEFT JOIN "Role" r ON u."roleId" = r.id
        WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(${username}))
      `
      if (byName.length === 1) users = byName
    }

    console.log(`[AUTH] centerId=${centerId} db=${tenantDbName} username="${username}" users_found=${users.length}`)

    if (users.length === 0) {
      console.log(`[AUTH] FAIL=USER_NOT_FOUND username="${username}" db=${tenantDbName}`)
      await logLoginAttempt(request, null, username, false, db)
      recordLoginFailure(request)
      // Do not reveal whether the user exists — return the same error as wrong password
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS", reason: "invalid_credentials", message: LOGIN_ERRORS.invalid_password },
        { status: 401 }
      )
    }

    const user = users[0] as {
      password?: string | null
      id: string
      force_password_reset?: boolean | null
      locked_until?: string | null
      [k: string]: unknown
    }

    if ((user as { status?: string }).status !== "active") {
      console.log(`[AUTH] FAIL=USER_INACTIVE username="${username}"`)
      return NextResponse.json(
        { error: "USER_INACTIVE", reason: "user_inactive", message: LOGIN_ERRORS.user_inactive },
        { status: 403 }
      )
    }

    const locked = await checkUserLocked(user.id, db)
    if (locked.locked) {
      console.log(`[AUTH] FAIL=USER_LOCKED username="${username}"`)
      await logLoginAttempt(request, user.id, username, false, db)
      return NextResponse.json({ error: "ACCOUNT_LOCKED", reason: "user_locked", message: ACCOUNT_LOCKED }, { status: 423 })
    }

    let storedHash = user.password

    // Dev-only convenience: auto-set hash for 'admin' / 'admin123' if password missing
    if (
      (!storedHash || typeof storedHash !== "string") &&
      process.env.NODE_ENV !== "production" &&
      username === "admin" &&
      password === "admin123"
    ) {
      storedHash = await bcrypt.hash("admin123", 10)
      await db`UPDATE "User" SET password = ${storedHash} WHERE id = ${user.id}`
    }

    if (!storedHash || typeof storedHash !== "string") {
      console.log(`[AUTH] FAIL=NO_PASSWORD_HASH username="${username}"`)
      await logLoginAttempt(request, user.id, username, false, db)
      recordLoginFailure(request)
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS", reason: "no_password", message: LOGIN_ERRORS.no_password },
        { status: 401 }
      )
    }

    const passwordValid = await bcrypt.compare(password, storedHash)
    if (!passwordValid) {
      console.log(`[AUTH] FAIL=INVALID_PASSWORD username="${username}" db=${tenantDbName}`)
      await logLoginAttempt(request, user.id, username, false, db)
      await maybeLockUser(user.id, db)
      recordLoginFailure(request)
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS", reason: "invalid_password", message: LOGIN_ERRORS.invalid_password },
        { status: 401 }
      )
    }

    console.log(`[AUTH] SUCCESS username="${username}" centerId=${centerId} db=${tenantDbName}`)

    await clearUserLock(user.id, db)
    await logLoginAttempt(request, user.id, username, true, db)
    clearLoginFailure(request)

    let permissions: string[] = []
    if (user.permissions != null) {
      let p = user.permissions as unknown
      if (typeof p === "string") {
        try {
          p = JSON.parse(p) as unknown
        } catch { /* leave p as is */ }
      }
      if (Array.isArray(p)) {
        permissions = [...new Set(p.filter((x): x is string => typeof x === "string"))]
        if (permissions.length > 0) {
          console.log(`[AUTH] using ${permissions.length} permissions from User.permissions (DB)`)
        }
      }
    }
    if (permissions.length === 0 && user.roleId) {
      try {
        const permRows = await db`
          SELECT p.key FROM "Permission" p
          JOIN "RolePermission" rp ON p.id = rp."permissionId"
          WHERE rp."roleId" = ${user.roleId}
        `
        const fromRole = (permRows as { key: string }[]).map((r) => r.key)
        permissions = [...new Set(fromRole)]
      } catch { /* keep empty */ }
    }

    const rawKey = (user.role_key ?? user.role_name ?? user.user_role_text ?? (user as { roleKey?: string }).roleKey ?? "").toString().trim()
    const roleKeyMap: Record<string, string> = {
      מורה: "teacher", תלמיד: "student", מנהל: "admin",
      אדמין: "admin", מזכירה: "secretary", רכז: "coordinator",
    }
    let roleKey = roleKeyMap[rawKey] ?? (rawKey ? rawKey.toLowerCase() : "")

    // If role is still unknown, infer from context: provisioned admin or single-user center
    if (!roleKey || roleKey === "user" || roleKey === "other") {
      const uname = String(user.username ?? "").toLowerCase()
      if (uname.endsWith("_admin") || uname === "admin") {
        roleKey = "admin"
      }
    }
    if (!roleKey) roleKey = "other"

    // If DB permissions are empty, populate from role preset so sidebar + guards work immediately
    if (permissions.length === 0 && roleKey) {
      const roleDefaults = getPermissionsForRole(roleKey as RoleType)
      if (roleDefaults.length > 0) {
        permissions = [...roleDefaults]
        console.log(`[AUTH] permissions empty, filled from role preset "${roleKey}" (${permissions.length} perms)`)
      }
    }
    if (hasFullAccessRole(roleKey) || hasFullAccessRole(user.role_name) || hasFullAccessRole(user.user_role_text)) {
      // Full-access users do not require storing explicit permissions in cookie.
      // This keeps Set-Cookie header small and avoids upstream header-size failures.
      permissions = []
    }

    const resolvedRole = (user.role_name || user.user_role_text || (user as Record<string,unknown>).role || roleKey || "user") as string

    const now = new Date().toISOString()
    const sessionPayload = {
      id: user.id,
      username: user.username,
      full_name: user.name,
      role: resolvedRole,
      roleKey,
      roleId: user.roleId,
      permissions,
      centerId,
      centerSlug,
      centerName,
      loginTime: now,
      lastActivity: now,
    }

    const cookie = await buildTenantSessionCookie(
      JSON.stringify(sessionPayload),
      Math.floor(SESSION_ABSOLUTE_MS / 1000)
    )
    const requiresPasswordReset = user.force_password_reset === true

    console.log(`auth:login ok username="${username}" role="${resolvedRole}" center="${centerSlug}"`)

    const response = NextResponse.json({
      ok: true,
      userId: user.id,
      id: user.id,
      username: user.username,
      fullName: user.name,
      email: user.email,
      role: resolvedRole,
      roleKey,
      roleId: user.roleId,
      permissions,
      loginTime: now,
      requiresPasswordReset,
      centerId,
      centerSlug,
      centerName,
    })
    response.headers.append("Set-Cookie", cookie)

    // Set tenant-id cookie so future API calls don't need ?center= param
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
    const tenantIdCookie = `tenant-id=${centerId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_ABSOLUTE_MS / 1000)}${secure}`
    response.headers.append("Set-Cookie", tenantIdCookie)

    // Purge legacy robotics-session so it can never interfere
    purgeLegacyCookies(response)
    return response

  } catch (error: unknown) {
    const err = error as { cause?: { code?: string }; code?: string; message?: string }
    const cause = err?.cause?.code ?? err?.code
    const msg = String(err?.message ?? "")
    const missingSessionSecret = msg.includes("SESSION_SECRET must be set in production")
    const isConnectionError =
      cause === "ECONNREFUSED" ||
      msg.includes("fetch failed") ||
      msg.includes("connecting to database") ||
      msg.includes("NeonDbError")

    if (missingSessionSecret) {
      return NextResponse.json(
        {
          error: "SERVER_MISCONFIG",
          reason: "missing_session_secret",
          message: "הגדרת אבטחה חסרה בשרת: SESSION_SECRET. יש להגדיר משתנה סביבה ולהפעיל מחדש את השרת.",
        },
        { status: 500 }
      )
    }

    if (isConnectionError) {
      return NextResponse.json(
        { error: "המערכת אינה זמינה כרגע. נסה שוב מאוחר יותר." },
        { status: 503 }
      )
    }

    console.error("[LOGIN] Unexpected error:", error)
    return NextResponse.json({ error: "שגיאה בהתחברות" }, { status: 500 })
  }
}
