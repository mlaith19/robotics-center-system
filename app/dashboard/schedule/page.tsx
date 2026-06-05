"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, Filter, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, hasFullAccessRole } from "@/lib/permissions"
import { arrayFetcher } from "@/lib/swr-fetcher"
import { useUserType } from "@/lib/use-user-type"
import { useLanguage } from "@/lib/i18n/context"

interface Course {
  id: string
  name: string
  description?: string
  level?: string
  price?: number
  startTime?: string
  endTime?: string
  startDate?: string
  endDate?: string
  weekdays?: string[]
  daysOfWeek?: string[]
  teachers?: { id: string; name: string }[]
  teacherIds?: string[]
  students?: number
  enrollmentCount?: number
  showRegistrationLink?: boolean
  /** מפגש קייטנה (משבצת × כיתה) */
  isCampSlot?: boolean
  campAssignmentId?: string
  campSessionDate?: string
  campLessonTitle?: string
  campGroupLabel?: string
  campRoomLabel?: string
  campCourseId?: string
}

interface CampScheduleEvent {
  assignmentId: string
  sessionDate: string
  slotStart: string | null
  slotEnd: string | null
  lessonTitle: string
  courseId: string
  courseName: string
  classroomNo: number
  classLabel: string
  groupLabels: string[]
  teacherIds: string[]
  teacherNames: string[]
}

interface Student {
  id: string
  firstName: string
  lastName: string
}

const weekdayToNumber: Record<string, number> = {
  ראשון: 0,
  שני: 1,
  שלישי: 2,
  רביעי: 3,
  חמישי: 4,
  שישי: 5,
  שבת: 6,
}

// מיפוי מאנגלית לעברית ולהיפך
const englishToHebrew: Record<string, string> = {
  sunday: "ראשון",
  monday: "שני",
  tuesday: "שלישי",
  wednesday: "רביעי",
  thursday: "חמישי",
  friday: "שישי",
  saturday: "שבת",
}

const hebrewToEnglish: Record<string, string> = {
  ראשון: "sunday",
  שני: "monday",
  שלישי: "tuesday",
  רביעי: "wednesday",
  חמישי: "thursday",
  שישי: "friday",
  שבת: "saturday",
}

function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function normalizeCourseDays(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean)
  if (typeof raw === "string") {
    const s = raw.trim()
    if (!s) return []
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean)
    } catch {}
    return s.split(",").map((v) => v.trim()).filter(Boolean)
  }
  return []
}

const hebrewToArabic: Record<string, string> = {
  ראשון: "الأحد",
  שני: "الاثنين",
  שלישי: "الثلاثاء",
  רביעי: "الأربعاء",
  חמישי: "الخميس",
  שישי: "الجمعة",
  שבת: "السبت",
}

function displayDayLabel(day: string, locale: "he" | "en" | "ar"): string {
  const d = String(day || "").trim()
  if (!d) return d
  const lower = d.toLowerCase()
  const heb = englishToHebrew[lower] || d
  if (locale === "he") return heb
  if (locale === "ar") return hebrewToArabic[heb] || heb
  return hebrewToEnglish[heb] || lower
}

const courseColors = [
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", hover: "hover:border-blue-500" },
  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", hover: "hover:border-purple-500" },
  { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", hover: "hover:border-green-500" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", hover: "hover:border-orange-500" },
  { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300", hover: "hover:border-pink-500" },
  { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300", hover: "hover:border-teal-500" },
  { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300", hover: "hover:border-indigo-500" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300", hover: "hover:border-amber-500" },
]


export default function SchedulePage() {
  const currentUser = useCurrentUser()
  const { locale } = useLanguage()
  const userPerms = currentUser?.permissions ?? []
  const isAdmin = hasFullAccessRole(currentUser?.roleKey) || hasFullAccessRole(currentUser?.role)
  const canViewStudents = isAdmin || hasPermission(userPerms, "students.view")
  const { data: userTypeData } = useUserType(currentUser?.id, (currentUser?.roleKey || currentUser?.role || "").toString())
  const isLinkedTeacher = userTypeData?.isTeacher === true
  const isStudentUser = userTypeData?.isStudent === true
  const studentCourseIds = useMemo(() => new Set(userTypeData?.courseIds || []), [userTypeData?.courseIds])
  const currentTeacherId = userTypeData?.teacherId
  const isTeacherOnlyView = !isAdmin && isLinkedTeacher

  const { data: rawCourses,  isLoading: coursesLoading  } = useSWR<Course[]>(
    "/api/courses",
    arrayFetcher,
    { refreshInterval: 15000, revalidateOnFocus: true, revalidateOnReconnect: true },
  )
  const { data: rawStudents, isLoading: studentsLoading } = useSWR<Student[]>(
    canViewStudents ? "/api/students" : null,
    arrayFetcher,
  )
  const courses  = Array.isArray(rawCourses)  ? rawCourses  : []
  const students = Array.isArray(rawStudents) ? rawStudents : []
  const coursesForUser = useMemo(() => {
    if (isAdmin) return courses
    if (isStudentUser) {
      return courses.filter((c) => studentCourseIds.has(c.id))
    }
    if (!isLinkedTeacher) return courses
    const ids = new Set(userTypeData?.courseIds || [])
    const teacherId = userTypeData?.teacherId
    // Fallback חשוב: יש מקרים ש-courseIds לא חוזר מיד מהשרת, אבל teacherId כן.
    // לכן נבדוק גם שיוך ישיר לפי teacherIds בתוך הקורס.
    return courses.filter((c) => {
      if (ids.has(c.id)) return true
      if (!teacherId) return false
      const tIds = Array.isArray(c.teacherIds) ? c.teacherIds : []
      return tIds.includes(teacherId)
    })
  }, [courses, isAdmin, isLinkedTeacher, isStudentUser, studentCourseIds, userTypeData?.courseIds, userTypeData?.teacherId])

  const availableRegistrationCourses = useMemo(() => {
    if (!isStudentUser) return []
    return courses.filter((c) => c.showRegistrationLink === true && !studentCourseIds.has(c.id))
  }, [courses, isStudentUser, studentCourseIds])

  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("month")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [filterCourse, setFilterCourse] = useState<string>("all")
  const [filterTeacher, setFilterTeacher] = useState<string>("all")
  useEffect(() => {
    if (!isTeacherOnlyView || !currentTeacherId) return
    setFilterTeacher(currentTeacherId)
  }, [isTeacherOnlyView, currentTeacherId])

  const [filterStudent, setFilterStudent] = useState<string>("all")

  const canSeeFinancial = !!isAdmin || hasPermission(userPerms, "courses.financial")
  const canViewSchedule = isAdmin || hasPermission(userPerms, "schedule.view")

  const scheduleRange = useMemo(() => {
    if (viewMode === "day") {
      const d = ymd(currentDate)
      return { start: d, end: d }
    }
    if (viewMode === "week") {
      const start = new Date(currentDate)
      const day = start.getDay()
      start.setDate(start.getDate() - day)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      return { start: ymd(start), end: ymd(end) }
    }
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    return { start: ymd(first), end: ymd(last) }
  }, [viewMode, currentDate])

  const campEventsUrl =
    canViewSchedule && scheduleRange.start && scheduleRange.end
      ? `/api/schedule/camp-events?start=${encodeURIComponent(scheduleRange.start)}&end=${encodeURIComponent(scheduleRange.end)}${
          filterStudent !== "all" && canViewStudents ? `&studentId=${encodeURIComponent(filterStudent)}` : ""
        }`
      : null

  const { data: campPack, isLoading: campEventsLoading } = useSWR<{ events: CampScheduleEvent[] }>(
    campEventsUrl,
    async (url) => {
      const r = await fetch(url)
      if (!r.ok) return { events: [] }
      return r.json()
    },
    { revalidateOnFocus: true, refreshInterval: 60000 },
  )
  const campEvents = Array.isArray(campPack?.events) ? campPack.events : []

  const courseColorMap = useMemo(() => {
    const colorMap: Record<string, number> = {}
    courses.forEach((course, index) => {
      colorMap[course.id] = index % courseColors.length
    })
    return colorMap
  }, [courses])

  const getCourseColor = (courseId: string) => {
    const colorIndex = courseColorMap[courseId] || 0
    return courseColors[colorIndex]
  }
  const getTeacherColor = (course: Course) => {
    const teacherId = course.teachers?.[0]?.id
    if (!teacherId) return getCourseColor(course.id)
    const colorIndex = teacherColorMap[teacherId] ?? 0
    return courseColors[colorIndex]
  }

  const teachers = useMemo(() => {
    const uniqueTeachers: { id: string; name: string }[] = []
    const seenIds = new Set<string>()
    coursesForUser.forEach((course) => {
      if (course.teachers && Array.isArray(course.teachers)) {
        course.teachers.forEach((teacher) => {
          if (!seenIds.has(teacher.id)) {
            seenIds.add(teacher.id)
            uniqueTeachers.push({ id: teacher.id, name: teacher.name })
          }
        })
      }
    })
    return uniqueTeachers
  }, [coursesForUser])

  const teacherColorMap = useMemo(() => {
    const colorMap: Record<string, number> = {}
    teachers.forEach((teacher, index) => {
      colorMap[teacher.id] = index % courseColors.length
    })
    return colorMap
  }, [teachers])

  const filteredCourses = useMemo(() => {
    return coursesForUser.filter((course) => {
      if (isTeacherOnlyView && currentTeacherId) {
        const hasViaTeachers = Array.isArray(course.teachers) && course.teachers.some((t) => t.id === currentTeacherId)
        const ids = Array.isArray(course.teacherIds) ? course.teacherIds : []
        const hasViaIds = ids.includes(currentTeacherId)
        if (!hasViaTeachers && !hasViaIds) return false
      }
      if (filterCourse !== "all" && course.id !== filterCourse) return false
      if (filterTeacher !== "all") {
        if (!course.teachers || !course.teachers.some((t) => t.id === filterTeacher)) {
          return false
        }
      }
      return true
    })
  }, [coursesForUser, filterCourse, filterTeacher, isTeacherOnlyView, currentTeacherId])

  function campCoursesForDate(date: Date): Course[] {
    const dateYmd = ymd(date)
    return campEvents
      .filter((e) => e.sessionDate === dateYmd)
      .filter((e) => {
        if (filterCourse !== "all" && e.courseId !== filterCourse) return false
        if (filterTeacher !== "all" && !e.teacherIds.includes(filterTeacher)) return false
        return true
      })
      .map((e) => {
        const title =
          e.lessonTitle?.trim() ?
            `${e.lessonTitle.trim()} · ${e.courseName}`
          : `${e.courseName} · ${(e.groupLabels || []).join(", ")}`
        return {
          id: `camp-${e.assignmentId}`,
          name: title,
          description: [`כיתה: ${e.classLabel || `כיתה ${e.classroomNo}`}`, (e.groupLabels || []).length ? `קבוצות: ${(e.groupLabels || []).join(", ")}` : ""].filter(Boolean).join(" · "),
          startTime: e.slotStart,
          endTime: e.slotEnd,
          startDate: e.sessionDate,
          endDate: e.sessionDate,
          teachers: (e.teacherIds || []).map((id, idx) => ({ id, name: e.teacherNames?.[idx] || "מורה" })),
          isCampSlot: true,
          campAssignmentId: e.assignmentId,
          campSessionDate: e.sessionDate,
          campLessonTitle: e.lessonTitle,
          campGroupLabel: (e.groupLabels || []).join(", "),
          campRoomLabel: e.classLabel || `כיתה ${e.classroomNo}`,
          campCourseId: e.courseId,
        } satisfies Course
      })
  }

  const getCoursesForDate = (date: Date) => {
    const dayOfWeek = date.getDay()
    const dayName = Object.keys(weekdayToNumber).find((key) => weekdayToNumber[key] === dayOfWeek)
    const dateYmd = ymd(date)

    const regular = filteredCourses.filter((course) => {
      if (!dayName) return false
      
      // בדוק גם weekdays וגם daysOfWeek (תאימות לאחור)
      const courseDays = normalizeCourseDays(course.weekdays ?? course.daysOfWeek ?? [])
      
      // בדוק אם הקורס פעיל בתאריך הנתון
      const startYmd = course.startDate ? ymd(new Date(course.startDate)) : null
      const endYmd = course.endDate ? ymd(new Date(course.endDate)) : null
      if (startYmd && endYmd) {
        const minYmd = startYmd <= endYmd ? startYmd : endYmd
        const maxYmd = startYmd <= endYmd ? endYmd : startYmd
        if (dateYmd < minYmd || dateYmd > maxYmd) return false
      } else if (startYmd) {
        if (dateYmd < startYmd) return false
      } else if (endYmd) {
        if (dateYmd > endYmd) return false
      }
      
      // אם לא הוגדרו ימים בכלל — נאפשר הופעה לפי טווח תאריכים בלבד.
      if (courseDays.length === 0) return true

      // בדוק התאמה - תמיכה בשמות באנגלית ובעברית
      const dayNameEnglish = hebrewToEnglish[dayName] || dayName.toLowerCase()
      const matchesDay = courseDays.some((d: string) => {
        const dayLower = d.toLowerCase()
        return dayLower === dayNameEnglish || dayLower === dayName || englishToHebrew[dayLower] === dayName
      })
      
      if (!matchesDay) {
        return false
      }
      return true
    })
    const camp = campCoursesForDate(date)
    return [...regular, ...camp]
  }

  const getWeekDates = () => {
    const start = new Date(currentDate)
    const day = start.getDay()
    start.setDate(start.getDate() - day)

    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const handlePrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() - 1)
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + 1)
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course)
    setDialogOpen(true)
  }

  const renderDayView = () => {
    const dayCourses = getCoursesForDate(currentDate)
    const hours = Array.from({ length: 14 }, (_, i) => i + 8)

    return (
      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/50 p-3 sm:p-4">
          <div className="text-base font-semibold sm:text-lg">
            {currentDate.toLocaleDateString("he-IL", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
        <div className="divide-y">
          {hours.map((hour) => {
            const hourCourses = dayCourses.filter((course) => {
              if (!course.startTime) return false
              const [startHour] = course.startTime.split(":").map(Number)
              return Number.isFinite(startHour) && startHour === hour
            })

            return (
              <div key={hour} className="flex min-h-[72px] sm:min-h-[80px]">
                <div className="w-14 shrink-0 border-l bg-muted/30 p-2 text-xs font-medium text-muted-foreground sm:w-20 sm:p-4 sm:text-sm">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                <div className="min-w-0 flex-1 p-2">
                  {hourCourses.length > 0 ? (
                    <div className="space-y-2">
                      {hourCourses.map((course) => {
                        const colors = getTeacherColor(course)
                        return (
                          <Card
                            key={course.id}
                            className={`p-3 cursor-pointer transition-colors border-2 ${colors.bg} ${colors.border} ${colors.hover}`}
                            onClick={() => handleCourseClick(course)}
                          >
                            <div className={`font-semibold text-sm mb-1 ${colors.text}`}>{course.name}</div>
                            <div className={`text-xs ${colors.text} opacity-80`}>
                              {course.startTime} - {course.endTime} • {course.teachers?.map((t) => t.name).join(", ")}
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">-</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const weekDates = getWeekDates()
    const hours = Array.from({ length: 14 }, (_, i) => i + 8)

    return (
      <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="min-w-[720px] overflow-hidden rounded-lg border">
        <div className="grid grid-cols-8 border-b bg-muted/50">
          <div className="border-l p-2 sm:p-3"></div>
          {weekDates.map((date, i) => (
            <div key={i} className="border-l p-2 text-center sm:p-3">
              <div className="text-xs font-medium sm:text-sm">{date.toLocaleDateString("he-IL", { weekday: "short" })}</div>
              <div className="mt-0.5 text-base font-bold sm:mt-1 sm:text-lg">{date.getDate()}</div>
            </div>
          ))}
        </div>
        <div className="divide-y">
          {hours.map((hour) => (
            <div key={hour} className="grid min-h-[72px] grid-cols-8 sm:min-h-[80px]">
              <div className="flex items-start border-l bg-muted/30 p-2 text-xs font-medium text-muted-foreground sm:p-3 sm:text-sm">
                {hour.toString().padStart(2, "0")}:00
              </div>
              {weekDates.map((date, i) => {
                const dayCourses = getCoursesForDate(date).filter((course) => {
                  if (!course.startTime) return false
                  const [startHour] = course.startTime.split(":").map(Number)
                  return Number.isFinite(startHour) && startHour === hour
                })

                return (
                  <div key={i} className="min-w-0 border-l p-1">
                    {dayCourses.length > 0 ? (
                      <div className="space-y-1">
                        {dayCourses.map((course) => {
                          const colors = getTeacherColor(course)
                          return (
                            <Card
                              key={course.id}
                              className={`p-2 cursor-pointer transition-colors text-xs border-2 ${colors.bg} ${colors.border} ${colors.hover}`}
                              onClick={() => handleCourseClick(course)}
                            >
                              <div className={`font-semibold truncate ${colors.text}`}>{course.name}</div>
                              <div className={`truncate ${colors.text} opacity-80`}>
                                {course.startTime}-{course.endTime}
                              </div>
                            </Card>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: (Date | null)[] = []
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    return (
      <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="min-w-[560px] overflow-hidden rounded-lg border">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"].map((day) => (
            <div key={day} className="border-l p-1.5 text-center text-[11px] font-medium sm:p-3 sm:text-sm">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date, i) => {
            const dayCourses = date ? getCoursesForDate(date) : []
            const isToday = date && date.toDateString() === new Date().toDateString()

            return (
              <div
                key={i}
                className={`min-h-[88px] border-b border-l p-1 sm:min-h-[120px] sm:p-2 ${!date ? "bg-muted/20" : ""} ${
                  isToday ? "bg-primary/5" : ""
                }`}
              >
                {date && (
                  <>
                    <div
                      className={`mb-1 text-xs font-medium sm:mb-2 sm:text-sm ${
                        isToday
                          ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground sm:h-7 sm:w-7"
                          : ""
                      }`}
                    >
                      {date.getDate()}
                    </div>
                    {dayCourses.length > 0 && (
                      <div className="space-y-1">
                        {dayCourses.slice(0, 3).map((course) => {
                          const colors = getTeacherColor(course)
                          return (
                            <div
                              key={course.id}
                              className={`cursor-pointer truncate rounded border p-1 text-[10px] transition-colors sm:p-1.5 sm:text-xs ${colors.bg} ${colors.text} ${colors.border} ${colors.hover}`}
                              onClick={() => handleCourseClick(course)}
                            >
                              {course.startTime} {course.name}
                            </div>
                          )
                        })}
                        {dayCourses.length > 3 && (
                          <div className="px-0.5 text-[10px] text-muted-foreground sm:text-xs sm:px-1">+{dayCourses.length - 3} עוד</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
        </div>
      </div>
    )
  }

  if (coursesLoading || (canViewStudents && studentsLoading) || (canViewSchedule && campEventsLoading)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-3 sm:p-6" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="לוח זמנים" description="צפה ונהל את לוח המפגשים" />
        <div className="shrink-0 text-right text-base font-semibold sm:text-xl">
          {viewMode === "month"
            ? currentDate.toLocaleDateString("he-IL", { year: "numeric", month: "long" })
            : currentDate.toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={viewMode === "day" ? "default" : "outline"} size="sm" onClick={() => setViewMode("day")}>
              יום
            </Button>
            <Button variant={viewMode === "week" ? "default" : "outline"} size="sm" onClick={() => setViewMode("week")}>
              שבוע
            </Button>
            <Button variant={viewMode === "month" ? "default" : "outline"} size="sm" onClick={() => setViewMode("month")}>
              חודש
            </Button>
          </div>

          <div className="flex w-full items-center gap-2 sm:mr-0 sm:w-auto lg:mr-4">
            <Button variant="outline" size="icon" className="shrink-0" onClick={handlePrevious} aria-label="תקופה קודמת">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="shrink-0" onClick={handleNext} aria-label="תקופה הבאה">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="min-w-0 flex-1 sm:flex-initial" onClick={handleToday}>
              היום
            </Button>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch lg:max-w-none lg:justify-end">
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-full sm:w-[min(100%,180px)]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="כל הקורסים" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הקורסים</SelectItem>
              {coursesForUser.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isTeacherOnlyView && (
            <Select value={filterTeacher} onValueChange={setFilterTeacher}>
              <SelectTrigger className="w-full sm:w-[min(100%,180px)]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="כל המורים" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המורים</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {canViewStudents && (
            <Select value={filterStudent} onValueChange={setFilterStudent}>
              <SelectTrigger className="w-full sm:w-[min(100%,180px)]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="כל התלמידים" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל התלמידים</SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.firstName} {student.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isStudentUser && (
        <Card className="border-blue-200 bg-blue-50/40 p-3 sm:p-4">
          {availableRegistrationCourses.length > 0 ? (
            <>
              <div className="mb-2 font-semibold">קורסים פתוחים להרשמה</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {availableRegistrationCourses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/register/student?courseId=${encodeURIComponent(course.id)}&courseName=${encodeURIComponent(course.name)}`}
                    className="inline-flex w-full items-center justify-center rounded-md border border-blue-300 bg-white px-3 py-2 text-center text-sm hover:bg-blue-50 sm:w-auto sm:py-1.5"
                  >
                    הרשמה ל-{course.name}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm font-medium text-muted-foreground">הרישום נסגר לקורס זה</div>
          )}
        </Card>
      )}

      {viewMode === "day" && renderDayView()}
      {viewMode === "week" && renderWeekView()}
      {viewMode === "month" && renderMonthView()}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl">{selectedCourse?.name}</DialogTitle>
            <DialogDescription className="text-pretty">{selectedCourse?.description}</DialogDescription>
          </DialogHeader>
          {selectedCourse && selectedCourse.isCampSlot ? (
            <div className="space-y-4 py-2 sm:py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">תאריך</div>
                  <div className="font-medium">
                    {selectedCourse.campSessionDate ?
                      new Date(selectedCourse.campSessionDate).toLocaleDateString("he-IL")
                    : "—"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">שעות</div>
                  <div className="font-medium">
                    {selectedCourse.startTime || "—"} – {selectedCourse.endTime || "—"}
                  </div>
                </div>
              </div>
              {selectedCourse.campLessonTitle?.trim() ? (
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">שם שיעור</div>
                  <div className="font-medium">{selectedCourse.campLessonTitle}</div>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">כיתה</div>
                  <div className="font-medium">{selectedCourse.campRoomLabel || "—"}</div>
                </div>
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">קבוצה</div>
                  <div className="font-medium">{selectedCourse.campGroupLabel || "—"}</div>
                </div>
              </div>
              <div>
                <div className="mb-1 text-sm text-muted-foreground">מורה</div>
                <div className="font-medium">{selectedCourse.teachers?.map((t) => t.name).join(", ") || "לא צוין"}</div>
              </div>
              {selectedCourse.campCourseId ? (
                <div className="pt-2">
                  <Link href={`/dashboard/courses/${selectedCourse.campCourseId}`} className="text-sm text-primary underline">
                    פתח קורס
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
          {selectedCourse && !selectedCourse.isCampSlot && (
            <div className="space-y-4 py-2 sm:py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">מורים</div>
                  <div className="font-medium">
                    {selectedCourse.teachers?.map((t) => t.name).join(", ") || "לא צוין"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">רמה</div>
                  <div className="font-medium">{selectedCourse.level || "לא צוין"}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">תאריכים</div>
                  <div className="font-medium text-sm">
                    {selectedCourse.startDate ? new Date(selectedCourse.startDate).toLocaleDateString("he-IL") : "-"} -{" "}
                    {selectedCourse.endDate ? new Date(selectedCourse.endDate).toLocaleDateString("he-IL") : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">שעות</div>
                  <div className="font-medium">
                    {selectedCourse.startTime || "-"} - {selectedCourse.endTime || "-"}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">ימי שבוע</div>
                <div className="flex flex-wrap gap-2">
                  {(selectedCourse.weekdays || selectedCourse.daysOfWeek)?.map((day: string) => (
                    <span key={day} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                      {displayDayLabel(day, locale)}
                    </span>
                  )) || <span className="text-muted-foreground">לא צוין</span>}
                </div>
              </div>
              <div className={`grid gap-4 ${isStudentUser ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                {!isStudentUser && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">תלמידים</div>
                    <div className="font-medium">{selectedCourse.enrollmentCount || selectedCourse.students || 0}</div>
                  </div>
                )}
                {!isStudentUser && canSeeFinancial && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">מחיר</div>
                    <div className="font-medium text-lg text-primary">₪{selectedCourse.price || 0}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
