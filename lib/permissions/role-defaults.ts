/**
 * Role default permissions and merge helpers.
 * Adding new permissions in the future: add keys to UI + here; existing users keep their array.
 */

export type RoleKey = "student" | "teacher" | "admin" | "manager" | "staff" | "coordinator" | "secretary" | "other"

const DEFAULTS: Record<RoleKey, string[]> = {
  student: ["profile.read", "courses.read", "attendance.read", "payments.read", "settings.home"],
  teacher: ["profile.read", "courses.read", "attendance.read", "attendance.write", "schedule.view", "reports.view", "settings.home"],
  admin: ["nav.home", "nav.courses", "nav.students", "nav.teachers", "nav.attendance", "nav.cashier", "nav.reports", "nav.settings", "nav.users", "students.read", "students.write", "students.delete", "teachers.read", "teachers.write", "teachers.delete", "courses.read", "courses.write", "courses.delete", "attendance.read", "attendance.write", "payments.read", "payments.write", "profile.read", "profile.write", "reports.read", "settings.read", "settings.write", "users.read", "users.write", "users.delete"],
  manager: ["nav.home", "nav.courses", "nav.students", "nav.teachers", "nav.attendance", "nav.cashier", "nav.reports", "nav.settings", "nav.users", "students.read", "students.write", "teachers.read", "teachers.write", "courses.read", "courses.write", "attendance.read", "attendance.write", "payments.read", "payments.write", "reports.read", "settings.read", "settings.write", "users.read", "users.write"],
  staff: ["nav.home", "nav.courses", "nav.students", "nav.attendance", "nav.cashier", "profile.read", "courses.read", "students.read", "attendance.read", "payments.read", "settings.home"],
  coordinator: ["nav.home", "nav.courses", "nav.students", "nav.teachers", "nav.schools", "nav.gafan", "nav.attendance", "nav.schedule", "courses.read", "courses.write", "students.read", "students.write", "teachers.read", "schools.read", "schools.write", "gafan.read", "gafan.write", "attendance.read", "attendance.write", "schedule.read", "schedule.write", "reports.read", "settings.home"],
  secretary: ["nav.home", "nav.courses", "nav.students", "nav.teachers", "nav.registration", "nav.cashier", "nav.attendance", "nav.schedule", "courses.read", "courses.write", "students.read", "students.write", "teachers.read", "registration.read", "registration.send", "cashier.read", "cashier.income", "attendance.read", "attendance.write", "schedule.read", "reports.read", "settings.home"],
  other: ["settings.home"],
}

export function roleDefaults(roleKey: string): string[] {
  const key = (roleKey || "other").toLowerCase() as RoleKey
  return DEFAULTS[key] ?? DEFAULTS.other
}

export type MergeMode = "merge" | "replace"

export function mergeDefaults(
  existingPerms: string[],
  defaults: string[],
  mode: MergeMode
): string[] {
  if (mode === "replace") return [...defaults]
  const set = new Set(existingPerms)
  for (const p of defaults) set.add(p)
  return [...set]
}
