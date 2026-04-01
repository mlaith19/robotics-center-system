export type PermissionCategory = {
  id: string
  name: string
  color: string
  permissions: Permission[]
}

export type Permission = {
  id: string
  name: string
  description: string
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "courses",
    name: "קורסים",
    color: "blue",
    permissions: [
      { id: "nav.courses", name: "הצגה בסרגל", description: "הצגת דף קורסים בסרגל הצדדי" },
      { id: "courses.view", name: "כפתור צפה", description: "הצגת כפתור צפה בכרטיס קורס – צפייה בפרטי קורס" },
      { id: "courses.financial", name: "מידע כספי בקורסים", description: "צפייה במחירים, תשלומים והיסטוריית גבייה בדפי קורסים" },
      { id: "courses.edit", name: "כפתור עריכה", description: "הצגת כפתור עריכה – יצירה ועריכת קורסים" },
      { id: "courses.delete", name: "כפתור מחיקה", description: "הצגת כפתור מחיקה – מחיקת קורסים" },
      { id: "courses.tab.general", name: "טאב כללי", description: "הצגת טאב כללי בדף פרטי קורס" },
      { id: "courses.tab.students", name: "טאב ילדים משויכים", description: "הצגת טאב ילדים משויכים בדף פרטי קורס" },
      { id: "courses.tab.payments", name: "טאב עלות ותשלומים", description: "הצגת טאב עלות ותשלומים בדף פרטי קורס" },
      { id: "courses.tab.attendance.students", name: "טאב נוכחות תלמיד", description: "הצגת טאב נוכחות תלמידים בדף פרטי קורס" },
      { id: "courses.tab.attendance.teachers", name: "טאב נוכחות מורה", description: "הצגת טאב נוכחות מורים בדף פרטי קורס" },
    ],
  },
  {
    id: "students",
    name: "תלמידים",
    color: "pink",
    permissions: [
      { id: "nav.students", name: "הצגה בסרגל", description: "הצגת דף תלמידים בסרגל הצדדי" },
      { id: "students.view", name: "כפתור צפה", description: "הצגת כפתור צפה בכרטיס תלמיד – צפייה בפרטי תלמיד" },
      { id: "students.financial", name: "מידע כספי לתלמידים", description: "צפייה בתשלומים, חובות, מחירים והיסטוריית תשלומים בדף תלמיד" },
      { id: "students.edit", name: "כפתור עריכה", description: "הצגת כפתור עריכה – יצירה ועריכת תלמידים" },
      { id: "students.delete", name: "כפתור מחיקה", description: "הצגת כפתור מחיקה – מחיקת תלמידים" },
      { id: "students.tab.profile", name: "טאב פרופיל", description: "הצגת טאב פרופיל בדף פרטי תלמיד" },
      { id: "students.tab.general", name: "טאב כללי", description: "הצגת טאב כללי בדף פרטי תלמיד" },
      { id: "students.tab.courses", name: "טאב קורסים", description: "הצגת טאב קורסים בדף פרטי תלמיד" },
      { id: "students.tab.payments", name: "טאב תשלומים", description: "הצגת טאב תשלומים בדף פרטי תלמיד" },
      { id: "students.tab.attendance", name: "טאב נוכחות", description: "הצגת טאב נוכחות בדף פרטי תלמיד" },
    ],
  },
  {
    id: "schools",
    name: "בתי ספר",
    color: "orange",
    permissions: [
      { id: "nav.schools", name: "הצגה בסרגל", description: "הצגת דף בתי ספר בסרגל הצדדי" },
      { id: "schools.view", name: "צפייה בבתי ספר", description: "צפייה ברשימת בתי ספר" },
      { id: "schools.edit", name: "עריכת בתי ספר", description: "יצירה ועריכת בתי ספר" },
      { id: "schools.delete", name: "מחיקת בתי ספר", description: "מחיקת בתי ספר" },
    ],
  },
  {
    id: "teachers",
    name: "מורים",
    color: "green",
    permissions: [
      { id: "nav.teachers", name: "הצגה בסרגל", description: "הצגת דף מורים בסרגל הצדדי" },
      { id: "teachers.view", name: "כפתור צפה", description: "הצגת כפתור צפה – צפייה בפרטי מורה" },
      { id: "teachers.edit", name: "כפתור עריכה", description: "הצגת כפתור עריכה – יצירה ועריכת מורים" },
      { id: "teachers.delete", name: "כפתור מחיקה", description: "הצגת כפתור מחיקה – מחיקת מורים" },
      { id: "teachers.tab.general", name: "טאב כללי", description: "הצגת טאב כללי בדף פרטי מורה" },
      { id: "teachers.tab.courses", name: "טאב קורסים", description: "הצגת טאב קורסים בדף פרטי מורה" },
      { id: "teachers.tab.payments", name: "טאב תשלומים", description: "הצגת טאב תשלומים בדף פרטי מורה" },
      { id: "teachers.tab.attendance", name: "טאב נוכחות", description: "הצגת טאב נוכחות בדף פרטי מורה" },
      { id: "teachers.financial", name: "תעריפי שכר מורים", description: "צפייה בתעריף לפי קורס (פרופיל מהגדרות) כשצופים בפרופיל מורה אחר" },
    ],
  },
  {
    id: "registration",
    name: "רישום",
    color: "cyan",
    permissions: [
      { id: "nav.registration", name: "הצגה בסרגל", description: "הצגת דף רישום בסרגל הצדדי" },
      { id: "registration.view", name: "צפייה ברישומים", description: "צפייה ברשימת רישומים" },
      { id: "registration.send", name: "שליחת טופס רישום", description: "שליחת טופס רישום" },
    ],
  },
  {
    id: "gafan",
    name: 'תוכנית גפ"ן',
    color: "rose",
    permissions: [
      { id: "nav.gafan", name: "הצגה בסרגל", description: 'הצגת דף גפ"ן בסרגל הצדדי' },
      { id: "gafan.view", name: 'צפייה בתוכניות גפ"ן', description: 'צפייה ברשימת תוכניות גפ"ן' },
      { id: "gafan.edit", name: 'עריכת תוכניות גפ"ן', description: 'יצירה ועריכת תוכניות גפ"ן' },
      { id: "gafan.delete", name: 'מחיקת תוכניות גפ"ן', description: 'מחיקת תוכניות גפ"ן' },
    ],
  },
  {
    id: "reports",
    name: "דוחות",
    color: "yellow",
    permissions: [
      { id: "nav.reports", name: "הצגה בסרגל", description: "הצגת דף דוחות בסרגל הצדדי" },
      { id: "reports.view", name: "צפייה בדוחות", description: "צפייה בדוחות" },
      { id: "reports.export", name: "ייצוא דוחות", description: "ייצוא דוחות לקבצים" },
    ],
  },
  {
    id: "cashier",
    name: "קופה",
    color: "emerald",
    permissions: [
      { id: "nav.cashier", name: "הצגה בסרגל", description: "הצגת דף קופה בסרגל הצדדי" },
      { id: "cashier.view", name: "צפייה בקופה", description: "צפייה בהכנסות והוצאות" },
      { id: "cashier.income", name: "הוספת הכנסה", description: "רישום הכנסות" },
      { id: "cashier.expense", name: "הוספת הוצאה", description: "רישום הוצאות" },
      { id: "cashier.delete", name: "מחיקת תנועות", description: "מחיקת הכנסות והוצאות" },
      { id: "cashier.discount", name: "הנחה (תשלומים)", description: "הוספת הנחה לתלמיד בדף תלמיד" },
      { id: "cashier.credit", name: "זיכוי (תשלומים)", description: "הוספת זיכוי לתלמיד בדף תלמיד" },
      { id: "cashier.siblingDiscount", name: "הנחת אחים", description: "הפעלת חבילת הנחת אחים על חיובי תלמיד" },
    ],
  },
  {
    id: "schedule",
    name: "לוח זמנים",
    color: "sky",
    permissions: [
      { id: "nav.schedule", name: "הצגה בסרגל", description: "הצגת דף לוח זמנים בסרגל הצדדי" },
      { id: "schedule.view", name: "צפייה בלוח זמנים", description: "צפייה בלוח זמנים" },
      { id: "schedule.edit", name: "עריכת לוח זמנים", description: "עדכון לוח זמנים" },
    ],
  },
  {
    id: "attendance",
    name: "נוכחות",
    color: "purple",
    permissions: [
      { id: "nav.attendance", name: "הצגה בסרגל", description: "הצגת דף נוכחות בסרגל הצדדי" },
      { id: "attendance.view", name: "צפייה בנוכחות", description: "צפייה בנוכחות תלמידים" },
      { id: "attendance.edit", name: "עריכת נוכחות", description: "עדכון נוכחות תלמידים ומורים" },
    ],
  },
  {
    id: "settings",
    name: "הגדרות",
    color: "slate",
    permissions: [
      { id: "nav.settings", name: "הצגה בסרגל", description: "הצגת דף הגדרות בסרגל הצדדי" },
      { id: "settings.home", name: "דף הבית", description: "הצגת דף הבית בסרגל (במקום הפרופיל שלי – בורר אחד משניהם)" },
      { id: "settings.view", name: "צפייה בהגדרות", description: "צפייה בהגדרות המערכת" },
      { id: "settings.edit", name: "עריכת הגדרות", description: "עדכון הגדרות המערכת" },
    ],
  },
  {
    id: "users",
    name: "משתמשים",
    color: "indigo",
    permissions: [
      { id: "nav.users", name: "הצגה בסרגל", description: "הצגת דף משתמשים בסרגל הצדדי" },
      { id: "users.view", name: "צפייה במשתמשים", description: "צפייה ברשימת משתמשים" },
      { id: "users.edit", name: "עריכת משתמשים", description: "יצירה ועריכת משתמשים" },
      { id: "users.delete", name: "מחיקת משתמשים", description: "מחיקת משתמשים" },
    ],
  },
  {
    id: "myProfile",
    name: "הפרופיל שלי",
    color: "violet",
    permissions: [
      { id: "nav.myProfile", name: "הצגה בסרגל", description: "הצגת הפרופיל שלי בסרגל הצדדי (במקום דף הבית – בורר אחד משניהם)" },
      { id: "myProfile.tab.profile", name: "טאב פרופיל", description: "הצגת טאב פרופיל בדף הפרופיל שלי (תלמיד)" },
      { id: "myProfile.tab.general", name: "טאב כללי", description: "הצגת טאב כללי בפרופיל שלי" },
      { id: "myProfile.tab.courses", name: "טאב קורסים", description: "הצגת טאב קורסים בפרופיל שלי" },
      { id: "myProfile.tab.payments", name: "טאב תשלומים", description: "הצגת טאב תשלומים בפרופיל שלי" },
      { id: "myProfile.tab.attendance", name: "טאב נוכחות", description: "הצגת טאב נוכחות בפרופיל שלי" },
    ],
  },
]

export function getAllPermissions(): Permission[] {
  return PERMISSION_CATEGORIES.flatMap((cat) => cat.permissions)
}

export function getAllNavPermissions(): string[] {
  return PERMISSION_CATEGORIES.map((cat) => cat.permissions.find((p) => p.id.startsWith("nav."))?.id).filter(Boolean) as string[]
}

function permissionVariants(permission: string): string[] {
  const p = (permission || "").trim()
  if (!p) return []
  const dot = p.replace(/-/g, ".")
  const dash = p.replace(/\./g, "-")
  return [...new Set([p, dot, dash])]
}

export function hasPermission(userPermissions: string[], permission: string): boolean {
  if (!Array.isArray(userPermissions) || !permission) return false
  const perms = new Set((userPermissions || []).map((x) => String(x).trim()).filter(Boolean))
  return permissionVariants(permission).some((v) => perms.has(v))
}

export type RoleType = "admin" | "secretary" | "teacher" | "student" | "coordinator" | "other"

export interface RolePreset {
  id: RoleType
  name: string
  description: string
  permissions: string[]
  visiblePages: string[]
}

const ALL_NAV = [
  "nav.courses", "nav.students", "nav.schools", "nav.teachers",
  "nav.registration", "nav.gafan", "nav.users", "nav.cashier",
  "nav.reports", "nav.attendance", "nav.schedule", "nav.settings",
]

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: "admin",
    name: "מנהל",
    description: "גישה מלאה לכל המערכת",
    permissions: getAllPermissions().map((p) => p.id),
    visiblePages: [
      "/dashboard", "/dashboard/registration", "/dashboard/courses",
      "/dashboard/students", "/dashboard/teachers", "/dashboard/schools",
      "/dashboard/gafan", "/dashboard/users", "/dashboard/cashier",
      "/dashboard/reports", "/dashboard/attendance", "/dashboard/schedule",
      "/dashboard/settings",
    ],
  },
  {
    id: "secretary",
    name: "מזכירה",
    description: "צפייה בכל + עריכת תלמידים וקורסים",
    permissions: [
      "nav.courses", "nav.students", "nav.schools", "nav.teachers",
      "nav.registration", "nav.gafan", "nav.cashier", "nav.reports",
      "nav.attendance", "nav.schedule",
      "courses.view", "courses.edit",
      "courses.tab.general", "courses.tab.students", "courses.tab.payments", "courses.tab.attendance.students", "courses.tab.attendance.teachers",
      "students.view", "students.edit", "students.financial",
      "students.tab.profile", "students.tab.general", "students.tab.courses", "students.tab.payments", "students.tab.attendance",
      "schools.view",
      "teachers.view", "teachers.financial",
      "teachers.tab.general", "teachers.tab.courses", "teachers.tab.payments", "teachers.tab.attendance",
      "registration.view", "registration.send",
      "gafan.view",
      "reports.view",
      "cashier.view", "cashier.income", "cashier.discount", "cashier.credit",
      "schedule.view",
      "attendance.view", "attendance.edit",
      "settings.home",
    ],
    visiblePages: [
      "/dashboard", "/dashboard/registration", "/dashboard/courses",
      "/dashboard/students", "/dashboard/teachers", "/dashboard/schools",
      "/dashboard/gafan", "/dashboard/cashier", "/dashboard/reports",
      "/dashboard/attendance", "/dashboard/schedule",
    ],
  },
  {
    id: "teacher",
    name: "מורה",
    description: "צפייה בקורסים שלו, נוכחות, לוח זמנים ודוחות",
    permissions: [
      "nav.courses", "nav.students", "nav.teachers",
      "nav.reports", "nav.attendance", "nav.schedule",
      "courses.view", "courses.tab.general", "courses.tab.students", "courses.tab.attendance.students", "courses.tab.attendance.teachers",
      "students.view", "students.tab.profile", "students.tab.attendance",
      "teachers.view", "teachers.tab.general", "teachers.tab.courses", "teachers.tab.payments", "teachers.tab.attendance",
      "nav.myProfile",
      "myProfile.tab.general", "myProfile.tab.courses", "myProfile.tab.payments", "myProfile.tab.attendance",
      "schedule.view",
      "attendance.view", "attendance.edit",
      "reports.view",
    ],
    visiblePages: [
      "/dashboard", "/dashboard/courses", "/dashboard/students",
      "/dashboard/teachers", "/dashboard/reports",
      "/dashboard/attendance", "/dashboard/schedule",
    ],
  },
  {
    id: "student",
    name: "תלמיד",
    description: "צפייה בפרטים האישיים בלבד",
    permissions: [
      "nav.courses", "nav.students", "nav.schedule",
      "nav.myProfile",
      "schedule.view",
      "courses.view", "courses.tab.general",
      "students.view", "students.tab.profile",
      "myProfile.tab.profile", "myProfile.tab.attendance",
    ],
    visiblePages: [
      "/dashboard", "/dashboard/schedule",
      "/dashboard/courses", "/dashboard/students",
    ],
  },
  {
    id: "coordinator",
    name: "רכז",
    description: "ניהול קורסים, תוכניות גפ\"ן ובתי ספר",
    permissions: [
      "nav.courses", "nav.students", "nav.teachers", "nav.schools",
      "nav.gafan", "nav.reports", "nav.attendance", "nav.schedule",
      "courses.view", "courses.edit",
      "courses.tab.general", "courses.tab.students", "courses.tab.payments", "courses.tab.attendance.students", "courses.tab.attendance.teachers",
      "students.view", "students.edit",
      "students.tab.profile", "students.tab.general", "students.tab.courses", "students.tab.payments", "students.tab.attendance",
      "schools.view", "schools.edit",
      "teachers.view", "teachers.financial",
      "teachers.tab.general", "teachers.tab.courses", "teachers.tab.payments", "teachers.tab.attendance",
      "gafan.view", "gafan.edit",
      "reports.view",
      "schedule.view", "schedule.edit",
      "attendance.view", "attendance.edit",
      "settings.home",
    ],
    visiblePages: [
      "/dashboard", "/dashboard/courses", "/dashboard/students",
      "/dashboard/teachers", "/dashboard/schools", "/dashboard/gafan",
      "/dashboard/reports", "/dashboard/attendance", "/dashboard/schedule",
    ],
  },
  {
    id: "other",
    name: "אחר",
    description: "הרשאות מותאמות אישית",
    permissions: ["settings.home"],
    visiblePages: ["/dashboard"],
  },
]

export function getRoleById(roleId: RoleType): RolePreset | undefined {
  return ROLE_PRESETS.find((r) => r.id === roleId)
}

export function getPermissionsForRole(roleId: RoleType): string[] {
  const role = getRoleById(roleId)
  return role?.permissions || []
}

export function getVisiblePagesForRole(roleId: RoleType): string[] {
  const role = getRoleById(roleId)
  return role?.visiblePages || ["/dashboard"]
}

/** Maps nav permission to sidebar href */
const NAV_PERM_TO_HREF: Record<string, string> = {
  "nav.courses": "/dashboard/courses",
  "nav.students": "/dashboard/students",
  "nav.schools": "/dashboard/schools",
  "nav.teachers": "/dashboard/teachers",
  "nav.registration": "/dashboard/registration",
  "nav.gafan": "/dashboard/gafan",
  "nav.users": "/dashboard/users",
  "nav.cashier": "/dashboard/cashier",
  "nav.reports": "/dashboard/reports",
  "nav.attendance": "/dashboard/attendance",
  "nav.schedule": "/dashboard/schedule",
  "nav.settings": "/dashboard/settings",
}

/** Check if a sidebar item should be visible based on nav.XXX permissions */
/** תפקידים עם גישה מלאה לכל הדפים (כולל קופה, דוחות וכו') */
const FULL_ACCESS_ROLES = new Set([
  "admin", "administrator", "center_admin", "super_admin", "owner", "manager",
  "secretary", "coordinator", "אדמין", "מנהל", "מנהל מרכז", "מזכירה", "רכז",
])

function normalizeRoleToken(role: unknown): string {
  const raw = (role as string)?.toString?.()?.trim?.()?.toLowerCase?.() ?? ""
  if (!raw) return ""
  return raw.replace(/[\s\-]+/g, "_")
}

/** תפקידי ניהול מלאים (כמו בסרגל): admin, center_admin, מנהל מרכז, מזכירה, רכז וכו' */
export function hasFullAccessRole(role: unknown): boolean {
  const r = normalizeRoleToken(role)
  if (!r) return false
  if (FULL_ACCESS_ROLES.has(r)) return true
  const compact = r.replace(/[_\W]/g, "")
  if (
    r === "centeradmin" ||
    r === "centreadmin" ||
    r === "centeradministrator" ||
    r === "centreadministrator" ||
    r === "administrator" ||
    r.startsWith("admin") ||
    r.endsWith("admin") ||
    r.includes("_admin") ||
    r.includes("מנהל") ||
    r.includes("אדמין") ||
    r.includes("אדמן") ||
    compact.includes("centeradmin") ||
    compact.includes("centreadmin") ||
    compact.includes("centeradministrator") ||
    compact.includes("centreadministrator") ||
    compact.includes("superadmin") ||
    compact.includes("sysadmin")
  ) return true
  return false
}

/** גישה מלאה לפי סשן: בודק גם roleKey וגם שם תפקיד (חשוב כש־key ב-DB לא תואם preset) */
export function sessionRolesGrantFullAccess(
  roleKey?: string | null,
  roleName?: string | null,
): boolean {
  return hasFullAccessRole(roleKey) || hasFullAccessRole(roleName)
}

export function canShowInSidebar(
  userPermissions: string[],
  userRole: RoleType,
  href: string,
  sessionRoleKey?: string | null,
  sessionRoleName?: string | null,
): boolean {
  if (sessionRolesGrantFullAccess(sessionRoleKey, sessionRoleName) || hasFullAccessRole(userRole)) return true
  if (href === "/dashboard") return hasPermission(userPermissions, "settings.home")
  const navPerm = Object.entries(NAV_PERM_TO_HREF).find(([, h]) => h === href)?.[0]
  if (!navPerm) return true
  return hasPermission(userPermissions, navPerm)
}

export const PAGE_REQUIRED_PERMISSION: { path: string; permission: string }[] = [
  { path: "/dashboard", permission: "settings.home" },
  { path: "/dashboard/registration", permission: "registration.view" },
  { path: "/dashboard/courses", permission: "courses.view" },
  { path: "/dashboard/students", permission: "students.view" },
  { path: "/dashboard/teachers", permission: "teachers.view" },
  { path: "/dashboard/schools", permission: "schools.view" },
  { path: "/dashboard/gafan", permission: "gafan.view" },
  { path: "/dashboard/users", permission: "users.view" },
  { path: "/dashboard/cashier", permission: "cashier.view" },
  { path: "/dashboard/reports", permission: "reports.view" },
  { path: "/dashboard/attendance", permission: "attendance.view" },
  { path: "/dashboard/schedule", permission: "schedule.view" },
  { path: "/dashboard/settings", permission: "settings.view" },
]

function getRequiredPermissionForPath(pagePath: string): string | null {
  let match: { permission: string } | null = null
  let maxLen = 0
  for (const { path, permission } of PAGE_REQUIRED_PERMISSION) {
    if ((pagePath === path || pagePath.startsWith(path + "/")) && path.length >= maxLen) {
      maxLen = path.length
      match = { permission }
    }
  }
  return match?.permission ?? null
}

function getNavPermissionForPath(pagePath: string): string | null {
  const entry = Object.entries(NAV_PERM_TO_HREF).find(([, href]) => pagePath === href || pagePath.startsWith(href + "/"))
  return entry?.[0] ?? null
}

export function canAccessPage(
  userPermissions: string[],
  userRole: RoleType,
  pagePath: string,
  studentId?: string,
  studentCourseIds?: string[],
  sessionRoleKey?: string | null,
  sessionRoleName?: string | null,
): boolean {
  if (sessionRolesGrantFullAccess(sessionRoleKey, sessionRoleName) || hasFullAccessRole(userRole)) return true

  const roleIdNormalized = (typeof userRole === "string" ? userRole.toLowerCase() : userRole) as RoleType
  const role = getRoleById(roleIdNormalized) || getRoleById(userRole)

  if (roleIdNormalized === "student" || userRole === "student") {
    if (pagePath === "/dashboard") return true
    if (pagePath === "/dashboard/schedule") return true
    if (pagePath.startsWith("/dashboard/students/") && studentId) {
      const pathStudentId = pagePath.split("/")[3]
      if (pathStudentId === studentId) return true
      return false
    }
    if (pagePath.startsWith("/dashboard/courses/") && studentCourseIds) {
      const pathCourseId = pagePath.split("/")[3]
      if (studentCourseIds.includes(pathCourseId)) return true
      return false
    }
    if (pagePath === "/dashboard/courses" || pagePath === "/dashboard/students") return false
    return false
  }

  if (pagePath === "/dashboard") {
    if (hasPermission(userPermissions, "settings.home")) return true
    if (role && role.visiblePages.some((p) => p === "/dashboard")) return true
    if (!role) return true
  }

  const requiredPerm = getRequiredPermissionForPath(pagePath)
  if (requiredPerm && hasPermission(userPermissions, requiredPerm)) return true
  // Backward compatibility:
  // In some users only nav permission was granted from the Users page.
  // Allow access if the matching nav permission exists for this page.
  const navPerm = getNavPermissionForPath(pagePath)
  if (navPerm && hasPermission(userPermissions, navPerm)) return true

  if (role && role.visiblePages.some((page) => pagePath === page || pagePath.startsWith(page + "/"))) return true

  return false
}
