"use client"

import { Card } from "@/components/ui/card"
import { BookOpen, Users, Calendar, TrendingUp, GraduationCap, Building2, Banknote, Loader2, Clock, Wallet, AlertCircle, UserRound } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUserType } from "@/lib/use-user-type"
import { useLanguage } from "@/lib/i18n/context"
import { useCurrentUser } from "@/lib/auth-context"
import { hasFullAccessRole } from "@/lib/permissions"

interface TeacherDashboardAggregate {
  totalAttendanceHours: number
  totalSalaryExpenses: number
}

interface DashboardStats {
  totalCourses: number
  activeStudents: number
  activeTeachers: number
  totalSchools: number
  totalEnrollments: number
  monthlyIncome: number
  monthlyExpenses: number
  totalStudentDebt: number
  debtorStudentsCount: number
  recentActivity: {
    type: "student" | "course"
    id: string
    name: string
    createdAt: string
  }[]
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `לפני ${diffMins} דקות`
  if (diffHours < 24) return `לפני ${diffHours} שעות`
  if (diffDays < 7) return `לפני ${diffDays} ימים`
  return date.toLocaleDateString("he-IL")
}

export default function DashboardPage() {
  const router = useRouter()
  const { t, dir } = useLanguage()
  const currentUser = useCurrentUser()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [teacherAggregate, setTeacherAggregate] = useState<TeacherDashboardAggregate | null>(null)
  const [loading, setLoading] = useState(true)

  const roleToken = (currentUser?.roleKey || currentUser?.role || "").toString()
  const isAdmin = hasFullAccessRole(currentUser?.roleKey) || hasFullAccessRole(currentUser?.role) || hasFullAccessRole(roleToken)
  // Pass resolved role token so admins bypass by-user API calls entirely (no loading loop)
  const { data: userTypeData, loading: userTypeLoading } = useUserType(currentUser?.id, roleToken)
  const userPerms = currentUser?.permissions || []
  const showHomeInSidebar = userPerms.includes("settings.home")
  const showMyProfileInSidebar = userPerms.includes("nav.myProfile")
  const isTeacherRole = !isAdmin && (currentUser?.roleKey === "teacher" || currentUser?.role === "teacher")

  // מורה: מפנה מיד לפרופיל (דרך /teachers/me) כדי לא להציג דף בית ואז להעלים – בלי להמתין ל-useUserType
  useEffect(() => {
    if (!currentUser) return
    if (showHomeInSidebar && showMyProfileInSidebar === false) return // בחר דף בית – לא מפנה
    if (isTeacherRole) {
      router.replace("/dashboard/teachers/me")
      return
    }
    if (!userTypeData) return
    if (userTypeData.isTeacher && userTypeData.teacherId) {
      router.replace(`/dashboard/teachers/${userTypeData.teacherId}`)
    } else if (userTypeData.isStudent && userTypeData.studentId) {
      router.replace(`/dashboard/students/${userTypeData.studentId}`)
    }
  }, [currentUser, userTypeData, router, showHomeInSidebar, showMyProfileInSidebar, isTeacherRole])

  // Fetch data based on user type
  const dataFetchedRef = useRef(false)
  
  useEffect(() => {
    if (!currentUser || userTypeLoading) return
    if (userTypeData?.isTeacher || userTypeData?.isStudent) return // Teacher/student will be redirected to profile
    if (dataFetchedRef.current) return // Prevent duplicate fetch
    
    dataFetchedRef.current = true

    if (isAdmin) {
      Promise.all([
        fetch("/api/dashboard/stats").then((res) => {
          if (res.status === 404) return null
          return res.ok ? res.json() : null
        }),
        fetch("/api/teachers?aggregate=1", { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
      ])
        .then(([statsData, teachersPayload]) => {
          if (statsData) setStats(statsData)
          if (teachersPayload?.aggregate) {
            setTeacherAggregate({
              totalAttendanceHours: Number(teachersPayload.aggregate.totalAttendanceHours ?? 0),
              totalSalaryExpenses: Number(teachersPayload.aggregate.totalSalaryExpenses ?? 0),
            })
          } else {
            setTeacherAggregate(null)
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else if (userTypeData?.isStudent && userTypeData.studentId) {
      // Student is redirected to profile – no fetch needed here
      setLoading(false)
    } else {
      // Regular user - just stop loading
      setLoading(false)
    }
  }, [currentUser, userTypeData, userTypeLoading, isAdmin])

  // מורה שמפנים לפרופיל – הצג טעינה כדי לא להראות דף בית לרגע
  if (currentUser && isTeacherRole && !showHomeInSidebar) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-3 sm:p-6" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className={`text-muted-foreground ${dir === "rtl" ? "mr-2" : "ml-2"}`}>{t("nav.redirecting")}</span>
      </div>
    )
  }
  
  // Show loading while checking user type (but not for admins - they always see admin dashboard)
  if (!isAdmin && (userTypeLoading || !userTypeData)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-3 sm:p-6" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className={`text-muted-foreground ${dir === "rtl" ? "mr-2" : "ml-2"}`}>{t("nav.checkingPermissions")}</span>
      </div>
    )
  }
  
  const isTeacherOrStudent = (userTypeData?.isTeacher && userTypeData.teacherId) || (userTypeData?.isStudent && userTypeData.studentId)
  const shouldRedirectToProfile = isTeacherOrStudent && (showMyProfileInSidebar || !showHomeInSidebar)
  if (isTeacherOrStudent && shouldRedirectToProfile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-3 sm:p-6" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className={`text-muted-foreground ${dir === "rtl" ? "mr-2" : "ml-2"}`}>{t("nav.redirecting")}</span>
      </div>
    )
  }

  if (loading || !currentUser) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-3 sm:p-6" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-3 sm:space-y-8 sm:p-6" dir="rtl">
      {/* Stats Row 1 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 dark:border-blue-800 dark:from-blue-950/30 dark:to-blue-900/20 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">סה"כ קורסים</p>
              <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300 sm:text-3xl">{stats?.totalCourses || 0}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 sm:h-12 sm:w-12">
              <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400 sm:h-6 sm:w-6" />
            </div>
          </div>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 p-4 dark:border-green-800 dark:from-green-950/30 dark:to-green-900/20 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">תלמידים פעילים</p>
              <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300 sm:text-3xl">{stats?.activeStudents || 0}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-500/20 sm:h-12 sm:w-12">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400 sm:h-6 sm:w-6" />
            </div>
          </div>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 dark:border-purple-800 dark:from-purple-950/30 dark:to-purple-900/20 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">מורים פעילים</p>
              <p className="mt-1 text-2xl font-bold text-purple-700 dark:text-purple-300 sm:text-3xl">{stats?.activeTeachers || 0}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 sm:h-12 sm:w-12">
              <GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400 sm:h-6 sm:w-6" />
            </div>
          </div>
        </Card>

        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 p-4 dark:border-orange-800 dark:from-orange-950/30 dark:to-orange-900/20 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400">בתי ספר</p>
              <p className="mt-1 text-2xl font-bold text-orange-700 dark:text-orange-300 sm:text-3xl">{stats?.totalSchools || 0}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 sm:h-12 sm:w-12">
              <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400 sm:h-6 sm:w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* מורים: סה״כ שעות נוכחות + סה״כ משכורות ששולמו */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-4 dark:border-teal-800 dark:from-teal-950/40 dark:to-cyan-950/30 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-right">
                <p className="text-sm font-medium text-teal-700 dark:text-teal-300">סה״כ שעות נוכחות (מורים)</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-teal-900 dark:text-teal-100 sm:text-3xl">
                  {teacherAggregate != null
                    ? teacherAggregate.totalAttendanceHours.toLocaleString("he-IL")
                    : "—"}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 sm:h-12 sm:w-12">
                <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400 sm:h-6 sm:w-6" />
              </div>
            </div>
          </Card>
          <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 p-4 dark:border-rose-900 dark:from-rose-950/40 dark:to-orange-950/30 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-right">
                <p className="text-sm font-medium text-rose-700 dark:text-rose-300">סה״כ ישולם משכורות (הוצאות)</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-rose-900 dark:text-rose-100 sm:text-3xl">
                  {teacherAggregate != null
                    ? `₪${Math.round(teacherAggregate.totalSalaryExpenses).toLocaleString("he-IL")}`
                    : "—"}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 sm:h-12 sm:w-12">
                <Wallet className="h-5 w-5 text-rose-600 dark:text-rose-400 sm:h-6 sm:w-6" />
              </div>
            </div>
          </Card>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 dark:border-amber-900 dark:from-amber-950/40 dark:to-yellow-950/30 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-right">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">סה״כ חייבים (תלמידים)</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-amber-950 dark:text-amber-100 sm:text-3xl">
                  {stats != null
                    ? `₪${Math.round(stats.totalStudentDebt ?? 0).toLocaleString("he-IL")}`
                    : "—"}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 sm:h-12 sm:w-12">
                <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-400 sm:h-6 sm:w-6" />
              </div>
            </div>
          </Card>
          <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 dark:border-indigo-800 dark:from-indigo-950/40 dark:to-violet-950/30 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-right">
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">כמות תלמידים חייבים</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-900 dark:text-indigo-100 sm:text-3xl">
                  {stats != null ? (stats.debtorStudentsCount ?? 0).toLocaleString("he-IL") : "—"}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 sm:h-12 sm:w-12">
                <UserRound className="h-5 w-5 text-indigo-700 dark:text-indigo-400 sm:h-6 sm:w-6" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Stats Row 2 - Financial */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-sm font-medium text-muted-foreground">רישומים לקורסים</p>
              <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">{stats?.totalEnrollments || 0}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="bg-green-50/50 p-4 dark:bg-green-950/20 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">הכנסות החודש</p>
              <p className="mt-1 break-words text-xl font-bold text-green-700 dark:text-green-300 sm:text-2xl">
                {(stats?.monthlyIncome || 0).toLocaleString()} ₪
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/20">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-red-50/50 p-4 dark:bg-red-950/20 sm:col-span-2 sm:p-5 lg:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">הוצאות החודש</p>
              <p className="mt-1 break-words text-xl font-bold text-red-700 dark:text-red-300 sm:text-2xl">
                {(stats?.monthlyExpenses || 0).toLocaleString()} ₪
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/20">
              <Banknote className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-4 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground sm:mb-4 sm:text-xl">פעילות אחרונה</h2>
        <div className="space-y-3 sm:space-y-4">
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            stats.recentActivity.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 pb-3 sm:items-center sm:gap-4 sm:pb-4 ${index < stats.recentActivity.length - 1 ? "border-b border-border" : ""}`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.type === "course" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-green-100 dark:bg-green-900/30"}`}
                >
                  {item.type === "course" ? (
                    <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <p className="break-words text-sm font-medium text-foreground">
                    {item.type === "course" ? `קורס חדש נוסף: ${item.name}` : `תלמיד חדש נרשם: ${item.name}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatTimeAgo(item.createdAt)}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-muted-foreground">אין פעילות אחרונה</p>
          )}
        </div>
      </Card>
    </div>
  )
}
