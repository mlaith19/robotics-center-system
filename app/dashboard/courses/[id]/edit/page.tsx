"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowRight, BookOpen, Save, Calendar, Users, MessageSquare, Loader2, DollarSign } from "lucide-react"
import { courseTimeToInputValue } from "@/lib/course-db-fields"
import { useLanguage } from "@/lib/i18n/context"

interface Teacher {
  id: string
  name: string
}

interface School {
  id: string
  name: string
  city?: string
}

interface GafanProgram {
  id: string
  name: string
  schoolId?: string
  programNumber?: string
  validYear?: number
  priceMin?: number
  priceMax?: number
}

const DAYS_OF_WEEK = [
  { value: "sunday", label: "ראשון" },
  { value: "monday", label: "שני" },
  { value: "tuesday", label: "שלישי" },
  { value: "wednesday", label: "רביעי" },
  { value: "thursday", label: "חמישי" },
  { value: "friday", label: "שישי" },
  { value: "saturday", label: "שבת" },
]

const TOTAL_PRICE_SUFFIX = "_total"
const SESSION_PRICE_SUFFIX = "_session"
const HOURLY_PRICE_SUFFIX = "_hour"
function normalizeCourseType(raw: string): string {
  return raw
    .replace(new RegExp(`${TOTAL_PRICE_SUFFIX}$`), "")
    .replace(new RegExp(`${SESSION_PRICE_SUFFIX}$`), "")
    .replace(new RegExp(`${HOURLY_PRICE_SUFFIX}$`), "")
}
function isTotalCoursePricingType(raw: string): boolean {
  return raw.endsWith(TOTAL_PRICE_SUFFIX)
}
function isSessionPricingType(raw: string): boolean {
  return raw.endsWith(SESSION_PRICE_SUFFIX)
}
function isHourlyPricingType(raw: string): boolean {
  return raw.endsWith(HOURLY_PRICE_SUFFIX)
}

function mapDayKeyToJsDay(key: string): number {
  const m: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  }
  return m[key] ?? -1
}

function countSessionsBetween(startYmd: string, endYmd: string, dayKeys: string[]): number {
  if (!startYmd || !endYmd || dayKeys.length === 0) return 0
  const wanted = new Set(dayKeys.map(mapDayKeyToJsDay).filter((d) => d >= 0))
  if (wanted.size === 0) return 0
  const [ys, ms, ds] = startYmd.split("-").map(Number)
  const [ye, me, de] = endYmd.split("-").map(Number)
  if ([ys, ms, ds, ye, me, de].some((n) => Number.isNaN(n))) return 0
  const cur = new Date(ys, ms - 1, ds)
  const end = new Date(ye, me - 1, de)
  if (cur > end) return 0
  let count = 0
  while (cur.getTime() <= end.getTime()) {
    if (wanted.has(cur.getDay())) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function hoursBetweenTimeInputs(start: string, end: string): number | null {
  if (!start?.trim() || !end?.trim()) return null
  const parse = (t: string) => {
    const [hh, mm = "0"] = t.trim().split(":")
    const h = Number(hh)
    const m = Number(mm)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }
  const s = parse(start)
  const e = parse(end)
  if (s == null || e == null) return null
  const diff = e - s
  if (diff <= 0) return null
  return diff / 60
}

export default function EditCoursePage() {
  const { locale } = useLanguage()
  const isRtl = locale !== "en"
  const l = (he: string, en: string, ar: string) => (locale === "en" ? en : locale === "ar" ? ar : he)
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [gafanPrograms, setGafanPrograms] = useState<GafanProgram[]>([])
  const [courseCategories, setCourseCategories] = useState<{ id: string; name: string }[]>([])

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    level: "beginner",
    duration: "",
    price: "",
    status: "active",
    courseNumber: "",
    category: "",
    courseType: "regular",
    location: "center",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    daysOfWeek: [] as string[],
    teacherIds: [] as string[],
    schoolId: "",
    gafanProgramId: "",
    validYear: new Date().getFullYear().toString(),
    showRegistrationLink: false,
    pricingMode: "perStudent" as "perStudent" | "perCourse" | "perSession" | "perHour",
  })
  const needsSessionCount = formData.pricingMode === "perSession" || formData.pricingMode === "perHour"
  const needsHourlyRange = formData.pricingMode === "perHour"
  const computedSessionCount = useMemo(
    () => (needsSessionCount ? countSessionsBetween(formData.startDate, formData.endDate, formData.daysOfWeek) : 0),
    [needsSessionCount, formData.startDate, formData.endDate, formData.daysOfWeek],
  )
  const hoursPerSession = useMemo(
    () => (needsHourlyRange ? hoursBetweenTimeInputs(formData.startTime, formData.endTime) : null),
    [needsHourlyRange, formData.startTime, formData.endTime],
  )
  const computedCoursePrice = useMemo(() => {
    if (!needsSessionCount) return 0
    const p = Number(formData.price)
    if (Number.isNaN(p)) return 0
    if (needsHourlyRange) {
      if (hoursPerSession == null || hoursPerSession <= 0) return 0
      return Math.round(computedSessionCount * hoursPerSession * p * 100) / 100
    }
    return Math.round(computedSessionCount * p * 100) / 100
  }, [needsSessionCount, needsHourlyRange, computedSessionCount, hoursPerSession, formData.price])

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${id}`, { credentials: "include" }).then(res => res.json()),
      fetch("/api/teachers", { credentials: "include" }).then(res => res.json()),
      fetch("/api/schools", { credentials: "include" }).then(res => res.json()),
      fetch("/api/gafan", { credentials: "include" }).then(res => res.json()),
      fetch("/api/course-categories", { credentials: "include" }).then(res => res.json())
    ])
      .then(([course, teacherList, schoolList, gafanList, categoryList]) => {
        if (course && !course.error) {
          setFormData({
            name: course.name || "",
            description: course.description || "",
            level: course.level || "beginner",
            duration: course.duration?.toString() || "",
            price: course.price?.toString() || "",
            status: course.status || "active",
            courseNumber: course.courseNumber || "",
            category: course.category || "",
            courseType: normalizeCourseType(course.courseType || "regular"),
            location: course.location || "center",
            startDate: course.startDate?.split("T")[0] || "",
            endDate: course.endDate?.split("T")[0] || "",
            startTime: courseTimeToInputValue(course.startTime),
            endTime: courseTimeToInputValue(course.endTime),
            daysOfWeek: course.daysOfWeek || [],
            teacherIds: course.teacherIds || [],
            schoolId: course.schoolId || "",
            gafanProgramId: course.gafanProgramId || "",
            validYear: course.validYear?.toString() || new Date().getFullYear().toString(),
            showRegistrationLink: course.showRegistrationLink === true,
            pricingMode: isTotalCoursePricingType(course.courseType || "")
              ? "perCourse"
              : isSessionPricingType(course.courseType || "")
                ? "perSession"
                : isHourlyPricingType(course.courseType || "")
                  ? "perHour"
                  : "perStudent",
          })
        }
        if (Array.isArray(teacherList)) setTeachers(teacherList)
        if (Array.isArray(schoolList)) setSchools(schoolList)
        if (Array.isArray(gafanList)) setGafanPrograms(gafanList)
        if (Array.isArray(categoryList)) setCourseCategories(categoryList)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setErr(l("שגיאה בטעינת קורס", "Failed to load course", "فشل تحميل الدورة"))
        setLoading(false)
      })
  }, [id])

  function toggleDay(day: string) {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }))
  }

  function toggleTeacher(teacherId: string) {
    setFormData(prev => ({
      ...prev,
      teacherIds: prev.teacherIds.includes(teacherId)
        ? prev.teacherIds.filter(tid => tid !== teacherId)
        : [...prev.teacherIds, teacherId]
    }))
  }

  async function save() {
    if (!formData.name.trim()) {
      setErr(l("שם הקורס הוא שדה חובה", "Course name is required", "اسم الدورة مطلوب"))
      return
    }
    if (needsSessionCount) {
      if (!formData.startDate || !formData.endDate) {
        setErr("לתמחור לפי מפגש/שעה יש למלא תאריך התחלה ותאריך סיום")
        return
      }
      if (formData.daysOfWeek.length === 0) {
        setErr("לתמחור לפי מפגש/שעה יש לבחור לפחות יום אחד בשבוע")
        return
      }
      if (computedSessionCount === 0) {
        setErr("לא נמצאו מפגשים בטווח התאריכים שנבחר")
        return
      }
      if (needsHourlyRange && (hoursPerSession == null || hoursPerSession <= 0)) {
        setErr("בתמחור לפי שעה יש למלא שעת התחלה/סיום תקינות")
        return
      }
    }
    
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          courseType:
            formData.courseType === "gafan"
              ? "gafan"
              : formData.pricingMode === "perCourse"
                ? `${formData.courseType}${TOTAL_PRICE_SUFFIX}`
                : formData.pricingMode === "perSession"
                  ? `${formData.courseType}${SESSION_PRICE_SUFFIX}`
                  : formData.pricingMode === "perHour"
                    ? `${formData.courseType}${HOURLY_PRICE_SUFFIX}`
                    : formData.courseType,
          duration: needsSessionCount ? computedSessionCount : (formData.duration ? Number(formData.duration) : null),
          price: needsSessionCount ? computedCoursePrice : (formData.price ? Number(formData.price) : null),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? `Failed (${res.status})`)
      }
      router.push("/dashboard/courses")
    } catch (e: any) {
      setErr(e?.message ?? l("שגיאה בעדכון קורס", "Failed to update", "فشل تحديث الدورة"))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="container mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/courses">
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{l("עריכת קורס", "Edit Course", "تعديل الدورة")}</h1>
          <p className="text-muted-foreground mt-1">{l("עדכן את פרטי הקורס", "Update course details", "حدّث تفاصيل الدورة")}</p>
        </div>
      </div>

      {err && (
        <Card className="p-4 border-red-200 bg-red-50 text-red-700">
          {l("שגיאה", "Error", "خطأ")}: {err}
        </Card>
      )}

      {/* סטטוס הקורס */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="text-right">
          <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            {l("סטטוס הקורס", "Course Status", "حالة الدورة")}
          </CardTitle>
          <CardDescription className="text-right">{l("בחר את סטטוס הקורס והגדרות בסיסיות", "Choose course status and basic settings", "اختر حالة الدورة والإعدادات الأساسية")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-right block">{l("סטטוס", "Status", "الحالة")}</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder={l("בחר סטטוס", "Choose status", "اختر الحالة")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{l("פעיל", "Active", "نشط")}</SelectItem>
                  <SelectItem value="completed">{l("הושלם", "Completed", "مكتمل")}</SelectItem>
                  <SelectItem value="inactive">{l("לא פעיל", "Inactive", "غير نشط")}</SelectItem>
                  <SelectItem value="draft">{l("טיוטה", "Draft", "مسودة")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-right block">{l("סוג קורס", "Course Type", "نوع الدورة")}</Label>
              <Select value={formData.courseType} onValueChange={(value) => {
                const updates: any = { courseType: value, schoolId: "", gafanProgramId: "" }
                // כשנבחר גפ"ן, מספר המפגשים הופך ל-30 כברירת מחדל
                if (value === "gafan" && !formData.duration) {
                  updates.duration = "30"
                }
                setFormData({...formData, ...updates})
              }}>
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder={l("בחר סוג", "Choose type", "اختر النوع")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">{l("קורס רגיל", "Regular Course", "دورة عادية")}</SelectItem>
                  <SelectItem value="workshop">{l("סדנה", "Workshop", "ورشة")}</SelectItem>
                  <SelectItem value="camp">{l("קייטנה", "Camp", "مخيّم")}</SelectItem>
                  <SelectItem value="private">{l("שיעור פרטי", "Private Lesson", "درس خاص")}</SelectItem>
                  <SelectItem value="gafan">גפ"ן</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-right block">{l("מיקום", "Location", "الموقع")}</Label>
              <Select value={formData.location} onValueChange={(value) => setFormData({...formData, location: value})}>
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder={l("בחר מיקום", "Choose location", "اختر الموقع")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">{l("במרכז", "At Center", "في المركز")}</SelectItem>
                  <SelectItem value="school">{l("בבית ספר", "At School", "في المدرسة")}</SelectItem>
                  <SelectItem value="online">{l("אונליין", "Online", "أونلاين")}</SelectItem>
                  <SelectItem value="other">{l("אחר", "Other", "أخرى")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-blue-200 bg-white/70 p-3">
            <div
              className="flex items-center justify-end gap-2 cursor-pointer"
              onClick={() => setFormData((prev) => ({ ...prev, showRegistrationLink: !prev.showRegistrationLink }))}
            >
              <span className="text-sm">
                {l(
                  "הצג לינק רישום לתלמידים שלא רשומים לקורס",
                  "Show registration link to students not enrolled in this course",
                  "إظهار رابط التسجيل للطلاب غير المسجلين في هذه الدورة"
                )}
              </span>
              <Checkbox checked={formData.showRegistrationLink} />
            </div>
          </div>
          
          {/* שדות גפ"ן - מוצגים רק כאשר סוג הקורס הוא גפ"ן */}
          {formData.courseType === "gafan" && (
            <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="space-y-2">
                <Label className="text-right block text-amber-700 dark:text-amber-400">בית ספר *</Label>
                <Select value={formData.schoolId} onValueChange={(value) => setFormData({...formData, schoolId: value})}>
                  <SelectTrigger className="text-right" dir="rtl">
                    <SelectValue placeholder="בחר בית ספר" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name} {school.city ? `- ${school.city}` : ""}
                      </SelectItem>
                    ))}
                    {schools.length === 0 && (
                      <SelectItem value="" disabled>לא נמצאו בתי ספר</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
  <div className="space-y-2">
  <Label className="text-right block text-amber-700 dark:text-amber-400">תוכנית גפ"ן *</Label>
  <Select value={formData.gafanProgramId} onValueChange={(value) => {
    // מצא את התוכנית שנבחרה ומלא את השדות אוטומטית
    const selectedProgram = gafanPrograms.find(p => p.id === value)
    if (selectedProgram) {
      setFormData({
        ...formData, 
        gafanProgramId: value,
        name: selectedProgram.name || formData.name,
        courseNumber: selectedProgram.programNumber || formData.courseNumber,
        validYear: selectedProgram.validYear?.toString() || formData.validYear,
        price: selectedProgram.priceMin?.toString() || formData.price,
      })
    } else {
      setFormData({...formData, gafanProgramId: value})
    }
  }}>
  <SelectTrigger className="text-right" dir="rtl">
  <SelectValue placeholder="בחר תוכנית" />
  </SelectTrigger>
  <SelectContent>
  {gafanPrograms.map((program) => (
  <SelectItem key={program.id} value={program.id}>
  {program.name}
  </SelectItem>
  ))}
  {gafanPrograms.length === 0 && (
  <SelectItem value="" disabled>לא נמצאו תוכניות גפ"ן</SelectItem>
  )}
  </SelectContent>
  </Select>
  </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* מידע כללי / מידע בסיסי על התוכנית (לגפ"ן) */}
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="text-right">
          <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
            <BookOpen className="h-5 w-5 text-green-600" />
            {formData.courseType === "gafan" ? "מידע בסיסי על התוכנית" : "מידע כללי"}
          </CardTitle>
          <CardDescription className="text-right">
            {formData.courseType === "gafan" ? "פרטי תוכנית גפ\"ן הראשוניים" : "פרטי הקורס הבסיסיים"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {formData.courseType === "gafan" ? (
            /* שדות גפ"ן */
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-right block">מס' תוכנית *</Label>
                  <Input
                    value={formData.courseNumber}
                    onChange={(e) => setFormData({...formData, courseNumber: e.target.value})}
                    placeholder="לדוגמה: GP2024-001"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">תוקף לשנה *</Label>
                  <Input
                    type="number"
                    value={formData.validYear}
                    onChange={(e) => setFormData({...formData, validYear: e.target.value})}
                    placeholder={new Date().getFullYear().toString()}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-right block">שם התוכנית *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="לדוגמה: תוכנית רובוטיקה בית ספרית"
                  className="text-right"
                  dir="rtl"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-right block">מספר מפגשים</Label>
                <Input 
                  type="number"
                  value={formData.duration} 
                  onChange={(e) => setFormData({...formData, duration: e.target.value})} 
                  placeholder="30"
                  className="text-right"
                  dir="rtl"
                />
              </div>
            </>
          ) : (
            /* שדות קורס רגיל */
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-right block">מס' קורס</Label>
                  <Input
                    value={formData.courseNumber}
                    onChange={(e) => setFormData({...formData, courseNumber: e.target.value})}
                    placeholder="לדוגמה: ROB-001"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">קטגוריה</Label>
                  <Select
                    value={courseCategories.some(c => c.name === formData.category) ? formData.category : "__other__"}
                    onValueChange={(v) => setFormData({ ...formData, category: v === "__other__" ? formData.category : v })}
                  >
                    <SelectTrigger className="text-right w-full" dir="rtl">
                      <SelectValue placeholder="בחר קטגוריה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__other__" className="text-right">אחר (הזן ידנית)</SelectItem>
                      {courseCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.name} className="text-right">{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(formData.category === "" || !courseCategories.some(c => c.name === formData.category)) && (
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="הזן שם קטגוריה"
                      className="text-right mt-1"
                      dir="rtl"
                    />
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-right block">שם הקורס *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="לדוגמה: רובוטיקה מתקדמת"
                  className="text-right"
                  dir="rtl"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-right block">תיאור *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="תאר את תוכן הקורס, היעדים והנושאים שילמדו..."
                  rows={3}
                  className="text-right"
                  dir="rtl"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-right block">רמה</Label>
                  <Select value={formData.level} onValueChange={(value) => setFormData({...formData, level: value})}>
                    <SelectTrigger className="text-right" dir="rtl">
                      <SelectValue placeholder="בחר רמה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">מתחילים</SelectItem>
                      <SelectItem value="intermediate">מתקדמים</SelectItem>
                      <SelectItem value="advanced">מומחים</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">מספר מפגשים</Label>
                  <Input 
                    type="number"
                    value={formData.duration} 
                    onChange={(e) => setFormData({...formData, duration: e.target.value})} 
                    placeholder="לדוגמה: 12"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* מורים */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardHeader className="text-right">
          <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            {l("מורים", "Teachers", "المعلمون")}
          </CardTitle>
          <CardDescription className="text-right">{l("בחר את המורים שילמדו בקורס", "Select teachers for this course", "اختر المعلمين لهذه الدورة")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                className={`flex items-center justify-end gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.teacherIds.includes(teacher.id)
                    ? "bg-purple-100 border-purple-300"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => toggleTeacher(teacher.id)}
              >
                <span className="text-sm">{teacher.name}</span>
                <Checkbox checked={formData.teacherIds.includes(teacher.id)} />
              </div>
            ))}
            {teachers.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-4">{l("לא נמצאו מורים במערכת", "No teachers found", "لم يتم العثور على معلمين")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* תאריכים וזמנים */}
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader className="text-right">
          <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
            <Calendar className="h-5 w-5 text-orange-600" />
            {l("תאריכים וזמנים", "Dates & Times", "التواريخ والأوقات")}
          </CardTitle>
          <CardDescription className="text-right">הגדר את לוח הזמנים של הקורס</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-right block">תאריך התחלה *</Label>
              <Input 
                type="date"
                value={formData.startDate} 
                onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-right block">תאריך סיום (אופציונלי)</Label>
              <Input 
                type="date"
                value={formData.endDate} 
                onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                className="text-right"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-right block">שעה התחלה *</Label>
              <Input 
                type="time"
                value={formData.startTime} 
                onChange={(e) => setFormData({...formData, startTime: e.target.value})} 
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-right block">שעה סיום (אופציונלי)</Label>
              <Input 
                type="time"
                value={formData.endTime} 
                onChange={(e) => setFormData({...formData, endTime: e.target.value})} 
                className="text-right"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-right block">ימי שבוע *</Label>
            <div className="grid grid-cols-4 gap-3">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day.value}
                  className={`flex items-center justify-end gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.daysOfWeek.includes(day.value)
                      ? "bg-orange-100 border-orange-300"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                  onClick={() => toggleDay(day.value)}
                >
                  <span className="text-sm">{day.label}</span>
                  <Checkbox checked={formData.daysOfWeek.includes(day.value)} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* תמחור */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader className="text-right">
          <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
            <span className="text-emerald-600 font-bold text-lg">₪</span>
            תמחור
          </CardTitle>
          <CardDescription className="text-right">
            {formData.courseType === "gafan"
              ? "הגדר את מחיר השעה לקורס גפ\"ן"
              : formData.pricingMode === "perCourse"
                ? "מחיר כולל לקורס כולו"
                : "הגדר את מחיר הקורס"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formData.courseType !== "gafan" && (
            <div className="space-y-2 mb-4">
              <Label className="text-right block">שיטת תמחור</Label>
              <Select
                value={formData.pricingMode}
                onValueChange={(value: "perStudent" | "perCourse" | "perSession" | "perHour") => setFormData({ ...formData, pricingMode: value })}
              >
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="בחר שיטת תמחור" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="perStudent">מחיר לכל תלמיד</SelectItem>
                  <SelectItem value="perCourse">מחיר כולל לקורס</SelectItem>
                  <SelectItem value="perSession">מחיר לפי מפגש</SelectItem>
                  <SelectItem value="perHour">מחיר לפי שעה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-right block">
              {formData.courseType === "gafan"
                ? "מחיר לשעה (ש\"ח) *"
                : formData.pricingMode === "perHour"
                  ? "מחיר לשעה (ש\"ח) *"
                  : formData.pricingMode === "perSession"
                    ? "מחיר למפגש (ש\"ח) *"
                : formData.pricingMode === "perCourse"
                  ? "מחיר כולל לקורס (ש\"ח) *"
                  : "מחיר הקורס (ש\"ח) *"}
            </Label>
            <Input 
              type="number"
              value={formData.price} 
              onChange={(e) => setFormData({...formData, price: e.target.value})} 
              placeholder={formData.courseType === "gafan" ? "לדוגמה: 50" : "לדוגמה: 2500"}
              className="text-right"
              dir="rtl"
            />
            {formData.courseType === "gafan" && (
              <p className="text-xs text-muted-foreground text-right mt-1">
                * בקורסי גפ"ן התמחור הוא לפי שעה ולא לפי קורס שלם
              </p>
            )}
            {needsSessionCount && (
              <div className="text-right space-y-1 pt-2 border-t border-emerald-200/80 mt-3">
                <p className="text-sm text-muted-foreground">
                  מפגשים בטווח: <span className="font-medium text-foreground">{computedSessionCount}</span>
                  {needsHourlyRange && hoursPerSession != null && (
                    <span className="mr-2">· {hoursPerSession.toFixed(2)} שעות למפגש</span>
                  )}
                </p>
                <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
                  סה״כ מחושב לקורס: {computedCoursePrice > 0 ? `${computedCoursePrice} ש״ח` : "—"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* כפתורים */}
      <div className="flex gap-3 justify-start">
        <Button onClick={save} disabled={!formData.name.trim() || saving} className="gap-2 bg-primary">
          <Save className="h-4 w-4" />
          {saving ? l("שומר...", "Saving...", "جارٍ الحفظ...") : l("שמור שינויים", "Save Changes", "حفظ التغييرات")}
        </Button>
        <Button variant="outline" onClick={() => router.back()} className="bg-transparent">
          {l("ביטול", "Cancel", "إلغاء")}
        </Button>
      </div>
    </div>
  )
}
