"use client"

import { useEffect } from "react"
import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowRight, User, Mail, Phone, Edit, ChevronLeft, Loader2, 
  MapPin, Calendar, CreditCard, Users, Heart, BookOpen 
} from "lucide-react"
import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, hasFullAccessRole } from "@/lib/permissions"
import { useUserType } from "@/lib/use-user-type"
import { StudentTabs } from "@/components/student/student-tabs"
import useSWR, { mutate } from "swr"
import { arrayFetcher, fetcher as apiFetcher } from "@/lib/swr-fetcher"
import { useLanguage } from "@/lib/i18n/context"

interface Student {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  birthDate: string | null
  idNumber: string | null
  father: string | null
  mother: string | null
  additionalPhone: string | null
  healthFund: string | null
  allergies: string | null
  status: string
  totalSessions: number | null
  courseIds: string[]
  createdAt: string
  enrollments: any[]
  payments: any[]
  attendances: any[]
  profileImage?: string | null
}

const statusColors: Record<string, string> = {
  "פעיל": "bg-green-100 text-green-800",
  "מתעניין": "bg-blue-100 text-blue-800",
  "השהיה": "bg-yellow-100 text-yellow-800",
  "סיים": "bg-gray-100 text-gray-800",
}

function safeText(v: any) {
  if (v === null || v === undefined || v === "") return "—"
  return String(v)
}

function formatDate(dateStr: string | null) {
  return dateStr
}

export default function StudentViewPage() {
  const { t, locale } = useLanguage()
  const isRtl = locale !== "en"
  const l = (he: string, en: string, ar: string) => (locale === "en" ? en : locale === "ar" ? ar : he)
  const localeTag = locale === "en" ? "en-GB" : locale === "ar" ? "ar" : "he-IL"
  const params = useParams()
  const id = params.id as string
  const [isStudentUser, setIsStudentUser] = useState(false)

  const currentUser = useCurrentUser()
  const { data: userTypeData } = useUserType(currentUser?.id, currentUser?.role)
  const isOwnProfile = !!(userTypeData?.isStudent && userTypeData.studentId && userTypeData.studentId === id)
  const roleKey = (currentUser?.roleKey || currentUser?.role)?.toString().toLowerCase()
  const isAdmin =
    hasFullAccessRole(currentUser?.roleKey) ||
    hasFullAccessRole(currentUser?.role) ||
    roleKey === "admin" ||
    currentUser?.role === "Administrator" ||
    currentUser?.role === "אדמין" ||
    currentUser?.role === "מנהל"
  const userPerms = currentUser?.permissions || []
  const canEditStudents = isAdmin || hasPermission(userPerms, "students.edit")

  useEffect(() => {
    if (!currentUser?.id) return
    fetch(`/api/students/by-user/${currentUser.id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setIsStudentUser(true) })
      .catch(() => {})
  }, [currentUser?.id])

  // Use SWR for all data fetching
  const { data: studentData, isLoading: studentLoading, mutate: mutateStudent } = useSWR(
    id ? `/api/students/${id}` : null,
    apiFetcher
  )
  const { data: coursesData } = useSWR("/api/courses", arrayFetcher)
  const { data: enrollmentsData, mutate: mutateEnrollments } = useSWR(
    id ? `/api/enrollments?studentId=${id}` : null,
    arrayFetcher
  )
  const { data: paymentsData, mutate: mutatePayments } = useSWR(
    id ? `/api/payments?studentId=${id}` : null,
    arrayFetcher
  )
  const { data: attendancesData, mutate: mutateAttendances } = useSWR(
    id ? `/api/attendance?studentId=${id}` : null,
    arrayFetcher
  )

  const loading = studentLoading
  const courses = Array.isArray(coursesData) ? coursesData : []
  
  const ensureCourseIdsArray = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return raw
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  // Combine student data with related data
  const student = studentData ? {
    ...studentData,
    courseIds: ensureCourseIdsArray(studentData.courseIds),
    enrollments: Array.isArray(enrollmentsData) ? enrollmentsData : [],
    payments: Array.isArray(paymentsData) ? paymentsData : [],
    attendances: Array.isArray(attendancesData) ? attendancesData : []
  } : null

  // Function to refresh all data
  const refreshAllData = () => {
    mutateStudent()
    mutateEnrollments()
    mutatePayments()
    mutateAttendances()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!student) {
    return <div className="text-center py-10">{l("לא נמצא תלמיד", "Student not found", "لم يتم العثور على الطالب")}</div>
  }

  // Get enrolled course names
  const enrolledCourseNames = student.courseIds
    .map((cid: string) => courses.find((c: { id: string }) => c.id === cid)?.name)
    .filter(Boolean)

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen">
      <div className="space-y-6 max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/students">
              <Button variant="ghost" size="icon">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>

            <div>
              <h1 className="text-3xl font-bold text-foreground">{l("פרטי תלמיד", "Student Details", "تفاصيل الطالب")}</h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Link href="/dashboard/students" className="hover:text-foreground transition-colors">
                  {t("students.title")}
                </Link>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-foreground font-medium">{student.name}</span>
              </div>
            </div>
          </div>

          {!isStudentUser && canEditStudents && (
            <Link href={`/dashboard/students/${student.id}/edit`}>
              <Button className="gap-2">
                <Edit className="h-4 w-4" />
                {l("ערוך תלמיד", "Edit Student", "تعديل الطالب")}
              </Button>
            </Link>
          )}
        </div>

        {/* Student Name Header */}
        <Card className="p-6">
          <div className="flex items-center gap-6">
            {student.profileImage ? (
              <img src={student.profileImage} alt={student.name} className="h-20 w-20 rounded-full object-cover border" />
            ) : (
              <img src="/api/og-logo" alt="Center logo" className="h-20 w-20 rounded-full object-cover border" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-foreground">{student.name}</h2>
                <Badge className={statusColors[student.status] || "bg-gray-100 text-gray-800"}>
                  {student.status}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs - including Profile tab with all details */}
        <Card className="p-6">
          <StudentTabs
            studentId={id}
            student={student}
            enrollments={student.enrollments}
            payments={student.payments}
            attendances={student.attendances}
            enrolledCourseNames={enrolledCourseNames}
            onPaymentAdded={refreshAllData}
            isOwnProfile={isOwnProfile}
          />
        </Card>

        {/* Created Date */}
        <div className="text-center text-sm text-muted-foreground">
          {l("נוצר בתאריך:", "Created at:", "تاريخ الإنشاء:")} {student.createdAt ? new Intl.DateTimeFormat(localeTag, { dateStyle: "short" }).format(new Date(student.createdAt)) : "—"}
        </div>
      </div>
    </div>
  )
}
