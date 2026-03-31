"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import useSWR from "swr"
import { arrayFetcher, fetcher as apiFetcher } from "@/lib/swr-fetcher"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { CityCombobox } from "@/components/ui/combobox-city"

import { ArrowRight, User, Award as IdCard, Phone, Users, Heart, BookOpen, X, Loader2, KeyRound } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import { fileToProfileImageDataUrl } from "@/lib/profile-image-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function EditStudentPage() {
  const { locale } = useLanguage()
  const isEn = locale === "en"
  const isAr = locale === "ar"
  const isRtl = !isEn
  const tr = {
    title: isEn ? "Edit Student" : isAr ? "تعديل الطالب" : "ערוך תלמיד",
    subtitle: isEn ? "Update student details" : isAr ? "تحديث بيانات الطالب" : "עדכן את פרטי התלמיד במערכת",
    save: isEn ? "Save Changes" : isAr ? "حفظ التغييرات" : "שמור שינויים",
    cancel: isEn ? "Cancel" : isAr ? "إلغاء" : "ביטול",
    saving: isEn ? "Saving..." : isAr ? "جارٍ الحفظ..." : "שומר...",
    saved: isEn ? "Saved successfully!" : isAr ? "تم الحفظ بنجاح!" : "נשמר בהצלחה!",
    loadError: isEn ? "Error loading student" : isAr ? "خطأ في تحميل الطالب" : "שגיאה בטעינת התלמיד",
    unsavedTitle: isEn ? "You have unsaved changes" : isAr ? "لديك تغييرات غير محفوظة" : "יש שינויים שלא נשמרו",
    unsavedDesc: isEn ? "Are you sure you want to leave? Unsaved changes will be lost." : isAr ? "هل أنت متأكد من الخروج؟ سيتم فقدان كل التغييرات غير المحفوظة." : "האם אתה בטוח שברצונך לצאת? כל השינויים שלא נשמרו יאבדו.",
    continueEdit: isEn ? "Continue editing" : isAr ? "متابعة التعديل" : "המשך לערוך",
    leaveWithoutSave: isEn ? "Leave without saving" : isAr ? "خروج بدون حفظ" : "צא בלי לשמור",
    status: isEn ? "Student Status" : "סטטוס התלמיד",
    chooseStatus: isEn ? "Choose current student status" : "בחר את סטטוס התלמיד הנוכחי",
    personalInfo: isEn ? "Personal Information" : "מידע אישי",
    contactInfo: isEn ? "Contact Information" : "פרטי קשר",
    parentInfo: isEn ? "Parent Information" : "פרטי הורים",
    medicalInfo: isEn ? "Medical Information" : "מידע רפואי",
    courses: isEn ? "Courses" : "קורסים",
    userAccount: isEn ? "User Account" : "חשבון משתמש",
    fullName: isEn ? "Full Name *" : "שם מלא *",
    idNumber: isEn ? "ID Number" : "תעודת זהות",
    birthDate: isEn ? "Birth Date" : "תאריך לידה",
    city: isEn ? "City" : "עיר",
    address: isEn ? "Address" : "כתובת",
    fatherName: isEn ? "Father Name" : "שם האב",
    motherName: isEn ? "Mother Name" : "שם האם",
    sessionsDefault: isEn ? "Default Sessions" : "כמות מפגשים בררת מחדל",
    selectedCourses: isEn ? "Selected courses:" : "קורסים נבחרים:",
    noCourses: isEn ? "No courses available in system" : "אין קורסים זמינים במערכת",
    pending: isEn ? "Pending" : isAr ? "قيد الانتظار" : "מתעניין",
    active: isEn ? "Active" : isAr ? "نشط" : "פעיל",
    paused: isEn ? "Paused" : isAr ? "مجمّد" : "השהיה",
    completed: isEn ? "Completed" : isAr ? "منتهي" : "סיים",
  }
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = useMemo(() => (typeof params?.id === "string" ? params.id : ""), [params?.id])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch courses and student from API
  const { data: rawCourses } = useSWR("/api/courses", arrayFetcher)
  const courses = Array.isArray(rawCourses) ? rawCourses : []
  const { data: studentData, error: studentError } = useSWR(id ? `/api/students/${id}` : null, apiFetcher)

  const [student, setStudent] = useState({
    name: "",
    idNumber: "",
    birthDate: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    father: "",
    mother: "",
    additionalPhone: "",
    healthFund: "",
    allergies: "",
    profileImage: "",
    courseIds: [] as string[],
    status: "פעיל",
    totalSessions: 12,
    courseSessions: {} as Record<string, number>,
  })

  // User account fields
  const [hasUserAccount, setHasUserAccount] = useState(false)
  const [createUserAccount, setCreateUserAccount] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  // Update local state when student data is fetched
  useEffect(() => {
    if (studentData && !studentError) {
      setStudent({
        name: studentData.name || "",
        idNumber: studentData.idNumber || "",
        birthDate: studentData.birthDate ? studentData.birthDate.split("T")[0] : "",
        email: studentData.email || "",
        phone: studentData.phone || "",
        address: studentData.address || "",
        city: studentData.city || "",
        father: studentData.father || "",
        mother: studentData.mother || "",
        additionalPhone: studentData.additionalPhone || "",
        healthFund: studentData.healthFund || "",
        allergies: studentData.allergies || "",
        profileImage: studentData.profileImage || "",
        courseIds: studentData.courseIds || [],
        status: studentData.status || "פעיל",
        totalSessions: studentData.totalSessions || 12,
        courseSessions: studentData.courseSessions || {},
      })
      // Check if student already has a user account
      setHasUserAccount(!!studentData.userId)
    }
  }, [studentData, studentError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || isSubmitting || submitSuccess) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Validate user account fields if creating account
      if (createUserAccount && !hasUserAccount) {
        if (!username.trim()) {
          throw new Error(isEn ? "Username is required" : "יש להזין שם משתמש")
        }
        if (!password || password.length < 4) {
          throw new Error(isEn ? "Password must be at least 4 characters" : "הסיסמה חייבת להכיל לפחות 4 תווים")
        }
      }

      const res = await fetch(`/api/students/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...student,
          profileImage: student.profileImage.trim() || null,
          // User account data (only if creating new account)
          createUserAccount: createUserAccount && !hasUserAccount,
          username: createUserAccount && !hasUserAccount ? username.trim() : null,
          password: createUserAccount && !hasUserAccount ? password : null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || `Failed to update student (${res.status})`)
      }

      // Sync enrollments - delete all existing and create new ones for selected courses
      // First get existing enrollments and available courses
      const [existingEnrollments, availableCourses] = await Promise.all([
        fetch(`/api/enrollments?studentId=${id}`).then(r => r.json()),
        fetch("/api/courses").then(r => r.json())
      ])
      const existingCourseIds = existingEnrollments.map((e: any) => e.courseId)
      const validCourseIds = availableCourses.map((c: any) => c.id)
      
      // Delete enrollments for courses no longer selected
      for (const enrollment of existingEnrollments) {
        if (!student.courseIds.includes(enrollment.courseId)) {
          await fetch(`/api/enrollments?studentId=${id}&courseId=${enrollment.courseId}`, {
            method: "DELETE"
          })
        }
      }
      
      // Create or update enrollments for selected courses (only if course exists)
      for (const courseId of student.courseIds) {
        // Skip if course doesn't exist in database
        if (!validCourseIds.includes(courseId)) continue
        
        const sessionsForCourse = student.courseSessions[courseId] || student.totalSessions || 12
        if (!existingCourseIds.includes(courseId)) {
          // Create new enrollment
          await fetch("/api/enrollments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: id,
              courseId: courseId,
              status: "active",
              sessionsLeft: sessionsForCourse
            })
          })
        } else {
          // Update existing enrollment sessionsLeft if needed
          const existingEnrollment = existingEnrollments.find((e: any) => e.courseId === courseId)
          if (existingEnrollment && (existingEnrollment.sessionsLeft === null || existingEnrollment.sessionsLeft === 0)) {
            await fetch(`/api/enrollments/${existingEnrollment.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionsLeft: sessionsForCourse
              })
            })
          }
        }
      }

      // Navigate immediately
      window.location.href = "/dashboard/students"
    } catch (err: any) {
      setSubmitError(err?.message ?? (isEn ? "Failed to update student" : "שגיאה בעדכון תלמיד"))
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (hasChanges) {
      setCancelDialogOpen(true)
    } else {
      router.push(id ? `/dashboard/students/${id}` : "/dashboard/students")
    }
  }

  const updateStudent = (updates: Partial<typeof student>) => {
    setStudent(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const toggleCourse = (courseId: string) => {
    setStudent((prev) => {
      const updatedCourseIds = prev.courseIds.includes(courseId)
        ? prev.courseIds.filter((cid) => cid !== courseId)
        : [...prev.courseIds, courseId]

      const updatedCourseSessions = { ...prev.courseSessions }
      if (!prev.courseIds.includes(courseId)) {
        updatedCourseSessions[courseId] = prev.totalSessions
      }

      return {
        ...prev,
        courseIds: updatedCourseIds,
        courseSessions: updatedCourseSessions,
      }
    })
    setHasChanges(true)
  }

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToProfileImageDataUrl(file)
    updateStudent({ profileImage: dataUrl })
  }

  if (studentError) {
    return (
      <div className="container mx-auto max-w-4xl p-6" dir={isRtl ? "rtl" : "ltr"}>
        <Card className="border-2 border-red-200 bg-red-50 p-4">
          <div className="font-medium text-red-700">{tr.loadError}</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center gap-4">
        <Link href={id ? `/dashboard/students/${id}` : "/dashboard/students"}>
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{tr.title}</h1>
          <p className="text-muted-foreground mt-1">{tr.subtitle}</p>
        </div>
      </div>

      {submitSuccess && (
        <Card className="border-2 border-green-200 bg-green-50 p-4">
          <div className="font-medium text-green-700 flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {isEn ? "Changes saved successfully!" : "השינויים נשמרו בהצלחה!"}
          </div>
          <div className="text-sm text-green-700/80 mt-1">{isEn ? "Redirecting to students list..." : "מעביר לרשימת התלמידים..."}</div>
        </Card>
      )}

      {submitError && (
        <Card className="border-2 border-red-200 bg-red-50 p-4">
          <div className="font-medium text-red-700">{isEn ? "Error" : "שגיאה"}</div>
          <div className="text-sm text-red-700/80 mt-1">{submitError}</div>
        </Card>
      )}

      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-500 text-white p-3 rounded-lg">
            <User className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{tr.status}</h3>
            <p className="text-sm text-muted-foreground mb-3">{tr.chooseStatus}</p>
            <Select value={student.status} onValueChange={(value) => updateStudent({ status: value })}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="מתעניין">{tr.pending}</SelectItem>
                <SelectItem value="פעיל">{tr.active}</SelectItem>
                <SelectItem value="השהיה">{tr.paused}</SelectItem>
                <SelectItem value="סיים">{tr.completed}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-green-500 text-white p-2.5 rounded-lg">
              <IdCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.personalInfo}</h3>
              <p className="text-sm text-muted-foreground">{isEn ? "Basic student details" : "פרטים בסיסיים על התלמיד"}</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-base font-medium">
                {tr.fullName}
              </Label>
              <Input
                id="name"
                value={student.name}
                onChange={(e) => updateStudent({ name: e.target.value })}
                  placeholder={isEn ? "e.g. John Doe" : "לדוגמה: יוסי כהן"}
                className="text-base h-12 bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="idNumber" className="text-base font-medium">
                  {tr.idNumber}
                </Label>
                <Input
                  id="idNumber"
                  value={student.idNumber}
                  onChange={(e) => updateStudent({ idNumber: e.target.value })}
                  placeholder="123456789"
                  className="text-base h-12 bg-white"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="birthDate" className="text-base font-medium">
                  {tr.birthDate}
                </Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={student.birthDate}
                  onChange={(e) => updateStudent({ birthDate: e.target.value })}
                  className="text-base h-12 bg-white"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profileImageUpload" className="text-base font-medium">תמונת פרופיל</Label>
              <div className="flex items-center gap-3">
                {student.profileImage ? (
                  <img src={student.profileImage} alt="profile preview" className="h-16 w-16 rounded-full object-contain bg-white p-0.5 border" />
                ) : (
                  <div className="h-16 w-16 rounded-full border-2 border-dashed bg-muted" />
                )}
                <div className="flex-1 space-y-2">
                  <Input id="profileImageUpload" type="file" accept="image/*" capture="environment" onChange={handleProfileImageUpload} className="bg-white" />
                  {student.profileImage && (
                    <Button type="button" variant="outline" size="sm" onClick={() => updateStudent({ profileImage: "" })}>
                      <X className="h-4 w-4 mr-1" />
                      הסר תמונה
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-500 text-white p-2.5 rounded-lg">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.contactInfo}</h3>
              <p className="text-sm text-muted-foreground">מידע ליצירת קשר</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-base font-medium">
                אימייל (אופציונלי)
              </Label>
              <Input
                id="email"
                type="email"
                value={student.email}
                onChange={(e) => updateStudent({ email: e.target.value })}
                placeholder="student@example.com"
                className="text-base h-12 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-base font-medium">
                  מספר נייד
                </Label>
                <Input
                  id="phone"
                  value={student.phone}
                  onChange={(e) => updateStudent({ phone: e.target.value })}
                  placeholder="050-1234567"
                  className="text-base h-12 bg-white"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="additionalPhone" className="text-base font-medium">
                  מספר נייד נוסף
                </Label>
                <Input
                  id="additionalPhone"
                  value={student.additionalPhone}
                  onChange={(e) => updateStudent({ additionalPhone: e.target.value })}
                  placeholder="052-9876543"
                  className="text-base h-12 bg-white"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="city" className="text-base font-medium">
                {tr.city}
              </Label>
              <CityCombobox
                value={student.city}
                onChange={(value) => updateStudent({ city: value })}
                placeholder={isEn ? "Choose city" : "בחר עיר"}
                className="bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address" className="text-base font-medium">
                {tr.address}
              </Label>
              <Input
                id="address"
                value={student.address}
                onChange={(e) => updateStudent({ address: e.target.value })}
                placeholder={isEn ? "Street 123" : "רחוב 123"}
                className="text-base h-12 bg-white"
              />
            </div>
          </div>
        </Card>

        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-500 text-white p-2.5 rounded-lg">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.parentInfo}</h3>
              <p className="text-sm text-muted-foreground">מידע על הורי התלמיד</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="father" className="text-base font-medium">
                {tr.fatherName}
              </Label>
              <Input
                id="father"
                value={student.father}
                onChange={(e) => updateStudent({ father: e.target.value })}
                placeholder="שם האב"
                className="text-base h-12 bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mother" className="text-base font-medium">
                {tr.motherName}
              </Label>
              <Input
                id="mother"
                value={student.mother}
                onChange={(e) => updateStudent({ mother: e.target.value })}
                placeholder="שם האם"
                className="text-base h-12 bg-white"
              />
            </div>
          </div>
        </Card>

        <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-red-500 text-white p-2.5 rounded-lg">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.medicalInfo}</h3>
              <p className="text-sm text-muted-foreground">רגישויות וקופת חולים</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="healthFund" className="text-base font-medium">
                קופת חולים
              </Label>
              <Select value={student.healthFund} onValueChange={(value) => updateStudent({ healthFund: value })}>
                <SelectTrigger id="healthFund" className="h-12 bg-white">
                  <SelectValue placeholder="בחר קופת חולים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="כללית">כללית</SelectItem>
                  <SelectItem value="מכבי">מכבי</SelectItem>
                  <SelectItem value="מאוחדת">מאוחדת</SelectItem>
                  <SelectItem value="לאומית">לאומית</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="allergies" className="text-base font-medium">
                רגישויות ואלרגיות
              </Label>
              <Textarea
                id="allergies"
                value={student.allergies}
                onChange={(e) => updateStudent({ allergies: e.target.value })}
                placeholder="פרט כל רגישות או אלרגיה רלוונטית..."
                rows={4}
                className="text-base resize-none bg-white"
              />
            </div>
          </div>
        </Card>

        {/* User Account */}
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-500 text-white p-2.5 rounded-lg">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.userAccount}</h3>
              <p className="text-sm text-muted-foreground">יצירת חשבון התחברות לתלמיד במערכת</p>
            </div>
          </div>

          {hasUserAccount ? (
            <div className="text-center py-4 bg-green-100 rounded-lg border border-green-300">
              <p className="text-green-700 font-medium">{isEn ? "This student already has a user account" : "לתלמיד זה כבר יש חשבון משתמש במערכת"}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox 
                  id="createUserAccount"
                  checked={createUserAccount}
                  onCheckedChange={(checked) => setCreateUserAccount(checked === true)}
                />
                <Label htmlFor="createUserAccount" className="cursor-pointer text-base">
                  צור חשבון משתמש לתלמיד (יאפשר לתלמיד להתחבר למערכת)
                </Label>
              </div>

              {createUserAccount && (
                <div className="grid gap-4 pt-4 border-t">
                  <div className="grid gap-2">
                    <Label htmlFor="username" className="text-base font-medium">שם משתמש *</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="שם משתמש להתחברות"
                      dir="ltr"
                      className="text-base h-12 bg-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-base font-medium">סיסמה *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="לפחות 4 תווים"
                      dir="ltr"
                      className="text-base h-12 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-500 text-white p-2.5 rounded-lg">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.courses}</h3>
              <p className="text-sm text-muted-foreground">בחר קורסים עבור התלמיד</p>
            </div>
          </div>

          <div className="mb-4">
            <Label htmlFor="totalSessions" className="text-base font-medium">
              {tr.sessionsDefault}
            </Label>
            <Input
              id="totalSessions"
              type="number"
              min="1"
              value={student.totalSessions}
              onChange={(e) => updateStudent({ totalSessions: Number.parseInt(e.target.value) || 12 })}
              className="text-base h-12 bg-white mt-2"
            />
          </div>

          <div className="border-2 border-purple-200 rounded-lg p-5 bg-white">
            {courses.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {courses.map((course: any) => (
                    <div
                      key={course.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors"
                    >
                      <Checkbox
                        id={`course-${course.id}`}
                        checked={student.courseIds?.includes(course.id.toString()) || false}
                        onCheckedChange={() => toggleCourse(course.id.toString())}
                        className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                      />
                      <Label
                        htmlFor={`course-${course.id}`}
                        className="text-sm font-medium cursor-pointer select-none flex-1"
                      >
                        {course.name}
                      </Label>
                    </div>
                  ))}
                </div>

                {student.courseIds.length > 0 && (
                  <div className="pt-4 border-t-2 border-purple-100">
                    <p className="text-sm font-medium text-muted-foreground mb-3">{tr.selectedCourses}</p>
                    <div className="flex flex-wrap gap-2">
                      {student.courseIds.map((courseId) => {
                        const course = courses.find((c: any) => c.id.toString() === courseId)
                        return course ? (
                          <span
                            key={courseId}
                            className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
                          >
                            {course.name}
                            <button
                              type="button"
                              onClick={() => toggleCourse(courseId)}
                              className="hover:bg-purple-200 rounded-full p-1 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ) : null
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{tr.noCourses}</p>
            )}
          </div>
        </Card>

        <div className="flex gap-3 justify-start">
          <Button 
            type="submit" 
            size="lg" 
            className="h-12 px-8 text-base" 
            disabled={isSubmitting || submitSuccess || !student.name || !id}
          >
            {submitSuccess ? (
              tr.saved
            ) : isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                {tr.saving}
              </>
            ) : (
              tr.save
            )}
          </Button>

          <Button 
            type="button" 
            variant="outline" 
            size="lg" 
            className="h-12 px-8 text-base bg-transparent"
            onClick={handleCancel}
          >
            {tr.cancel}
          </Button>
        </div>
      </form>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{tr.unsavedTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr.unsavedDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>{tr.continueEdit}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => router.push(id ? `/dashboard/students/${id}` : "/dashboard/students")}
              className="bg-red-600 hover:bg-red-700"
            >
              {tr.leaveWithoutSave}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
