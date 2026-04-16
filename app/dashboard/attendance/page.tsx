"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CalendarIcon, Check, X, Thermometer, Plane, ArrowRight, AlertCircle, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import useSWR, { mutate } from "swr"
import { arrayFetcher } from "@/lib/swr-fetcher"
import { deleteWithUndo } from "@/lib/notify"
import { useCurrentUser } from "@/lib/auth-context"
import { hasFullAccessRole } from "@/lib/permissions"

type AttendanceType = "course" | "school" | "teacher" | "student"
type AttendanceStatus = "present" | "absent" | "sick" | "vacation"

interface Student {
  id: string
  name: string
  phone: string
  courseSessions?: Record<string, number>
}

interface Teacher {
  id: string
  name: string
  phone: string
}

interface Course {
  id: string
  name: string
  schoolId?: string | null
}

interface School {
  id: string
  name: string
}

interface Enrollment {
  id: string
  studentId: string
  courseId: string
  studentName?: string
}

export default function AttendancePage() {
  const router = useRouter()
  const currentUser = useCurrentUser()
  const isAdmin =
    hasFullAccessRole(currentUser?.roleKey) ||
    hasFullAccessRole(currentUser?.role)
  const roleToken = (currentUser?.roleKey ?? currentUser?.role ?? "").toString().trim().toLowerCase()
  const isTeacherSession = roleToken === "teacher" || roleToken.includes("teacher") || roleToken.includes("מורה")
  const [attendanceType, setAttendanceType] = useState<AttendanceType>("course")
  const [selectedId, setSelectedId] = useState<string>("")
  const [selectedCourseId, setSelectedCourseId] = useState<string>("") // For student type - which course
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("all")
  const [participantType, setParticipantType] = useState<"student" | "teacher">("student") // For course type - show students or teachers
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({})
  const [attendanceCreatedBy, setAttendanceCreatedBy] = useState<Record<string, string>>({})
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({})
  const [teacherStartTime, setTeacherStartTime] = useState<string>("")
  const [teacherEndTime, setTeacherEndTime] = useState<string>("")
  /** הוראה בקורס מול שעת משרד (תעריף מ־פרופיל תעריף) */
  const [teacherHourKind, setTeacherHourKind] = useState<"teaching" | "office">("teaching")
  const isCourseBasedAttendance = attendanceType === "course" || attendanceType === "school"
  const activeCourseId = attendanceType === "course" ? selectedId : selectedCourseId

  useEffect(() => {
    if (!isAdmin) {
      if (attendanceType === "teacher") setAttendanceType("course")
      if (participantType === "teacher") setParticipantType("student")
    }
  }, [isAdmin, attendanceType, participantType])

  // Fetch data from API
  const { data: rawStudents } = useSWR<Student[]>("/api/students", arrayFetcher)
  const { data: rawTeachers } = useSWR<Teacher[]>("/api/teachers", arrayFetcher)
  const { data: rawSchools } = useSWR<School[]>("/api/schools", arrayFetcher)
  const schoolFilterQuery = selectedSchoolId !== "all" ? `?schoolId=${encodeURIComponent(selectedSchoolId)}` : ""
  const { data: rawCourses  } = useSWR<Course[]>(`/api/courses${schoolFilterQuery}`,   arrayFetcher)
  const schools = Array.isArray(rawSchools) ? rawSchools : []
  const students = Array.isArray(rawStudents) ? rawStudents : []
  const teachers = Array.isArray(rawTeachers) ? rawTeachers : []
  const courses  = Array.isArray(rawCourses)  ? rawCourses  : []
  const schoolNameById = new Map((Array.isArray(rawSchools) ? rawSchools : []).map((s) => [s.id, s.name]))
  const teacherScopedCourseIds = Array.isArray(currentUser?.teacherCourseIds)
    ? (currentUser?.teacherCourseIds as string[])
    : null
  const teacherScopedSchools = new Set(
    (teacherScopedCourseIds
      ? courses.filter((c) => teacherScopedCourseIds.includes(String(c.id)))
      : courses
    )
      .map((c) => c.schoolId)
      .filter((id): id is string => !!id)
  )
  const availableSchools = schools.filter((school) =>
    teacherScopedSchools.size > 0
      ? teacherScopedSchools.has(school.id)
      : courses.some((course) => (course.schoolId ?? null) === school.id)
  )
  const coursesForSelectedSchool =
    attendanceType === "school" && selectedId
      ? courses.filter((course) => (course.schoolId ?? null) === selectedId)
      : courses
  const selectedCourseName =
    attendanceType === "school"
      ? courses.find((c) => c.id === selectedCourseId)?.name
      : courses.find((c) => c.id === selectedId)?.name

  // Fetch attendance history for selected course (all dates)
  const { data: rawAttendanceHistory } = useSWR<any[]>(
    activeCourseId && isCourseBasedAttendance ? `/api/attendance?courseId=${activeCourseId}` : null,
    arrayFetcher
  )
  const attendanceHistory = Array.isArray(rawAttendanceHistory) ? rawAttendanceHistory : []

  // Fetch enrollments for selected course
  const { data: rawEnrollments } = useSWR<Enrollment[]>(
    activeCourseId && isCourseBasedAttendance ? `/api/enrollments?courseId=${activeCourseId}` : null,
    arrayFetcher
  )
  const enrollments = Array.isArray(rawEnrollments) ? rawEnrollments : []

  // Fetch attendance for selected date and course/student
  const dateStr = selectedDate && !isNaN(selectedDate.getTime()) 
    ? format(selectedDate, "yyyy-MM-dd") 
    : format(new Date(), "yyyy-MM-dd")
  const { data: existingAttendance = [] } = useSWR(
    ((isCourseBasedAttendance && !!activeCourseId) || (!isCourseBasedAttendance && !!selectedId)) && selectedDate
      ? `/api/attendance?${isCourseBasedAttendance ? `courseId=${activeCourseId}` : `studentId=${selectedId}`}&date=${dateStr}`
      : null,
    arrayFetcher,
    {
      onSuccess: (data) => {
        // Convert array to record for easier lookup
        const attendanceRecord: Record<string, AttendanceStatus> = {}
        const createdByRecord: Record<string, string> = {}
        data.forEach((a: any) => {
          attendanceRecord[a.studentId] = a.status
          if (a.studentId) createdByRecord[a.studentId] = a.createdByUserName || "—"
        })
        setAttendanceData(attendanceRecord)
        setAttendanceCreatedBy(createdByRecord)
      },
    }
  )

  const getTableData = (): Student[] | Teacher[] => {
    // Always guard — if data hasn't loaded yet, return empty array
    const safeStudents = Array.isArray(students) ? students : []
    const safeTeachers = Array.isArray(teachers) ? teachers : []
    const safeEnrollments = Array.isArray(enrollments) ? enrollments : []

    if (isCourseBasedAttendance) {
      if (participantType === "student") {
        const enrolledStudentIds = safeEnrollments.map((e: Enrollment) => e.studentId)
        return safeStudents.filter((s: Student) => enrolledStudentIds.includes(s.id))
      } else {
        return isAdmin ? safeTeachers : []
      }
    } else if (attendanceType === "teacher") {
      return isAdmin ? safeTeachers.filter((t: Teacher) => t.id === selectedId) : []
    } else {
      return safeStudents.filter((s: Student) => s.id === selectedId)
    }
  }

  const handleStatusChange = async (personId: string, status: AttendanceStatus, courseIdOverride?: string) => {
    const previousStatus = attendanceData[personId]
    
    // Determine the correct courseId based on attendance type
    // For "course" type: selectedId IS the course
    // For "student" type: we need selectedCourseId (separate selection)
    // For "teacher" type: we need selectedCourseId as well
    const courseId = courseIdOverride || (attendanceType === "course" ? selectedId : selectedCourseId)
    
    if (!courseId) {
      // No course selected - silently return (UI should prevent this)
      return
    }
    
    // Optimistic update
    setAttendanceData((prev) => ({
      ...prev,
      [personId]: status,
    }))
    setSavingStatus((prev) => ({ ...prev, [personId]: true }))

    try {
      // Build request body based on attendance type
      const requestBody: Record<string, string | number> = {
        courseId,
        date: dateStr,
        status,
      }
      
      // Determine if this is teacher or student attendance
      const isTeacherAttendance = attendanceType === "teacher" || (isCourseBasedAttendance && participantType === "teacher")
      const parseTimeToMinutes = (timeStr: string): number | null => {
        const m = /^(\d{2}):(\d{2})$/.exec(timeStr)
        if (!m) return null
        const h = Number(m[1])
        const mm = Number(m[2])
        if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null
        return h * 60 + mm
      }
      
      if (isTeacherAttendance) {
        requestBody.teacherId = personId
        if (teacherHourKind === "office") {
          requestBody.hourKind = "office"
        }
        // Optional manual time range for teacher attendance; stored as calculated hours
        if (teacherStartTime && teacherEndTime) {
          const startMin = parseTimeToMinutes(teacherStartTime)
          const endMin = parseTimeToMinutes(teacherEndTime)
          if (startMin !== null && endMin !== null && endMin > startMin) {
            requestBody.hours = Number(((endMin - startMin) / 60).toFixed(2))
          }
        }
      } else {
        requestBody.studentId = personId
      }
      
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save attendance")
      }

      // Revalidate attendance data
      mutate(`/api/attendance?courseId=${courseId}&date=${dateStr}`)
    } catch (error) {
      // Revert on error
      setAttendanceData((prev) => ({
        ...prev,
        [personId]: previousStatus,
      }))
      console.error("Failed to save attendance:", error)
    } finally {
      setSavingStatus((prev) => ({ ...prev, [personId]: false }))
    }
  }

  const handleDelete = (personId: string) => {
    const courseId = attendanceType === "course" ? selectedId : selectedCourseId
    if (!courseId) return
    const prevStatus = attendanceData[personId]
    const isTeacherAttendance = attendanceType === "teacher" || (isCourseBasedAttendance && participantType === "teacher")
    const params = new URLSearchParams({
      courseId,
      date: dateStr,
      ...(isTeacherAttendance ? { teacherId: personId } : { studentId: personId }),
    })
    deleteWithUndo({
      entityKey: "attendance",
      itemId: personId,
      removeFromUI: () =>
        setAttendanceData((prev) => {
          const next = { ...prev }
          delete next[personId]
          return next
        }),
      restoreFn: () =>
        prevStatus !== undefined &&
        setAttendanceData((prev) => ({ ...prev, [personId]: prevStatus })),
      deleteFn: async () => {
        const res = await fetch(`/api/attendance?${params}`, { method: "DELETE", credentials: "include" })
        if (!res.ok) throw new Error("Failed to delete attendance")
        mutate(`/api/attendance?courseId=${courseId}&date=${dateStr}`)
        mutate(`/api/attendance?courseId=${activeCourseId}`)
      },
      confirmPolicy: "standard",
      undoWindowMs: 10_000,
    })
  }

  const getStatusButton = (personId: string, status: AttendanceStatus, label: string, icon: any) => {
    const Icon = icon
    const isActive = attendanceData[personId] === status
    const isSaving = savingStatus[personId]

    return (
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        onClick={() => handleStatusChange(personId, status)}
        disabled={isSaving}
        className={`min-h-[44px] flex-1 gap-1 px-2 text-[11px] sm:flex-initial sm:text-xs ${
          isActive
            ? status === "present"
              ? "bg-green-600 hover:bg-green-700"
              : status === "absent"
                ? "bg-red-600 hover:bg-red-700"
                : status === "sick"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-blue-600 hover:bg-blue-700"
            : "bg-transparent"
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Button>
    )
  }

  const tableData = getTableData()
  const selectedItem =
    attendanceType === "course"
      ? courses.find((c: Course) => c.id === selectedId)
      : attendanceType === "school"
        ? schools.find((s: School) => s.id === selectedId)
      : attendanceType === "teacher"
        ? teachers.find((t: Teacher) => t.id === selectedId)
        : students.find((s: Student) => s.id === selectedId)

  const getList = () => {
    if (attendanceType === "course") return courses
    if (attendanceType === "school") return schools
    if (attendanceType === "teacher") return teachers
    return students
  }

  const hasData = getList().length > 0

  return (
    <div className="flex w-full flex-col" dir="rtl">
      <div className="container mx-auto max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Button variant="ghost" size="icon" className="shrink-0 self-start sm:self-center" onClick={() => router.back()}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <PageHeader title="נוכחות" description="ניהול נוכחות לקורסים, מורים ותלמידים" />
        </div>

        {!hasData && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-900">אין נתונים זמינים</AlertTitle>
            <AlertDescription className="text-orange-800">
              לא נמצאו {attendanceType === "course" ? "קורסים" : attendanceType === "school" ? "בתי ספר" : attendanceType === "teacher" ? "מורים" : "תלמידים"}{" "}
              במערכת. הוסף נתונים דרך הדפים הרלוונטיים.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="px-3 text-right sm:px-6">
            <CardTitle className="flex flex-row-reverse items-center justify-end gap-2 text-base sm:text-lg">
              <CalendarIcon className="h-5 w-5 shrink-0 text-blue-600" />
              בחירת נוכחות
            </CardTitle>
            <CardDescription className="text-right">בחר סוג, פריט ותאריך לניהול נוכחות</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">סוג</label>
                <Select
                  value={attendanceType}
                  onValueChange={(value: AttendanceType) => {
                    setAttendanceType(value)
                    setSelectedId("")
                    setSelectedCourseId("")
                    setAttendanceData({})
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="בחר סוג" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">קורס</SelectItem>
                    {(!isTeacherSession || availableSchools.length > 0) && (
                      <SelectItem value="school">בתי ספר</SelectItem>
                    )}
                    {isAdmin && <SelectItem value="teacher">מורה</SelectItem>}
                    <SelectItem value="student">תלמיד</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {attendanceType !== "school" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">בית ספר</label>
                  <Select
                    value={selectedSchoolId}
                    onValueChange={(value) => {
                      setSelectedSchoolId(value)
                      setSelectedId("")
                      setSelectedCourseId("")
                      setAttendanceData({})
                    }}
                    disabled={availableSchools.length === 0}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={availableSchools.length > 0 ? "בחר בית ספר" : "אין בתי ספר זמינים"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל בתי הספר</SelectItem>
                      {availableSchools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {attendanceType === "course" ? "קורס" : attendanceType === "school" ? "בית ספר" : attendanceType === "teacher" ? "מורה" : "תלמיד"}
                </label>
                <Select 
                  value={selectedId} 
                  onValueChange={(value) => {
                    setSelectedId(value)
                    setAttendanceData({})
                  }} 
                  disabled={!hasData}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue
                      placeholder={
                        hasData
                          ? `בחר ${attendanceType === "course" ? "קורס" : attendanceType === "school" ? "בית ספר" : attendanceType === "teacher" ? "מורה" : "תלמיד"}`
                          : "אין נתונים"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {attendanceType === "course" &&
                      courses.map((course: Course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                          {course.schoolId ? ` — ${schoolNameById.get(course.schoolId) || "ללא בית ספר"}` : " — ללא בית ספר"}
                        </SelectItem>
                      ))}
                    {attendanceType === "school" &&
                      schools.map((school: School) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    {attendanceType === "teacher" &&
                      teachers.map((teacher: Teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    {attendanceType === "student" &&
                      students.map((student: Student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {isCourseBasedAttendance && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">סוג משתתף</label>
                  <Select
                    value={participantType}
                    onValueChange={(value: "student" | "teacher") => {
                      setParticipantType(value)
                      setAttendanceData({})
                    }}
                    disabled={attendanceType === "school" ? !selectedCourseId : !activeCourseId}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="בחר סוג משתתף" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">תלמידים</SelectItem>
                      {isAdmin && <SelectItem value="teacher">מורים</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(attendanceType === "student" || attendanceType === "teacher" || attendanceType === "school") && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">קורס</label>
                  <Select
                    value={selectedCourseId}
                    onValueChange={(value) => {
                      setSelectedCourseId(value)
                      setAttendanceData({})
                    }}
                    disabled={attendanceType === "school" ? !selectedId || coursesForSelectedSchool.length === 0 : !courses.length || !selectedId}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={selectedId ? "בחר קורס" : `בחר ${attendanceType === "school" ? "בית ספר" : attendanceType === "student" ? "תלמיד" : "מורה"} קודם`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(attendanceType === "school" ? coursesForSelectedSchool : courses).map((course: Course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                          {course.schoolId ? ` — ${schoolNameById.get(course.schoolId) || "ללא בית ספר"}` : " — ללא בית ספר"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(attendanceType === "teacher" || (isCourseBasedAttendance && participantType === "teacher")) && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">משעה</label>
                    <input
                      type="time"
                      value={teacherStartTime}
                      onChange={(e) => setTeacherStartTime(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">עד שעה</label>
                    <input
                      type="time"
                      value={teacherEndTime}
                      onChange={(e) => setTeacherEndTime(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-4">
                    <label className="text-sm font-medium">סוג שעה לחישוב שכר</label>
                    <Select
                      value={teacherHourKind}
                      onValueChange={(v) => setTeacherHourKind(v as "teaching" | "office")}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teaching">הוראה (לפי מיקום קורס ופרופיל)</SelectItem>
                        <SelectItem value="office">שעת משרד (תעריף מהגדרות פרופיל)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">תאריך</label>
                <input
                  type="date"
                  value={format(selectedDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value + "T12:00:00")
                    if (!isNaN(newDate.getTime())) {
                      setSelectedDate(newDate)
                      setAttendanceData({})
                    }
                  }}
                  disabled={!hasData}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedId && tableData.length > 0 && (isCourseBasedAttendance || selectedCourseId) && (
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="break-words text-base sm:text-lg">
                {isCourseBasedAttendance
                  ? `נוכחות קורס: ${selectedCourseName || "—"}`
                  : attendanceType === "teacher"
                    ? `נוכחות מורה: ${(selectedItem as Teacher)?.name}`
                    : `נוכחות תלמיד: ${(selectedItem as Student)?.name}`}
              </CardTitle>
              <CardDescription>{format(selectedDate, "dd MMMM yyyy", { locale: he })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6">
              {/* מובייל: כרטיסים */}
              <div className="flex flex-col gap-3 lg:hidden">
                {tableData.map((person: any) => (
                  <Card key={person.id} className="border bg-white shadow-sm">
                    <CardContent className="space-y-3 p-4 text-right">
                      <div>
                        <div className="font-semibold">{person.name}</div>
                        <div className="text-sm text-muted-foreground" dir="ltr">
                          {person.phone}
                        </div>
                        <div className="text-xs text-muted-foreground">{format(selectedDate, "dd/MM/yyyy")}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {getStatusButton(person.id, "present", "נוכח", Check)}
                        {getStatusButton(person.id, "absent", "לא נוכח", X)}
                        {getStatusButton(person.id, "sick", "חולה", Thermometer)}
                        {getStatusButton(person.id, "vacation", "חופש", Plane)}
                      </div>
                      <div className="flex flex-row-reverse items-center justify-between gap-2 border-t pt-2 text-sm">
                        <span className="text-muted-foreground">
                          {attendanceCreatedBy[person.id] || "—"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(person.id)}
                          disabled={!attendanceData[person.id]}
                          className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          מחק
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* דסקטופ: טבלה */}
              <div className="hidden overflow-x-auto rounded-md border bg-white lg:block">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right font-semibold">שם</TableHead>
                      <TableHead className="text-right font-semibold">טלפון</TableHead>
                      <TableHead className="text-right font-semibold">תאריך</TableHead>
                      <TableHead className="text-right font-semibold">סטטוס נוכחות</TableHead>
                      <TableHead className="text-right font-semibold">בוצע על ידי</TableHead>
                      <TableHead className="w-16 text-right font-semibold">מחיקה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((person: any) => (
                      <TableRow key={person.id}>
                        <TableCell className="font-medium">{person.name}</TableCell>
                        <TableCell className="text-muted-foreground">{person.phone}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(selectedDate, "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="min-w-[280px]">
                          <div className="flex flex-wrap gap-2">
                            {getStatusButton(person.id, "present", "נוכח", Check)}
                            {getStatusButton(person.id, "absent", "לא נוכח", X)}
                            {getStatusButton(person.id, "sick", "חולה", Thermometer)}
                            {getStatusButton(person.id, "vacation", "חופש", Plane)}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{attendanceCreatedBy[person.id] || "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(person.id)}
                            disabled={!attendanceData[person.id]}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedId && tableData.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center px-3 py-10 sm:px-6">
              <p className="text-center text-muted-foreground">
                {attendanceType === "course" ? "אין תלמידים רשומים לקורס זה" : "לא נמצאו נתונים"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Attendance History Table */}
        {activeCourseId && isCourseBasedAttendance && attendanceHistory.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="break-words text-base sm:text-lg">היסטוריית נוכחות - {selectedCourseName || "—"}</CardTitle>
              <CardDescription>כל הנוכחויות שנרשמו לקורס זה</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="max-h-[400px] overflow-auto rounded-md border bg-white">
                <Table className="min-w-[520px]">
                  <TableHeader className="sticky top-0 bg-white">
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right font-semibold">תאריך</TableHead>
                      <TableHead className="text-right font-semibold">סוג</TableHead>
                      <TableHead className="text-right font-semibold">שם</TableHead>
                      <TableHead className="text-right font-semibold">סטטוס</TableHead>
                      <TableHead className="text-right font-semibold">בוצע על ידי</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceHistory
                      .filter((record: any) => {
                        // Filter by participant type
                        if (participantType === "teacher") {
                          return !!record.teacherId
                        } else {
                          return !!record.studentId
                        }
                      })
                      .map((record: any) => {
                      const isTeacher = !!record.teacherId
                      const student = record.studentId ? students.find((s) => s.id === record.studentId) : null
                      const teacher = record.teacherId ? teachers.find((t) => t.id === record.teacherId) : null
                      const personName = isTeacher ? (teacher?.name || "לא ידוע") : (student?.name || "לא ידוע")
                      
                      const statusLabels: Record<string, { label: string; color: string }> = {
                        present: { label: "נוכח", color: "bg-green-100 text-green-700" },
                        absent: { label: "לא נוכח", color: "bg-red-100 text-red-700" },
                        sick: { label: "חולה", color: "bg-yellow-100 text-yellow-700" },
                        vacation: { label: "חופש", color: "bg-blue-100 text-blue-700" },
                      }
                      const statusInfo = statusLabels[record.status] || { label: record.status, color: "bg-gray-100" }
                      
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.date ? format(new Date(record.date), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isTeacher ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                              {isTeacher ? "מורה" : "תלמיד"}
                            </span>
                          </TableCell>
                          <TableCell>{personName}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{record.createdByUserName || "—"}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
