"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowRight, User, Award as IdCard, Phone, Users, Heart, BookOpen, X, KeyRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CityCombobox } from "@/components/ui/combobox-city"
import useSWR from "swr"
import { arrayFetcher } from "@/lib/swr-fetcher"
import { useLanguage } from "@/lib/i18n/context"
import { fileToProfileImageDataUrl } from "@/lib/profile-image-client"

type Course = { id: string | number; name: string }

export default function NewStudentPage() {
  const { locale } = useLanguage()
  const isEn = locale === "en"
  const isAr = locale === "ar"
  const isRtl = !isEn
  const tr = {
    title: isEn ? "New Student" : isAr ? "طالب جديد" : "תלמיד חדש",
    subtitle: isEn ? "Add a new student to the system" : isAr ? "أضف طالباً جديداً إلى النظام" : "הוסף תלמיד חדש למערכת הרובוטיקה",
    success: isEn ? "Student added successfully!" : isAr ? "تمت إضافة الطالب بنجاح!" : "התלמיד נוסף בהצלחה!",
    redirecting: isEn ? "Redirecting to students list..." : isAr ? "جاري التحويل إلى قائمة الطلاب..." : "מעביר לרשימת התלמידים...",
    error: isEn ? "Error" : isAr ? "خطأ" : "שגיאה",
    addStudent: isEn ? "Add Student" : isAr ? "إضافة طالب" : "הוסף תלמיד",
    saving: isEn ? "Saving..." : isAr ? "جارٍ الحفظ..." : "שומר...",
    cancel: isEn ? "Cancel" : isAr ? "إلغاء" : "ביטול",
    status: isEn ? "Student Status" : isAr ? "حالة الطالب" : "סטטוס התלמיד",
    personalInfo: isEn ? "Personal Information" : "מידע אישי",
    contactInfo: isEn ? "Contact Information" : "פרטי קשר",
    parentInfo: isEn ? "Parent Information" : "פרטי הורים",
    medicalInfo: isEn ? "Medical Information" : "מידע רפואי",
    courses: isEn ? "Courses" : "קורסים",
    userAccount: isEn ? "User Account" : "חשבון משתמש",
    fullName: isEn ? "Full Name *" : "שם מלא *",
    idNumber: isEn ? "ID Number" : "תעודת זהות",
    birthDate: isEn ? "Birth Date" : "תאריך לידה",
    profileImageOptional: isEn ? "Profile image (optional)" : isAr ? "صورة الملف الشخصي (اختياري)" : "תמונת פרופיל (לא חובה)",
    email: isEn ? "Email (optional)" : "אימייל (אופציונלי)",
    mobile: isEn ? "Mobile Number" : "מספר נייד",
    extraMobile: isEn ? "Additional Mobile Number" : "מספר נייד נוסף",
    city: isEn ? "City" : "עיר",
    address: isEn ? "Address" : "כתובת",
    fatherName: isEn ? "Father Name" : "שם האב",
    motherName: isEn ? "Mother Name" : "שם האם",
    healthFund: isEn ? "Health Fund" : "קופת חולים",
    allergies: isEn ? "Allergies / Sensitivities" : "רגישויות ואלרגיות",
    sessions: isEn ? "Number of sessions" : "כמות מפגשים",
    availableCoursesNone: isEn ? "No courses available in system" : "אין קורסים זמינים במערכת",
    selectedCourses: isEn ? "Selected courses:" : "קורסים נבחרים:",
    createAccount: isEn ? "Create user account for student" : "צור חשבון משתמש לתלמיד (יאפשר לתלמיד להתחבר למערכת)",
    username: isEn ? "Username *" : "שם משתמש *",
    password: isEn ? "Password *" : "סיסמה *",
    pending: isEn ? "Pending" : isAr ? "قيد الانتظار" : "מתעניין",
    active: isEn ? "Active" : isAr ? "نشط" : "פעיל",
    paused: isEn ? "Paused" : isAr ? "مجمّد" : "השהיה",
    completed: isEn ? "Completed" : isAr ? "منتهي" : "סיים",
  }
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Fetch courses from API
  const { data: rawCourses } = useSWR<Course[]>("/api/courses", arrayFetcher)
  const courses = Array.isArray(rawCourses) ? rawCourses : []

  const [newStudent, setNewStudent] = useState({
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
    courseIds: [] as string[],
    status: "מתעניין",
    totalSessions: 12,
    courseSessions: {} as Record<string, number>,
    profileImage: "",
  })

  // User account fields
  const [createUserAccount, setCreateUserAccount] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const toggleCourse = (courseId: string) => {
    setNewStudent((prev) => ({
      ...prev,
      courseIds: prev.courseIds.includes(courseId)
        ? prev.courseIds.filter((id) => id !== courseId)
        : [...prev.courseIds, courseId],
    }))
  }

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToProfileImageDataUrl(file)
    setNewStudent((prev) => ({ ...prev, profileImage: dataUrl }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent double submission
    if (isSubmitting || submitSuccess) return
    
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Validate user account fields if creating account
      if (createUserAccount) {
        if (!username.trim()) {
          throw new Error(isEn ? "Username is required" : "יש להזין שם משתמש")
        }
        if (!password || password.length < 4) {
          throw new Error(isEn ? "Password must be at least 4 characters" : "הסיסמה חייבת להכיל לפחות 4 תווים")
        }
      }

      // Build session balance for each course
      const courseSessions: Record<string, number> = {}
      newStudent.courseIds.forEach((courseId) => {
        courseSessions[courseId] = newStudent.totalSessions
      })

      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newStudent,
          courseSessions,
          profileImage: newStudent.profileImage.trim() || null,
          // User account data
          createUserAccount,
          username: createUserAccount ? username.trim() : null,
          password: createUserAccount ? password : null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || `Failed to create student (${res.status})`)
      }

      const createdStudent = await res.json()

      // Create enrollments for each selected course
      for (const courseId of newStudent.courseIds) {
        await fetch("/api/enrollments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: createdStudent.id,
            courseId: courseId,
            status: "active",
          }),
        })
      }

      // Navigate immediately
      window.location.href = "/dashboard/students"
    } catch (err: any) {
      setSubmitError(err?.message ?? (isEn ? "Failed to add student" : "שגיאה בהוספת תלמיד"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-3 sm:space-y-6 sm:p-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <Link href="/dashboard/students" className="shrink-0">
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{tr.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{tr.subtitle}</p>
        </div>
      </div>

      {submitSuccess && (
        <Card className="border-2 border-green-200 bg-green-50 p-4">
          <div className="font-medium text-green-700">{tr.success}</div>
          <div className="text-sm text-green-700/80 mt-1">{tr.redirecting}</div>
        </Card>
      )}

      {submitError && (
        <Card className="border-2 border-red-200 bg-red-50 p-4">
          <div className="font-medium text-red-700">{tr.error}</div>
          <div className="text-sm text-red-700/80 mt-1">{submitError}</div>
        </Card>
      )}

      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-500 text-white p-3 rounded-lg">
            <User className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{tr.status}</h3>
            <p className="text-sm text-muted-foreground mb-3">{isEn ? "Choose current student status" : "בחר את סטטוס התלמיד הנוכחי"}</p>
            <Select value={newStudent.status} onValueChange={(value) => setNewStudent({ ...newStudent, status: value })}>
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
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 p-4 sm:p-6">
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
                value={newStudent.name}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  placeholder={isEn ? "e.g. John Doe" : "לדוגמה: יוסי כהן"}
                className="text-base h-12 bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="idNumber" className="text-base font-medium">
                  {tr.idNumber}
                </Label>
                <Input
                  id="idNumber"
                  value={newStudent.idNumber}
                  onChange={(e) => setNewStudent({ ...newStudent, idNumber: e.target.value })}
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
                  value={newStudent.birthDate}
                  onChange={(e) => setNewStudent({ ...newStudent, birthDate: e.target.value })}
                  className="text-base h-12 bg-white"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profileImageUpload">{tr.profileImageOptional}</Label>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                {newStudent.profileImage ? (
                  <img src={newStudent.profileImage} alt="profile preview" className="mx-auto h-16 w-16 rounded-full border bg-white object-cover sm:mx-0" />
                ) : (
                  <div className="mx-auto h-16 w-16 rounded-full border-2 border-dashed bg-muted sm:mx-0" />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <Input id="profileImageUpload" type="file" accept="image/*" className="text-xs sm:text-sm" onChange={handleProfileImageUpload} />
                  {newStudent.profileImage && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setNewStudent((prev) => ({ ...prev, profileImage: "" }))}>
                      <X className="h-4 w-4 mr-1" />
                      {isEn ? "Remove photo" : "הסר תמונה"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-500 text-white p-2.5 rounded-lg">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.contactInfo}</h3>
              <p className="text-sm text-muted-foreground">{isEn ? "Contact details" : "מידע ליצירת קשר"}</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-base font-medium">
                {tr.email}
              </Label>
              <Input
                id="email"
                type="email"
                value={newStudent.email}
                onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                placeholder="student@example.com"
                className="text-base h-12 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-base font-medium">
                  {tr.mobile}
                </Label>
                <Input
                  id="phone"
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  placeholder="050-1234567"
                  className="text-base h-12 bg-white"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="additionalPhone" className="text-base font-medium">
                  {tr.extraMobile}
                </Label>
                <Input
                  id="additionalPhone"
                  value={newStudent.additionalPhone}
                  onChange={(e) => setNewStudent({ ...newStudent, additionalPhone: e.target.value })}
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
                value={newStudent.city}
                onChange={(value) => setNewStudent({ ...newStudent, city: value })}
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
                value={newStudent.address}
                onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })}
                  placeholder={isEn ? "Street 123" : "רחוב 123"}
                className="text-base h-12 bg-white"
              />
            </div>
          </div>
        </Card>

        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-500 text-white p-2.5 rounded-lg">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.parentInfo}</h3>
              <p className="text-sm text-muted-foreground">{isEn ? "Parent details" : "מידע על הורי התלמיד"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="father" className="text-base font-medium">
                {tr.fatherName}
              </Label>
              <Input
                id="father"
                value={newStudent.father}
                onChange={(e) => setNewStudent({ ...newStudent, father: e.target.value })}
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
                value={newStudent.mother}
                onChange={(e) => setNewStudent({ ...newStudent, mother: e.target.value })}
                placeholder="שם האם"
                className="text-base h-12 bg-white"
              />
            </div>
          </div>
        </Card>

        {/* User Account */}
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-500 text-white p-2.5 rounded-lg">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.userAccount}</h3>
              <p className="text-sm text-muted-foreground">{isEn ? "Create login account for student" : "יצירת חשבון התחברות לתלמיד במערכת"}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox 
                id="createUserAccount"
                className="mt-1 shrink-0"
                checked={createUserAccount}
                onCheckedChange={(checked) => setCreateUserAccount(checked === true)}
              />
              <Label htmlFor="createUserAccount" className="cursor-pointer text-base leading-snug">
                {tr.createAccount}
              </Label>
            </div>

            {createUserAccount && (
              <div className="grid gap-4 pt-4 border-t">
                <div className="grid gap-2">
                  <Label htmlFor="username" className="text-base font-medium">{tr.username}</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={isEn ? "Login username" : "שם משתמש להתחברות"}
                    dir="ltr"
                    className="text-base h-12 bg-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password" className="text-base font-medium">{tr.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEn ? "At least 4 characters" : "לפחות 4 תווים"}
                    dir="ltr"
                    className="text-base h-12 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-red-500 text-white p-2.5 rounded-lg">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.medicalInfo}</h3>
              <p className="text-sm text-muted-foreground">{isEn ? "Health fund and sensitivities" : "רגישויות וקופת חולים"}</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="healthFund" className="text-base font-medium">
                {tr.healthFund}
              </Label>
              <Select
                value={newStudent.healthFund}
                onValueChange={(value) => setNewStudent({ ...newStudent, healthFund: value })}
              >
                <SelectTrigger id="healthFund" className="h-12 bg-white">
                  <SelectValue placeholder={isEn ? "Choose health fund" : "בחר קופת חולים"} />
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
                {tr.allergies}
              </Label>
              <Textarea
                id="allergies"
                value={newStudent.allergies}
                onChange={(e) => setNewStudent({ ...newStudent, allergies: e.target.value })}
                placeholder={isEn ? "Describe any relevant sensitivity or allergy..." : "פרט כל רגישות או אלרגיה רלוונטית..."}
                rows={4}
                className="text-base resize-none bg-white"
              />
            </div>
          </div>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-500 text-white p-2.5 rounded-lg">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{tr.courses}</h3>
              <p className="text-sm text-muted-foreground">{isEn ? "Select courses for student" : "בחר קורסים עבור התלמיד"}</p>
            </div>
          </div>

          <div className="mb-4">
            <Label htmlFor="totalSessions" className="text-base font-medium">
              {tr.sessions}
            </Label>
            <Input
              id="totalSessions"
              type="number"
              min="1"
              value={newStudent.totalSessions}
              onChange={(e) => setNewStudent({ ...newStudent, totalSessions: Number.parseInt(e.target.value) || 12 })}
              className="text-base h-12 bg-white mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">{isEn ? "Sessions allocated per course (default: 12)" : "כמות המפגשים שתוקצה לכל קורס (ברירת מחדל: 12)"}</p>
          </div>

          <div className="border-2 border-purple-200 rounded-lg p-5 bg-white">
            {courses.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {courses.map((course) => (
                    <div
                      key={course.id.toString()}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors"
                    >
                      <Checkbox
                        id={`course-${course.id}`}
                        checked={newStudent.courseIds.includes(course.id.toString())}
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

                {newStudent.courseIds.length > 0 && (
                  <div className="pt-4 border-t-2 border-purple-100">
                    <p className="text-sm font-medium text-muted-foreground mb-3">{tr.selectedCourses}</p>
                    <div className="flex flex-wrap gap-2">
                      {newStudent.courseIds.map((courseId) => {
                        const course = courses.find((c) => c.id.toString() === courseId)
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
              <p className="text-sm text-muted-foreground text-center py-4">{tr.availableCoursesNone}</p>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-start">
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full px-8 text-base sm:w-auto"
            disabled={isSubmitting || submitSuccess || !newStudent.name}
          >
            {submitSuccess ? (isEn ? "Saved successfully!" : "נשמר בהצלחה!") : isSubmitting ? tr.saving : tr.addStudent}
          </Button>

          <Link href="/dashboard/students" className="w-full sm:w-auto">
            <Button type="button" variant="outline" size="lg" className="h-12 w-full px-8 text-base bg-transparent sm:w-auto">
              {tr.cancel}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
