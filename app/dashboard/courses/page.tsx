"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Trash2, Pencil, Eye, Plus, RefreshCw, Users, Clock, Calendar, 
  LayoutGrid, List, User, AlertCircle, CheckCircle2, Copy, Check
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { deleteWithUndo } from "@/lib/notify"
import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, hasFullAccessRole } from "@/lib/permissions"
import { useUserType } from "@/lib/use-user-type"
import { getCourseStatusPresentation } from "@/lib/course-status"
import { isCampCourseType, listCampSessionDates } from "@/lib/camp-kaytana"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/i18n/context"

type Course = {
  id: string
  name: string
  description?: string
  courseNumber?: string
  category?: string
  courseType?: string
  location?: string
  level?: string
  duration?: string
  price?: number
  status?: string
  startDate?: string
  endDate?: string
  startTime?: string
  endTime?: string
  daysOfWeek?: string[]
  teacherIds?: string[]
  createdAt: string
  updatedAt: string
  enrollmentCount?: number
  totalPaid?: number
  paidCount?: number
  teachers?: { id: string; name: string }[]
}

function isTotalCoursePricingType(courseType?: string) {
  return (
    typeof courseType === "string" &&
    (courseType.endsWith("_total") || courseType.endsWith("_session") || courseType.endsWith("_hour"))
  )
}

/** מספר מפגשים לכרטיס: קייטנה / תמחור לפי מפגש או שעה — מחושב מתאריכים וימים (מתוקן לעומת שדה duration ישן/UTC). */
function displaySessionsOnCourseCard(c: Course): string {
  const ct = String(c.courseType || "")
  const pricingByMeetings = ct.endsWith("_session") || ct.endsWith("_hour")
  const campDates =
    isCampCourseType(ct) && c.startDate && c.endDate && c.daysOfWeek && c.daysOfWeek.length > 0
  if ((pricingByMeetings || campDates) && c.startDate && c.endDate && c.daysOfWeek?.length) {
    const n = listCampSessionDates(c.startDate, c.endDate, c.daysOfWeek).length
    if (n > 0) return String(n)
  }
  if (c.duration != null && String(c.duration).trim() !== "") return String(c.duration)
  return ""
}

type Teacher = {
  id: string
  name: string
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [expectedByCourse, setExpectedByCourse] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "completed">("active")
  const [copiedCourseId, setCopiedCourseId] = useState<string | null>(null)

  const currentUser = useCurrentUser()
  const { toast } = useToast()
  const { t, locale } = useLanguage()
  const { data: userTypeData, loading: userTypeLoading } = useUserType(
    currentUser?.id,
    currentUser?.roleKey || currentUser?.role,
  )
  const roleKey = (currentUser?.roleKey || currentUser?.role)?.toString().toLowerCase()
  const isAdmin =
    hasFullAccessRole(currentUser?.roleKey) ||
    hasFullAccessRole(currentUser?.role) ||
    roleKey === "admin" ||
    currentUser?.role === "Administrator" ||
    currentUser?.role === "אדמין" ||
    currentUser?.role === "מנהל"
  const userPerms = currentUser?.permissions || []
  const canSeeFinancial = isAdmin || hasPermission(userPerms, "courses.financial")
  const canViewCourses = isAdmin || hasPermission(userPerms, "courses.view")
  const canEditCourses = isAdmin || hasPermission(userPerms, "courses.edit")
  const canDeleteCourses = isAdmin || hasPermission(userPerms, "courses.delete")
  const isLinkedTeacher = userTypeData?.isTeacher === true

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const [coursesRes, teachersRes, enrollmentsRes] = await Promise.all([
        fetch("/api/courses", { cache: "no-store" }),
        fetch("/api/teachers", { cache: "no-store" }),
        fetch("/api/enrollments", { cache: "no-store" }),
      ])
      if (!coursesRes.ok) throw new Error(`Failed to load courses (${coursesRes.status})`)
      const coursesData = await coursesRes.json()
      setCourses(coursesData ?? [])
      
      if (teachersRes.ok) {
        const teachersData = await teachersRes.json()
        setTeachers(teachersData ?? [])
      }
      if (enrollmentsRes.ok) {
        const enrollments = await enrollmentsRes.json()
        const sumMap: Record<string, number> = {}
        ;(Array.isArray(enrollments) ? enrollments : []).forEach((e: any) => {
          const cid = String(e?.courseId || e?.courseIdRef || "")
          if (!cid) return
          sumMap[cid] = (sumMap[cid] || 0) + Number(e?.coursePrice || 0)
        })
        setExpectedByCourse(sumMap)
      } else {
        setExpectedByCourse({})
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  function remove(id: string) {
    const course = courses.find((c) => c.id === id)
    deleteWithUndo({
      entityKey: "course",
      itemId: id,
      itemLabel: course?.name,
      removeFromUI: () => setCourses((prev) => prev.filter((c) => c.id !== id)),
      restoreFn: () => course && setCourses((prev) => [...prev, course]),
      deleteFn: async () => {
        const res = await fetch(`/api/courses/${id}`, { method: "DELETE", credentials: "include" })
        if (!res.ok) throw new Error("Delete failed")
      },
      confirmPolicy: "standard",
      undoWindowMs: 10_000,
    })
  }

  useEffect(() => {
    load()
    // Keep requested defaults every page entry.
    setViewMode("list")
    setStatusFilter("active")
  }, [])

  const coursesForUser = useMemo(() => {
    if (isAdmin || !isLinkedTeacher) return courses
    const ids = new Set(userTypeData?.courseIds || [])
    return courses.filter((c) => ids.has(c.id))
  }, [courses, isAdmin, isLinkedTeacher, userTypeData?.courseIds])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const bySearch = !s
      ? coursesForUser
      : coursesForUser.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.description?.toLowerCase().includes(s) ||
        c.category?.toLowerCase().includes(s),
      )

    return bySearch.filter((c) => {
      const statusKey = getCourseStatusPresentation({ status: c.status, endDate: c.endDate }).key
      const raw = String(c.status ?? "").trim().toLowerCase()
      const completedLike =
        statusKey === "completed" ||
        raw === "completed" ||
        raw === "הושלם" ||
        raw === "סיים" ||
        raw === "נגמר" ||
        raw === "הסתיים"
      if (statusFilter === "all") return true
      if (statusFilter === "completed") return completedLike
      return !completedLike && statusKey === "active"
    })
  }, [q, coursesForUser, statusFilter])

  const pageBusy = loading || (!isAdmin && userTypeLoading)

  const getTeacherNames = (teacherIds?: string[]) => {
    if (!teacherIds || teacherIds.length === 0) return null
    return teacherIds
      .map(id => teachers.find(t => t.id === id)?.name)
      .filter(Boolean)
      .join(", ")
  }

  const getDaysLabel = (days?: string[]) => {
    if (!days || days.length === 0) return null
    const dayNamesHe: Record<string, string> = {
      sunday: "ראשון",
      monday: "שני",
      tuesday: "שלישי",
      wednesday: "רביעי",
      thursday: "חמישי",
      friday: "שישי",
      saturday: "שבת"
    }
    const dayNamesAr: Record<string, string> = {
      ראשון: "الأحد",
      שני: "الاثنين",
      שלישי: "الثلاثاء",
      רביעי: "الأربعاء",
      חמישי: "الخميس",
      שישי: "الجمعة",
      שבת: "السبت",
    }
    const dayNamesEn: Record<string, string> = {
      ראשון: "Sunday",
      שני: "Monday",
      שלישי: "Tuesday",
      רביעי: "Wednesday",
      חמישי: "Thursday",
      שישי: "Friday",
      שבת: "Saturday",
    }
    return days
      .map((d) => {
        const heb = dayNamesHe[d.toLowerCase()] || d
        if (locale === "ar") return dayNamesAr[heb] || heb
        if (locale === "en") return dayNamesEn[heb] || heb
        return heb
      })
      .join(", ")
  }

  const formatDate = (date?: string) => {
    if (!date) return null
    const localeTag = locale === "ar" ? "ar" : locale === "en" ? "en-GB" : "he-IL"
    return new Intl.DateTimeFormat(localeTag, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(date))
  }

  const copyCourseRegistrationLink = async (course: Course) => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const params = new URLSearchParams({
      courseId: course.id,
      courseName: course.name,
    })
    const link = origin ? `${origin}/register/student?${params.toString()}` : `/register/student?${params.toString()}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedCourseId(course.id)
      setTimeout(() => setCopiedCourseId(null), 1800)
      toast({ title: t("courses.copied"), description: `${t("courses.registrationLinkCopiedFor")} "${course.name}"` })
    } catch {
      toast({ title: t("courses.error"), description: t("courses.copyFailed"), variant: "destructive" })
    }
  }

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-3">
        <PageHeader
          title={t("courses.title")}
          description={
            isLinkedTeacher && !isAdmin
              ? t("courses.myAssigned")
              : t("courses.manageAll")
          }
        />

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          {/* View Toggle */}
          <div className="flex border rounded-lg overflow-hidden" aria-label="תצוגה">
            <Button 
              variant={viewMode === "list" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none gap-1"
              title="תצוגת רשימה (טבלה)"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">רשימה</span>
            </Button>
            <Button 
              variant={viewMode === "grid" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-none gap-1"
              title="תצוגת כרטיסים"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">כרטיסים</span>
            </Button>
          </div>

          {canEditCourses && (
            <Link href="/dashboard/courses/new">
              <Button className="gap-2 bg-primary">
                <Plus className="h-4 w-4" />
                {t("courses.newCourse")}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("courses.searchPlaceholder")}
            className="w-full min-w-0 text-right sm:max-w-md"
            dir="rtl"
          />
          <Button variant="outline" onClick={load} className="w-full shrink-0 gap-2 bg-transparent sm:w-auto">
            <RefreshCw className="h-4 w-4" />
            {t("courses.refresh")}
          </Button>
          <div className="flex w-full flex-wrap items-center justify-center gap-1 rounded-lg border p-1 sm:w-auto sm:justify-start">
            <Button
              variant={statusFilter === "active" ? "default" : "ghost"}
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => setStatusFilter("active")}
            >
              {t("courses.status.active")}
            </Button>
            <Button
              variant={statusFilter === "all" ? "default" : "ghost"}
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => setStatusFilter("all")}
            >
              הכל
            </Button>
            <Button
              variant={statusFilter === "completed" ? "default" : "ghost"}
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => setStatusFilter("completed")}
            >
              {t("courses.status.completed")}
            </Button>
          </div>
          <div className="w-full text-center text-sm text-muted-foreground sm:mr-auto sm:w-auto sm:text-right">
            {t("courses.total")}: {filtered.length} {t("courses.title")}
          </div>
        </div>
      </Card>

      {/* Content */}
      {pageBusy ? (
        <div className="text-muted-foreground text-center py-12">{t("nav.loading")}</div>
      ) : err ? (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="text-red-700 font-semibold">{t("courses.error")}</div>
          <div className="text-red-700/80 mt-1">{err}</div>
          <div className="mt-4">
            <Button variant="outline" onClick={load}>{t("courses.retry")}</Button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <div className="text-lg">{isLinkedTeacher && !isAdmin ? t("courses.noneAssigned") : t("courses.none")}</div>
          {canEditCourses && (
            <Link href="/dashboard/courses/new">
              <Button className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                {t("courses.addFirst")}
              </Button>
            </Link>
          )}
        </Card>
      ) : viewMode === "list" ? (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => {
              const statusPres = getCourseStatusPresentation({ status: c.status, endDate: c.endDate })
              return (
                <Card key={c.id} className="overflow-hidden p-4">
                  <div className="flex flex-col gap-3 text-right">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-snug">{c.name}</div>
                        {c.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                        ) : null}
                      </div>
                      <Badge className={cn("w-fit shrink-0", statusPres.badgeClassName)}>
                        {t(`courses.status.${statusPres.key}`) || statusPres.labelHe}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        <span className="block text-xs opacity-80">{t("courses.students")}</span>
                        <span className="font-medium text-foreground">{c.enrollmentCount || 0}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs opacity-80">{t("courses.hours")}</span>
                        <span className="font-medium text-foreground break-words">
                          {c.startTime && c.endTime ? `${c.startTime} - ${c.endTime}` : "—"}
                        </span>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <span className="block text-xs opacity-80">{t("courses.teachers")}</span>
                        <span className="font-medium text-foreground break-words">{getTeacherNames(c.teacherIds) || "—"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      {canDeleteCourses && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-500 hover:bg-red-50 hover:text-red-700 bg-transparent"
                          onClick={() => remove(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canEditCourses && (
                        <Link href={`/dashboard/courses/${c.id}/edit`}>
                          <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                            <Pencil className="h-4 w-4" />
                            {t("courses.edit")}
                          </Button>
                        </Link>
                      )}
                      {canViewCourses && (
                        <Link href={`/dashboard/courses/${c.id}`}>
                          <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                            <Eye className="h-4 w-4" />
                            {t("courses.view")}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs sm:text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-right">
                    <th className="px-2 py-3 font-semibold sm:px-4">{t("courses.title")}</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">סטטוס</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">{t("courses.students")}</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">{t("courses.teachers")}</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">{t("courses.hours")}</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const statusPres = getCourseStatusPresentation({ status: c.status, endDate: c.endDate })
                    return (
                      <tr key={c.id} className="border-t">
                        <td className="px-2 py-3 sm:px-4">
                          <div className="font-medium">{c.name}</div>
                          {c.description ? <div className="text-xs text-muted-foreground">{c.description}</div> : null}
                        </td>
                        <td className="px-2 py-3 sm:px-4">
                          <Badge className={statusPres.badgeClassName}>
                            {t(`courses.status.${statusPres.key}`) || statusPres.labelHe}
                          </Badge>
                        </td>
                        <td className="px-2 py-3 sm:px-4">{c.enrollmentCount || 0}</td>
                        <td className="px-2 py-3 sm:px-4">{getTeacherNames(c.teacherIds) || "-"}</td>
                        <td className="px-2 py-3 sm:px-4">{c.startTime && c.endTime ? `${c.startTime} - ${c.endTime}` : "-"}</td>
                        <td className="px-2 py-3 sm:px-4">
                          <div className="flex gap-2">
                            {canDeleteCourses && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 bg-transparent"
                                onClick={() => remove(c.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canEditCourses && (
                              <Link href={`/dashboard/courses/${c.id}/edit`}>
                                <Button variant="outline" size="icon" className="bg-transparent">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            {canViewCourses && (
                              <Link href={`/dashboard/courses/${c.id}`}>
                                <Button variant="outline" size="icon" className="bg-transparent">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const isTotalPriceMode = isTotalCoursePricingType(c.courseType)
            const totalExpected = Number(expectedByCourse[c.id] ?? (isTotalPriceMode
              ? (c.price || 0)
              : (c.enrollmentCount || 0) * (c.price || 0)))
            const remaining = totalExpected - (c.totalPaid || 0)
            const statusPres = getCourseStatusPresentation({
              status: c.status,
              endDate: c.endDate,
            })
            const sessionsLabel = displaySessionsOnCourseCard(c)
            return (
            <Card
              key={c.id}
              className={cn("p-5 space-y-4 hover:shadow-lg transition-shadow", statusPres.cardClassName)}
            >
              {/* Header with status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 text-right">
                  <h3 className="font-bold text-lg">{c.name}</h3>
                  {c.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                  )}
                </div>
                <Badge className={statusPres.badgeClassName}>{t(`courses.status.${statusPres.key}`) || statusPres.labelHe}</Badge>
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-sm">
                {/* Students count */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span>{c.enrollmentCount || 0} {t("courses.students")}</span>
                </div>

                {/* Duration / meeting count */}
                {sessionsLabel && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>{sessionsLabel}</span>
                  </div>
                )}

                {/* Days */}
                {c.daysOfWeek && c.daysOfWeek.length > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span>{getDaysLabel(c.daysOfWeek)}</span>
                  </div>
                )}

                {/* Teachers */}
                {getTeacherNames(c.teacherIds) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 text-purple-500" />
                    <span>{getTeacherNames(c.teacherIds)}</span>
                  </div>
                )}
              </div>

              {/* Payment status - only for users with courses.financial */}
              {canSeeFinancial && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-green-600 text-xs mb-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{t("courses.paid")}</span>
                    </div>
                    <div className="font-bold text-green-700">{c.paidCount || 0}/{c.enrollmentCount || 0}</div>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${
                    remaining > 0
                      ? "bg-red-50" 
                      : "bg-green-50"
                  }`}>
                    <div className={`flex items-center justify-center gap-1 text-xs mb-1 ${
                      remaining > 0
                        ? "text-red-600" 
                        : "text-green-600"
                    }`}>
                      <AlertCircle className="h-3 w-3" />
                      <span>{t("courses.remaining")}</span>
                    </div>
                    <div className={`font-bold ${
                      remaining > 0
                        ? "text-red-700" 
                        : "text-green-700"
                    }`}>
                      {remaining.toLocaleString()}₪
                    </div>
                  </div>
                </div>
              )}

              {/* Price and dates */}
              <div className="border-t pt-3 space-y-2">
                {canSeeFinancial && c.price != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-primary">{c.price}₪</span>
                    <span className="text-sm text-muted-foreground">
                      {isTotalPriceMode ? t("courses.totalCoursePrice") : t("courses.pricePerStudent")}
                    </span>
                  </div>
                )}
                
                {(c.startDate || c.endDate) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatDate(c.startDate)} - {formatDate(c.endDate)}
                    </span>
                    <span className="text-muted-foreground">{t("courses.dates")}:</span>
                  </div>
                )}

                {(c.startTime || c.endTime) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {c.startTime} - {c.endTime}
                    </span>
                    <span className="text-muted-foreground">{t("courses.hours")}:</span>
                  </div>
                )}
              </div>

              {/* Action buttons - ערוך ומחיקה רק למי שיש לו הרשאה */}
              <div className="flex gap-2 pt-2">
                {canDeleteCourses && (
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 bg-transparent"
                    onClick={() => remove(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {canEditCourses && (
                  <Link href={`/dashboard/courses/${c.id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full gap-2 bg-transparent">
                      <Pencil className="h-4 w-4" />
                      {t("courses.edit")}
                    </Button>
                  </Link>
                )}
                {canViewCourses && (
                  <Link href={`/dashboard/courses/${c.id}`} className="flex-1">
                    <Button variant="outline" className="w-full gap-2 bg-transparent">
                      <Eye className="h-4 w-4" />
                      {t("courses.view")}
                    </Button>
                  </Link>
                )}
              </div>

              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={() => copyCourseRegistrationLink(c)}
              >
                {copiedCourseId === c.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copiedCourseId === c.id ? t("courses.copiedShort") : t("courses.copyRegistrationLink")}
              </Button>
            </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
