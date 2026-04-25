/**
 * Reports: auth, RBAC, and plan feature gating (Phase 10).
 */

import type { SessionUser } from "./auth-server"
import { requireFeatureFromRequest } from "./feature-gate"

export type ReportCategory = "operational" | "finance" | "schools" | "gefen" | "system"

/** Report types that can be passed to requireReportAccess */
export type ReportType =
  | "students"
  | "teachers"
  | "courses"
  | "finance/revenue"
  | "finance/debts"
  | "finance/teacher-debts"
  | "schools/summary"
  | "gefen/utilization"

/** Later: license/tenant write access. Reports are read-only; hook for consistency. */
export function requireLicenseReadAccess(): { allowed: true } | { allowed: false; reason: string } {
  return { allowed: true }
}

// ---------- RBAC for reports ----------

/** Admin (super_admin or role admin): full access to all reports. */
function isAdminCenter(session: SessionUser): boolean {
  if (session.roleKey === "super_admin") return true
  const r = (session.role || "").toLowerCase()
  return r === "admin" || r === "administrator" || r === "אדמין" || r === "מנהל"
}

/** Finance manager: finance reports + view operational. Map secretary/coordinator as having reports.view. */
function canAccessFinance(session: SessionUser): boolean {
  if (isAdminCenter(session)) return true
  const perms = session.permissions || []
  return perms.includes("reports.view") && (perms.includes("cashier.view") || perms.includes("reports.export"))
}

/** Teacher: only operational reports, scoped to own courses (enforced by passing teacherId filter). */
function isTeacherRole(session: SessionUser): boolean {
  const r = (session.role || "").toLowerCase()
  return r === "teacher" || r === "מורה"
}

/**
 * Returns null if allowed, or a 403 Response if not.
 * Checks plan feature "reports" then RBAC.
 * For teacher: caller must scope data by teacherId (from Teacher.userId = session.id).
 */
export async function requireReportAccess(
  req: Request,
  session: SessionUser,
  reportType: ReportType
): Promise<Response | null> {
  const featureErr = await requireFeatureFromRequest(req, "reports")
  if (featureErr) return featureErr

  if (isAdminCenter(session)) return null

  switch (reportType) {
    case "students":
    case "teachers":
    case "courses":
      if (session.permissions?.includes("reports.view")) return null
      if (isTeacherRole(session)) return null
      break
    case "finance/revenue":
    case "finance/debts":
    case "finance/teacher-debts":
      if (canAccessFinance(session)) return null
      break
    case "schools/summary":
      if (session.permissions?.includes("reports.view") || session.permissions?.includes("schools.view")) return null
      break
    case "gefen/utilization":
      if (session.permissions?.includes("reports.view") || session.permissions?.includes("gafan.view")) return null
      break
    default:
      break
  }

  return new Response(JSON.stringify({ error: "errors.forbiddenReport" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
}

/** If user is a teacher, resolve their Teacher id for scoping. Returns null if not a teacher or not found. */
export async function getTeacherIdForUser(userId: string): Promise<string | null> {
  const { sql } = await import("@/lib/db")
  const rows = await sql`
    SELECT id FROM "Teacher" WHERE "userId" = ${userId} LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as { id: string }).id : null
}
