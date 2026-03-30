"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import {
  Bot,
  BookOpen,
  Users,
  Calendar,
  Settings,
  Home,
  Menu,
  X,
  GraduationCap,
  School,
  Rocket,
  UserCircle,
  Wallet,
  FileText,
  ClipboardCheck,
  UserPlus,
  User, // Import User icon
} from "lucide-react"
import { useRouter } from "next/navigation"
import { canAccessPage, canShowInSidebar, type RoleType } from "@/lib/permissions"
import { useUserType, clearUserTypeCache } from "@/lib/use-user-type"
import { useSettings, clearSettingsCache } from "@/lib/use-settings"
import { useLanguage } from "@/lib/i18n/context"
import { LanguageSelector } from "@/components/language-selector"
import { AuthProvider } from "@/lib/auth-context"
import { useEnabledFeatures } from "@/lib/use-enabled-features"

const navItems: { href: string; icon: typeof Home; labelKey: string; featureKey?: string }[] = [
  { href: "/dashboard", icon: Home, labelKey: "nav.home" },
  { href: "/dashboard/registration", icon: UserPlus, labelKey: "nav.registration", featureKey: "students" },
  { href: "/dashboard/courses", icon: BookOpen, labelKey: "nav.courses", featureKey: "courses" },
  { href: "/dashboard/students", icon: Users, labelKey: "nav.students", featureKey: "students" },
  { href: "/dashboard/teachers", icon: GraduationCap, labelKey: "nav.teachers", featureKey: "teachers" },
  { href: "/dashboard/schools", icon: School, labelKey: "nav.schools", featureKey: "schools" },
  { href: "/dashboard/gafan", icon: Rocket, labelKey: "nav.gafan", featureKey: "gafan" },
  { href: "/dashboard/users", icon: UserCircle, labelKey: "nav.users" },
  { href: "/dashboard/cashier", icon: Wallet, labelKey: "nav.cashier", featureKey: "payments" },
  { href: "/dashboard/reports", icon: FileText, labelKey: "nav.reports", featureKey: "reports" },
  { href: "/dashboard/attendance", icon: ClipboardCheck, labelKey: "nav.attendance" },
  { href: "/dashboard/schedule", icon: Calendar, labelKey: "nav.schedule" },
  { href: "/dashboard/settings", icon: Settings, labelKey: "nav.settings" },
]

interface CurrentUser {
  id: string
  username: string
  full_name: string
  role: string
  roleKey?: string
  permissions?: string[]
  loginTime?: string
  centerId?: string | null
  centerSlug?: string | null
  centerName?: string | null
}

interface CenterSettings {
  center_name: string
  logo: string
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t, dir } = useLanguage()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const { settings: centerSettings } = useSettings()
  const { features: enabledFeatures } = useEnabledFeatures()

  useEffect(() => {
    // Session is HttpOnly; get current user from server (validates idle/absolute timeout)
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          // Don't force expired=1 — might be no cookie; proxy sets expired=1 when session actually expired
          const q = typeof window !== "undefined" ? window.location.search : ""
          router.replace(q ? `/login${q}` : "/login")
          return null
        }
        if (!res.ok) {
          const q = typeof window !== "undefined" ? window.location.search : ""
          router.replace(q ? `/login${q}` : "/login")
          return null
        }
        return res.json()
      })
      .then((user) => {
        if (user) setCurrentUser(user)
      })
      .catch(() => router.replace("/login"))
      .finally(() => setIsLoading(false))
  }, [router])

  // Pass role so admins bypass by-user API calls entirely (no loading loop)
  const { data: userTypeData, loading: userTypeLoading } = useUserType(currentUser?.id, currentUser?.role)
  
  // Derive student/teacher data from cached hook
  const studentData = userTypeData?.isStudent ? { id: userTypeData.studentId!, courseIds: userTypeData.courseIds || [] } : null
  const teacherData = userTypeData?.isTeacher
    ? {
        id: userTypeData.teacherId!,
        courseIds: userTypeData.courseIds || [],
      }
    : null
  const isLinkedToStudent = userTypeData?.isStudent || false
  const isLinkedToTeacher = userTypeData?.isTeacher || false
  const isTeacherRole = isLinkedToTeacher || (currentUser?.roleKey === "teacher" || currentUser?.role === "teacher")
  const userPermissions = currentUser?.permissions || []
  const showHomeInSidebar = userPermissions.includes("settings.home")
  // פרופיל בסרגל: מפורש nav.myProfile, או ברירת מחדל למורה/תלמיד כשאין דף בית (גם אם ההרשאות ב-DB ריקות/ישנות)
  const showMyProfileInSidebar =
    userPermissions.includes("nav.myProfile") ||
    ((isLinkedToTeacher || isLinkedToStudent || isTeacherRole) && !showHomeInSidebar)

  // Check page access permissions
  useEffect(() => {
    if (!currentUser || !pathname) return
    // Don't redirect while still loading user type (prevents redirect loop for teachers)
    if (userTypeLoading) return

    // If user is linked to a teacher, allow own profile + schedule + attendance
    if (isLinkedToTeacher && teacherData) {
        const isOwnTeacherProfile =
          pathname === `/dashboard/teachers/${teacherData.id}` ||
          pathname.startsWith(`/dashboard/teachers/${teacherData.id}/`)
        const isSchedule = pathname === "/dashboard/schedule"
        const isAttendance = pathname === "/dashboard/attendance"
        const isCoursesList = pathname === "/dashboard/courses"
        const courseIdFromPath = pathname.match(/^\/dashboard\/courses\/([^/]+)/)?.[1]
        const isMyCourse =
          !!courseIdFromPath && (teacherData.courseIds || []).includes(courseIdFromPath)
        if (isOwnTeacherProfile || isSchedule || isAttendance || isCoursesList || isMyCourse) {
          return // allow – no redirect
        }
      }

      // If user is linked to a student, use student permissions
      if (isLinkedToStudent && studentData) {
        const hasAccess = canAccessPage(
          [],
          "student",
          pathname,
          studentData.id,
          studentData.courseIds
        )
        
        if (!hasAccess) {
          router.push("/dashboard")
        }
      } else {
        const userRole = ((currentUser.roleKey || currentUser.role) as RoleType) || "other"
        const userPermissions = currentUser.permissions || []

        const hasAccess = canAccessPage(
          userPermissions,
          userRole,
          pathname,
          studentData?.id,
          studentData?.courseIds,
          currentUser.roleKey,
          currentUser.role,
        )
        
        if (!hasAccess) {
          router.push("/dashboard")
        }
      }
  }, [currentUser, pathname, router, studentData, isLinkedToStudent, isLinkedToTeacher, teacherData, userTypeLoading])

  const handleLogout = () => {
    clearUserTypeCache()
    clearSettingsCache()
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
      router.push("/login")
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="flex h-screen bg-background" dir={dir}>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className={dir === "rtl" ? "fixed top-4 right-4 z-50 md:hidden" : "fixed top-4 left-4 z-50 md:hidden"}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 z-40 w-64 transform border-border bg-card transition-transform duration-300 ease-in-out md:relative ${
          dir === "rtl"
            ? `right-0 border-l ${sidebarOpen ? "translate-x-0" : "translate-x-full"} md:translate-x-0`
            : `left-0 border-r ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex flex-col items-center justify-center border-b border-border px-4 py-3 gap-1">
            <span className="text-lg font-bold text-foreground text-center">{centerSettings.center_name}</span>
            {/* Debug badge — shows resolved center slug for easy verification */}
            {currentUser?.centerSlug && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-mono text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                <span className="opacity-60">Center:</span> {currentUser.centerSlug}
              </span>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {isLinkedToStudent && currentUser?.roleKey !== "admin" && currentUser?.role !== "admin" && currentUser?.role !== "Administrator" ? (
              // סטודנט: פרופיל שלי או דף בית – לפי הרשאה (הדדי)
              <>
                {showMyProfileInSidebar && studentData ? (
                  <Link
                    href={`/dashboard/students/${studentData.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                      pathname.includes(`/dashboard/students/${studentData.id}`)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <User className="h-5 w-5" />
                    {t("nav.myProfile")}
                  </Link>
                ) : showMyProfileInSidebar && !studentData ? (
                  <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground">
                    <User className="h-5 w-5" />
                    {t("nav.loading")}
                  </div>
                ) : null}
                {showHomeInSidebar && (
                  <Link
                    href="/dashboard"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                      pathname === "/dashboard"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Home className="h-5 w-5" />
                    {t("nav.home")}
                  </Link>
                )}
                <Link
                  href="/dashboard/schedule"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    pathname === "/dashboard/schedule"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Calendar className="h-5 w-5" />
                  {t("nav.schedule")}
                </Link>
              </>
            ) : isTeacherRole ? (
              // מורה: פרופיל; "קורסים" → דף רשימה; לוח זמנים ונוכחות (שמות קורסים בלבד בדף הקורסים, לא בסרגל)
              <>
                <Link
                  href={teacherData ? `/dashboard/teachers/${teacherData.id}` : "/dashboard/teachers/me"}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    (teacherData && pathname.includes(`/dashboard/teachers/${teacherData.id}`)) ||
                    (!teacherData && pathname === "/dashboard/teachers/me")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <User className="h-5 w-5" />
                  {t("nav.myProfile")}
                </Link>
                <Link
                  href="/dashboard/schedule"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    pathname === "/dashboard/schedule"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Calendar className="h-5 w-5" />
                  {t("nav.schedule")}
                </Link>
                <Link
                  href="/dashboard/attendance"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    pathname === "/dashboard/attendance"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <ClipboardCheck className="h-5 w-5" />
                  {t("nav.attendance")}
                </Link>
                {/* פריטים נוספים לפי הרשאות (קורסים, תלמידים וכו') */}
                {navItems
                  .filter((item) => {
                    if (item.href === "/dashboard" || item.href === "/dashboard/schedule" || item.href === "/dashboard/attendance") return false
                    if (item.featureKey && enabledFeatures.length > 0 && !enabledFeatures.includes(item.featureKey)) return false
                    const userRole = ((currentUser?.roleKey || currentUser?.role) as RoleType) || "teacher"
                    if (!canShowInSidebar(userPermissions, userRole, item.href, currentUser?.roleKey, currentUser?.role))
                      return false
                    return canAccessPage(
                      userPermissions,
                      userRole,
                      item.href,
                      undefined,
                      teacherData?.courseIds,
                      currentUser?.roleKey,
                      currentUser?.role,
                    )
                  })
                  .map((item) => {
                    const isActive =
                      item.href === "/dashboard/courses"
                        ? pathname === "/dashboard/courses" || pathname.startsWith("/dashboard/courses/")
                        : pathname === item.href
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                          isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {t(item.labelKey)}
                      </Link>
                    )
                  })}
              </>
            ) : (
              // Regular navigation for non-students (use roleKey e.g. "admin" for permission check)
              navItems
                .filter((item) => {
                  if (item.featureKey && enabledFeatures.length > 0 && !enabledFeatures.includes(item.featureKey)) return false
                  const userRole = ((currentUser?.roleKey || currentUser?.role) as RoleType) || "other"
                  const userPermissions = currentUser?.permissions || []
                  if (!canShowInSidebar(userPermissions, userRole, item.href, currentUser?.roleKey, currentUser?.role))
                    return false
                  return canAccessPage(
                    userPermissions,
                    userRole,
                    item.href,
                    studentData?.id,
                    studentData?.courseIds,
                    currentUser?.roleKey,
                    currentUser?.role,
                  )
                })
                .map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      {t(item.labelKey)}
                    </Link>
                  )
                })
            )}
          </nav>

          {/* User info */}
          <div className="border-t border-border p-4 space-y-2">
            <div className="flex justify-center mb-2">
              <LanguageSelector className="flex-row" />
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                {currentUser.full_name?.charAt(0) || currentUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {currentUser.full_name || currentUser.username}
                </p>
                <p className="text-xs text-muted-foreground truncate">{currentUser.role}</p>
                {currentUser.centerSlug && (
                  <p className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate mt-0.5">
                    {currentUser.centerName ?? currentUser.centerSlug}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={handleLogout}>
              <LogOut className={`h-4 w-4 ${dir === "rtl" ? "ml-2" : "mr-2"}`} />
              {t("nav.signOut")}
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <AuthProvider value={currentUser}>
          <div className="container mx-auto p-6 md:p-8">{children}</div>
        </AuthProvider>
      </main>
    </div>
  )
}
