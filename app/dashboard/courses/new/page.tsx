"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowRight, BookOpen, Save, Calendar, Users, MessageSquare } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import { listCampSessionDates } from "@/lib/camp-kaytana"
import { PerSessionPriceList } from "@/components/course/per-session-price-list"

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

interface SiblingPackage {
  id: string
  name: string
  pricingMode: "perStudent" | "perCourse" | "perSession" | "perHour"
  isActive: boolean
}

interface TariffProfile {
  id: string
  name: string
  pricingMethod?: string
  isActive?: boolean
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

/** שדות time מהדפדפן: HH:MM או HH:MM:SS */
function hoursBetweenTimeInputs(start: string, end: string): number | null {
  if (!start?.trim() || !end?.trim()) return null
  const parse = (t: string) => {
    const parts = t.trim().split(":")
    const h = Number(parts[0])
    const m = Number(parts[1] ?? 0)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }
  const startMin = parse(start)
  const endMin = parse(end)
  if (startMin === null || endMin === null) return null
  const diff = endMin - startMin
  if (diff <= 0) return null
  return diff / 60
}

export default function NewCoursePage() {
  const { locale } = useLanguage()
  const isRtl = locale !== "en"
  const l = (he: string, en: string, ar: string) => (locale === "en" ? en : locale === "ar" ? ar : he)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [gafanPrograms, setGafanPrograms] = useState<GafanProgram[]>([])
  const [siblingPackages, setSiblingPackages] = useState<SiblingPackage[]>([])
  const [courseCategories, setCourseCategories] = useState<{ id: string; name: string }[]>([])
  const [tariffProfiles, setTariffProfiles] = useState<TariffProfile[]>([])
  const [teacherTariffByTeacherId, setTeacherTariffByTeacherId] = useState<Record<string, string>>({})
  const [sessionPricesByDate, setSessionPricesByDate] = useState<Record<string, string>>({})
  const [pricingDropdownValue, setPricingDropdownValue] = useState("pricing:perStudent")

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
    campChargeFirstSessionIfNoAttendance: false,
    useStudentSiblingDiscountInCourse: true,
    siblingDiscountPackageId: "",
    /** שיטת תמחור */
    pricingMode: "perStudent" as "perStudent" | "perCourse" | "perSession" | "perHour",
    billingPlan: "summer" as "summer" | "discounted" | "perSession",
    billingPlanSelectionMode: "pricing" as "pricing" | "billing",
    billingPlanSummerPrice: "",
    billingPlanDiscountedPrice: "",
    billingPlanPerSessionPrice: "",
  })
  useEffect(() => {
    if (formData.billingPlanSelectionMode === "billing") {
      setPricingDropdownValue("billing:enabled")
      return
    }
    setPricingDropdownValue(`pricing:${formData.pricingMode}`)
  }, [formData.pricingMode, formData.billingPlan, formData.billingPlanSelectionMode])

  const baseCourseType = normalizeCourseType(formData.courseType)
  const isBillingMode = formData.billingPlanSelectionMode === "billing"
  const isPerCourseMode = !isBillingMode && formData.pricingMode === "perCourse"
  const isPerSessionMode = !isBillingMode && formData.pricingMode === "perSession"
  const isPerHourMode = !isBillingMode && formData.pricingMode === "perHour"
  const isPerStudentMode = !isBillingMode && formData.pricingMode === "perStudent"
  const needsSessionCount =
    isPerSessionMode || isPerHourMode
  const needsHourlyRange = formData.pricingMode === "perHour"
  const hoursPerSession = useMemo(
    () => hoursBetweenTimeInputs(formData.startTime, formData.endTime),
    [formData.startTime, formData.endTime],
  )
  const computedSessionCount = useMemo(
    () =>
      needsSessionCount
        ? listCampSessionDates(formData.startDate, formData.endDate, formData.daysOfWeek).length
        : 0,
    [needsSessionCount, formData.startDate, formData.endDate, formData.daysOfWeek],
  )
  const sessionDatesList = useMemo(
    () =>
      formData.pricingMode === "perSession"
        ? listCampSessionDates(formData.startDate, formData.endDate, formData.daysOfWeek)
        : [],
    [formData.pricingMode, formData.startDate, formData.endDate, formData.daysOfWeek],
  )
  const defaultPriceRef = useRef(formData.price)
  defaultPriceRef.current = formData.price

  useEffect(() => {
    if (formData.pricingMode !== "perSession") {
      setSessionPricesByDate({})
      return
    }
    const dates = listCampSessionDates(formData.startDate, formData.endDate, formData.daysOfWeek)
    setSessionPricesByDate((prev) => {
      const next: Record<string, string> = {}
      const def = defaultPriceRef.current
      for (const d of dates) {
        if (prev[d] != null && prev[d] !== "") next[d] = prev[d]
        else next[d] = def
      }
      return next
    })
  }, [formData.pricingMode, formData.startDate, formData.endDate, formData.daysOfWeek])

  const computedCoursePrice = useMemo(() => {
    if (!needsSessionCount) return 0
    if (needsHourlyRange) {
      const p = Number(formData.price)
      if (Number.isNaN(p)) return 0
      if (hoursPerSession == null || hoursPerSession <= 0) return 0
      return Math.round(computedSessionCount * hoursPerSession * p * 100) / 100
    }
    if (formData.pricingMode === "perSession" && sessionDatesList.length > 0) {
      const def = Number(formData.price)
      let sum = 0
      for (const d of sessionDatesList) {
        const v = Number(sessionPricesByDate[d])
        if (Number.isFinite(v) && v >= 0) sum += v
        else if (Number.isFinite(def) && def >= 0) sum += def
      }
      return Math.round(sum * 100) / 100
    }
    const p = Number(formData.price)
    if (Number.isNaN(p)) return 0
    return Math.round(computedSessionCount * p * 100) / 100
  }, [
    needsSessionCount,
    computedSessionCount,
    formData.price,
    formData.pricingMode,
    needsHourlyRange,
    hoursPerSession,
    sessionDatesList,
    sessionPricesByDate,
  ])

  useEffect(() => {
    // Fetch teachers
    fetch("/api/teachers", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTeachers(data)
      })
      .catch(console.error)
    
    // Fetch schools
    fetch("/api/schools", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSchools(data)
      })
      .catch(console.error)
    
    // Fetch Gafan programs
    fetch("/api/gafan", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setGafanPrograms(data)
      })
      .catch(console.error)

    fetch("/api/course-categories", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCourseCategories(data)
      })
      .catch(console.error)

    fetch("/api/sibling-discount-packages", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSiblingPackages(data.filter((p: any) => p?.isActive !== false))
      })
      .catch(console.error)

    fetch("/api/teacher-tariff-profiles", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setTariffProfiles(data)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (tariffProfiles.length === 0) return
    setTeacherTariffByTeacherId((prev) => {
      const def = tariffProfiles.find((p) => p.isActive !== false)?.id || tariffProfiles[0]?.id || ""
      let changed = false
      const next = { ...prev }
      formData.teacherIds.forEach((tid) => {
        if (!String(next[tid] || "").trim()) {
          next[tid] = def
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [tariffProfiles, formData.teacherIds])

  function toggleDay(day: string) {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }))
  }

  function toggleTeacher(teacherId: string) {
    setFormData((prev) => {
      const adding = !prev.teacherIds.includes(teacherId)
      const nextIds = adding
        ? [...prev.teacherIds, teacherId]
        : prev.teacherIds.filter((id) => id !== teacherId)
      setTeacherTariffByTeacherId((tm) => {
        if (adding) {
          const def =
            tariffProfiles.find((p) => p.isActive !== false)?.id || tariffProfiles[0]?.id || ""
          return { ...tm, [teacherId]: tm[teacherId] || def }
        }
        const { [teacherId]: _, ...rest } = tm
        return rest
      })
      return { ...prev, teacherIds: nextIds }
    })
  }

  async function save() {
    if (!formData.name.trim()) {
      setErr(l("שם הקורס הוא שדה חובה", "Course name is required", "اسم الدورة مطلوب"))
      return
    }

    if (formData.teacherIds.length > 0) {
      if (tariffProfiles.length === 0) {
        setErr("יש להגדיר פרופיל תעריף מורה בהגדרות המרכז (תעריפי מורים) לפני שמירת קורס עם מורים")
        return
      }
      for (const tid of formData.teacherIds) {
        if (!String(teacherTariffByTeacherId[tid] || "").trim()) {
          setErr("יש לבחור פרופיל תעריף לכל מורה משויך לקורס")
          return
        }
      }
    }

    if (needsSessionCount) {
      if (!formData.startDate || !formData.endDate) {
        setErr("לסדנה / קייטנה / שיעור פרטי יש למלא תאריך התחלה ותאריך סיום לחישוב המפגשים")
        return
      }
      if (formData.daysOfWeek.length === 0) {
        setErr("בחר לפחות יום אחד בשבוע לחישוב מספר המפגשים")
        return
      }
      if (computedSessionCount === 0) {
        setErr("לא נמצאו מפגשים בטווח התאריכים ובימים שנבחרו — בדוק תאריכים וימי שבוע")
        return
      }
      if (needsHourlyRange) {
        const per = Number(formData.price)
        if (Number.isNaN(per) || per <= 0) {
          setErr("הזן מחיר חיובי לשעה")
          return
        }
        if (!formData.startTime?.trim() || !formData.endTime?.trim()) {
          setErr("בתמחור לפי שעה יש למלא שעת התחלה ושעת סיום לחישוב אורך המפגש")
          return
        }
        if (hoursPerSession == null || hoursPerSession <= 0) {
          setErr("שעת הסיום חייבת להיות אחרי שעת ההתחלה כדי לחשב שעות למפגש")
          return
        }
      } else if (formData.pricingMode === "perSession") {
        if (computedCoursePrice <= 0) {
          setErr("הזן מחיר חיובי לכל מפגש או מחיר ברירת מחדל למפגש")
          return
        }
      }
    }

    setSaving(true)
    setErr(null)
    try {
      const durationOut = needsSessionCount
        ? computedSessionCount
        : formData.duration
          ? Number(formData.duration)
          : null
      const priceOut = needsSessionCount
        ? computedCoursePrice
        : formData.price
          ? Number(formData.price)
          : null
      const courseTypeOut =
        baseCourseType === "gafan"
          ? "gafan"
          : formData.pricingMode === "perCourse"
            ? `${baseCourseType}${TOTAL_PRICE_SUFFIX}`
            : formData.pricingMode === "perSession"
              ? `${baseCourseType}${SESSION_PRICE_SUFFIX}`
              : formData.pricingMode === "perHour"
                ? `${baseCourseType}${HOURLY_PRICE_SUFFIX}`
                : baseCourseType

      const sessionPricesPayload: Record<string, number> | undefined =
        formData.pricingMode === "perSession" && sessionDatesList.length > 0
          ? Object.fromEntries(
              sessionDatesList.map((d) => {
                const n = Number(sessionPricesByDate[d] ?? formData.price)
                return [d, Math.round(n * 100) / 100]
              }),
            )
          : undefined

      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          billingPlanSummerPrice: formData.billingPlanSummerPrice ? Number(formData.billingPlanSummerPrice) : null,
          billingPlanDiscountedPrice: formData.billingPlanDiscountedPrice ? Number(formData.billingPlanDiscountedPrice) : null,
          billingPlanPerSessionPrice: formData.billingPlanPerSessionPrice ? Number(formData.billingPlanPerSessionPrice) : null,
          billingPlanSelectionMode: formData.billingPlanSelectionMode,
          teacherTariffByTeacherId,
          courseType: courseTypeOut,
          duration: durationOut,
          price: priceOut,
          ...(sessionPricesPayload ? { sessionPrices: sessionPricesPayload } : {}),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? `Failed (${res.status})`)
      }
      router.push("/dashboard/courses")
    } catch (e: any) {
      setErr(e?.message ?? l("שגיאה ביצירת קורס", "Failed to create", "فشل إنشاء الدورة"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="container mx-auto max-w-4xl space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div className="flex items-start gap-3">
        <Link href="/dashboard/courses" className="shrink-0">
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{l("קורס חדש", "New Course", "دورة جديدة")}</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{l("הוסף קורס חדש למערכת הרובוטיקה", "Add a new course to the system", "أضف دورة جديدة إلى النظام")}</p>
        </div>
      </div>

      {err && (
        <Card className="p-4 border-red-200 bg-red-50 text-red-700">
          {l("שגיאה", "Error", "خطأ")}: {err}
        </Card>
      )}

      <Tabs defaultValue="general" className="w-full" dir={isRtl ? "rtl" : "ltr"}>
        <TabsList className="mb-4 grid w-full grid-cols-2 gap-2 sm:grid-cols-5" dir={isRtl ? "rtl" : "ltr"}>
          <TabsTrigger value="general" className={isRtl ? "text-right" : ""}>{l("כללי", "General", "عام")}</TabsTrigger>
          <TabsTrigger value="schedule" className={isRtl ? "text-right" : ""}>{l("זמנים", "Schedule", "الجدول")}</TabsTrigger>
          <TabsTrigger value="teachers" className={isRtl ? "text-right" : ""}>{l("מורים", "Teachers", "المعلمون")}</TabsTrigger>
          <TabsTrigger value="pricing" className={isRtl ? "text-right" : ""}>{l("תמחור", "Pricing", "التسعير")}</TabsTrigger>
          <TabsTrigger value="settings" className={isRtl ? "text-right" : ""}>{l("הגדרות", "Settings", "الإعدادات")}</TabsTrigger>
        </TabsList>

      {/* סטטוס הקורס */}
      <TabsContent value="general" dir={isRtl ? "rtl" : "ltr"}>
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="text-right">
          <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            {l("סטטוס הקורס", "Course Status", "حالة الدورة")}
          </CardTitle>
          <CardDescription className="text-right">{l("בחר את סטטוס הקורס והגדרות בסיסיות", "Choose course status and basic settings", "اختر حالة الدورة والإعدادات الأساسية")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <Select value={baseCourseType} onValueChange={(value) => {
                const updates: Record<string, unknown> = { courseType: value, schoolId: "", gafanProgramId: "" }
                if (value === "gafan") {
                  updates.duration = "30"
                }
                updates.pricingMode = value === "gafan" ? "perStudent" : formData.pricingMode
                if (value !== "camp") updates.campChargeFirstSessionIfNoAttendance = false
                setFormData({ ...formData, ...updates } as typeof formData)
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
                  <SelectItem value="travel">{l("נסיעות", "Travel", "تنقّل")}</SelectItem>
                  <SelectItem value="school">{l("בבית ספר", "At School", "في المدرسة")}</SelectItem>
                  <SelectItem value="online">{l("אונליין", "Online", "أونلاين")}</SelectItem>
                  <SelectItem value="other">{l("אחר", "Other", "أخرى")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* שדות גפ"ן - מוצגים רק כאשר סוג הקורס הוא גפ"ן */}
          {formData.courseType === "gafan" && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20 sm:grid-cols-2">
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
      </TabsContent>

{/* מידע כללי / מידע בסיסי על התוכנית (לגפ"ן) */}
  <TabsContent value="general" dir={isRtl ? "rtl" : "ltr"}>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          {needsSessionCount ? (
            <>
              <Label className="text-right block">מספר מפגשים (מחושב אוטומטית)</Label>
              <div className="text-right rounded-md border bg-muted/50 px-3 py-2 text-sm min-h-[40px] flex items-center justify-end">
                {computedSessionCount > 0 ? (
                  <span className="font-semibold text-lg">{computedSessionCount}</span>
                ) : (
                  <span className="text-muted-foreground">הגדר תאריך התחלה, סיום וימי שבוע ב&quot;תאריכים וזמנים&quot;</span>
                )}
              </div>
            </>
          ) : (
            <>
              <Label className="text-right block">מספר מפגשים</Label>
              <Input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="לדוגמה: 12"
                className="text-right"
                dir="rtl"
              />
            </>
          )}
        </div>
      </div>
    </>
  )}
  </CardContent>
  </Card>
  </TabsContent>

      <TabsContent value="settings" dir={isRtl ? "rtl" : "ltr"}>
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader className="text-right">
          <CardTitle>{l("הגדרות", "Settings", "الإعدادات")}</CardTitle>
          <CardDescription className="text-right">
            {l("אפשרויות כלליות לקורס", "General course options", "خيارات عامة للدورة")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-white p-3">
            <div
              className="flex cursor-pointer items-center justify-end gap-2"
              onClick={() => setFormData((prev) => ({ ...prev, showRegistrationLink: !prev.showRegistrationLink }))}
            >
              <span className="text-sm">
                {l(
                  "הצג לינק רישום לתלמידים שלא רשומים לקורס",
                  "Show registration link to students not enrolled in this course",
                  "إظهار رابط التسجيل للطلاب غير المسجلين في هذه الدورة",
                )}
              </span>
              <Checkbox checked={formData.showRegistrationLink} />
            </div>
          </div>

          {baseCourseType === "camp" && (
            <div className="rounded-md border bg-white p-3">
              <div
                className="flex cursor-pointer items-center justify-end gap-2"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    campChargeFirstSessionIfNoAttendance: !prev.campChargeFirstSessionIfNoAttendance,
                  }))
                }
              >
                <span className="text-sm">
                  {l(
                    "בקייטנה: תלמיד שלא נכח בכלל יחויב לפי מחיר המפגש הראשון",
                    "Camp: if a student has no attendance at all, charge by the first session price",
                    "في المخيم: الطالب الذي لم يحضر إطلاقًا يُحاسب بسعر الجلسة الأولى",
                  )}
                </span>
                <Checkbox checked={formData.campChargeFirstSessionIfNoAttendance} />
              </div>
            </div>
          )}

          <div className="rounded-md border bg-white p-3">
            <div
              className="flex cursor-pointer items-center justify-end gap-2"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  useStudentSiblingDiscountInCourse: !prev.useStudentSiblingDiscountInCourse,
                }))
              }
            >
              <span className="text-sm">החל הנחת אחים שמוגדרת על התלמיד גם בקורס הזה</span>
              <Checkbox checked={formData.useStudentSiblingDiscountInCourse} />
            </div>
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      {/* מורים */}
      <TabsContent value="teachers" dir={isRtl ? "rtl" : "ltr"}>
      <Card className="border-purple-200 bg-purple-50/50">
        <CardHeader className="text-right">
          <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            {l("מורים", "Teachers", "المعلمون")}
          </CardTitle>
          <CardDescription className="text-right">{l("בחר את המורים שילמדו בקורס", "Select teachers for this course", "اختر المعلمين لهذه الدورة")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
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
          {formData.teacherIds.length > 0 && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <Label className="text-right block text-sm font-medium">
                פרופיל תעריף לפי מורה (מוגדר בהגדרות המרכז)
              </Label>
              <p className="text-xs text-muted-foreground text-right">
                לכל מורה בקורס נבחרת שיטת חישוב נפרדת.
              </p>
              <div className="space-y-2">
                {formData.teacherIds.map((tid) => {
                  const tname = teachers.find((x) => x.id === tid)?.name || tid
                  return (
                    <div key={tid} className="flex flex-col gap-1 rounded-md border bg-white p-3 md:flex-row md:items-center md:justify-between">
                      <span className="text-sm font-medium">{tname}</span>
                      <Select
                        value={teacherTariffByTeacherId[tid] || ""}
                        onValueChange={(v) =>
                          setTeacherTariffByTeacherId((prev) => ({ ...prev, [tid]: v }))
                        }
                      >
                        <SelectTrigger className="md:w-72">
                          <SelectValue placeholder="בחר פרופיל" />
                        </SelectTrigger>
                        <SelectContent>
                          {tariffProfiles
                            .filter((p) => p.isActive !== false)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                                {p.pricingMethod === "per_student_tier" ? " (לפי תלמידים)" : " (רגיל)"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      {/* תאריכים וזמנים */}
      <TabsContent value="schedule" dir={isRtl ? "rtl" : "ltr"}>
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader className="text-right">
          <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
            <Calendar className="h-5 w-5 text-orange-600" />
            {l("תאריכים וזמנים", "Dates & Times", "التواريخ والأوقات")}
          </CardTitle>
          <CardDescription className="text-right">
            הגדר את לוח הזמנים של הקורס
            {needsSessionCount && (
              <span className="block mt-1 text-amber-800 dark:text-amber-200">
                לסדנה / קייטנה / שיעור פרטי: תאריך סיום חובה לחישוב מספר המפגשים לפי ימי השבוע שנבחרו.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Label className="text-right block">
                תאריך סיום{needsSessionCount ? " *" : " (אופציונלי)"}
              </Label>
              <Input 
                type="date"
                value={formData.endDate} 
                onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                className="text-right"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Label className="text-right block">
                שעה סיום
                {needsHourlyRange ? " *" : " (אופציונלי)"}
              </Label>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      </TabsContent>

{/* תמחור */}
  <TabsContent value="pricing" dir={isRtl ? "rtl" : "ltr"}>
  <Card className="border-emerald-200 bg-emerald-50/50">
  <CardHeader className="text-right">
  <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
  <span className="text-emerald-600 font-bold text-lg">₪</span>
  תמחור
  </CardTitle>
  <CardDescription className="text-right">
    {formData.courseType === "gafan"
      ? "הגדר את מחיר השעה לקורס גפ\"ן"
      : isBillingMode
        ? "תמחור לפי תוכנית חיוב לתלמיד"
        : needsSessionCount
        ? needsHourlyRange
          ? "מחיר לשעה × אורך מפגש × מספר מפגשים (שעות ותאריכים מהכרטיסייה למעלה)"
          : formData.pricingMode === "perSession"
            ? "מחיר ברירת מחדל למפגש + רשימת מפגשים (ניתן לשנות מחיר לכל תאריך)"
            : "מחיר לכל מפגש; סה״כ = מחיר למפגש × מספר מפגשים"
        : formData.pricingMode === "perCourse"
          ? "מחיר כולל לקורס כולו"
          : "הגדר את מחיר הקורס"}
  </CardDescription>
  </CardHeader>
  <CardContent>
  <div className="space-y-3">
  {baseCourseType !== "gafan" && (
    <div className="mb-4 space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
        <div className="space-y-2">
          <Label className="text-right block">שיטות תמחור ותוכנית חיוב</Label>
          <Select
            value={pricingDropdownValue}
            onValueChange={(value) => {
              setPricingDropdownValue(value)
              if (value.startsWith("pricing:")) {
                const pricingMode = value.replace("pricing:", "") as "perStudent" | "perCourse" | "perSession" | "perHour"
                setFormData({ ...formData, pricingMode, billingPlanSelectionMode: "pricing" })
                return
              }
              if (value === "billing:enabled") {
                setFormData({ ...formData, billingPlanSelectionMode: "billing" })
              }
            }}
          >
            <SelectTrigger className="text-right" dir="rtl">
              <SelectValue placeholder="בחר שיטה" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pricing:perStudent">מחיר לכל תלמיד</SelectItem>
              <SelectItem value="pricing:perCourse">מחיר כולל לקורס</SelectItem>
              <SelectItem value="pricing:perSession">מחיר לפי מפגש</SelectItem>
              <SelectItem value="pricing:perHour">מחיר לפי שעה</SelectItem>
              <SelectItem value="billing:enabled">תוכנית חיוב</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {formData.billingPlanSelectionMode === "billing" && (
          <div className="space-y-2">
            <Label className="text-right block">ברירת מחדל לתלמיד בקורס</Label>
            <Select
              value={formData.billingPlan}
              onValueChange={(value: "summer" | "discounted" | "perSession") =>
                setFormData({ ...formData, billingPlan: value })
              }
            >
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summer">תוכנית קיץ</SelectItem>
                <SelectItem value="discounted">תוכנית מוזלת</SelectItem>
                <SelectItem value="perSession">לפי מפגש</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )}
  {formData.billingPlanSelectionMode === "billing" && (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="space-y-2">
        <Label className="text-right block">מחיר תוכנית קיץ (ש"ח)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={formData.billingPlanSummerPrice}
          onChange={(e) => setFormData({ ...formData, billingPlanSummerPrice: e.target.value })}
          className="text-right"
          dir="rtl"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-right block">מחיר תוכנית מוזלת (ש"ח)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={formData.billingPlanDiscountedPrice}
          onChange={(e) => setFormData({ ...formData, billingPlanDiscountedPrice: e.target.value })}
          className="text-right"
          dir="rtl"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-right block">מחיר לפי מפגש (ש"ח)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={formData.billingPlanPerSessionPrice}
          onChange={(e) => setFormData({ ...formData, billingPlanPerSessionPrice: e.target.value })}
          className="text-right"
          dir="rtl"
        />
      </div>
    </div>
  )}
  {!isBillingMode && (
  <div className="space-y-2">
    <Label className="text-right block">חבילת הנחת אחים לקורס (אופציונלי)</Label>
    <Select
      value={formData.siblingDiscountPackageId || "none"}
      onValueChange={(value) => setFormData({ ...formData, siblingDiscountPackageId: value === "none" ? "" : value })}
    >
      <SelectTrigger className="text-right" dir="rtl">
        <SelectValue placeholder="ללא חבילה" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">ללא חבילה</SelectItem>
        {siblingPackages.map((pkg) => (
          <SelectItem key={pkg.id} value={pkg.id}>
            {pkg.name} ({pkg.pricingMode === "perStudent" ? "לפי ילד" : pkg.pricingMode === "perCourse" ? "לפי קורס" : pkg.pricingMode === "perSession" ? "לפי מפגש" : "לפי שעה"})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
  )}
  {!isBillingMode && (
  <div className="space-y-2">
  <Label className="text-right block">
    {formData.courseType === "gafan"
      ? "מחיר לשעה (ש\"ח) *"
      : isPerHourMode
        ? "מחיר לשעה (ש\"ח) *"
        : isPerSessionMode
          ? "מחיר ברירת מחדל למפגש (ש\"ח) *"
          : isPerCourseMode
            ? "מחיר כולל לקורס (ש\"ח) *"
            : isPerStudentMode
              ? "מחיר לכל תלמיד (ש\"ח) *"
              : "מחיר (ש\"ח) *"}
  </Label>
  <Input
  type="number"
  min={0}
  step="0.01"
  value={formData.price}
  onChange={(e) => setFormData({...formData, price: e.target.value})}
  placeholder={formData.courseType === "gafan" ? "לדוגמה: 50" : needsSessionCount ? "לדוגמה: 100" : "לדוגמה: 2500"}
  className="text-right"
  dir="rtl"
  />
  {formData.courseType === "gafan" && (
    <p className="text-xs text-muted-foreground text-right mt-1">
      * בקורסי גפ"ן התמחור הוא לפי שעה ולא לפי קורס שלם
    </p>
  )}
  {needsSessionCount && needsHourlyRange && (
    <p className="text-xs text-muted-foreground text-right">
      אורך מפגש מחושב משעת ההתחלה ושעת הסיום. סה״כ שעות בקורס:{" "}
      {hoursPerSession != null && computedSessionCount > 0
        ? `${(hoursPerSession * computedSessionCount).toFixed(2)} שעות`
        : "—"}
    </p>
  )}
  {formData.pricingMode === "perSession" && !needsHourlyRange && sessionDatesList.length > 0 && (
    <PerSessionPriceList
      sessionDates={sessionDatesList}
      values={sessionPricesByDate}
      onChange={setSessionPricesByDate}
      defaultPrice={formData.price}
      defaultPriceLabel='השדה "מחיר ברירת מחדל למפגש" משמש למפגשים חדשים ולכפתור "החל על כל המפגשים".'
    />
  )}
  {needsSessionCount && (
    <div className="text-right space-y-1 pt-2 border-t border-emerald-200/80 mt-3">
      <p className="text-sm text-muted-foreground">
        מפגשים בטווח:{" "}
        <span className="font-medium text-foreground">{computedSessionCount}</span>
        {needsHourlyRange && hoursPerSession != null && (
          <span className="mr-2">
            · {hoursPerSession.toFixed(2)} שעות למפגש
          </span>
        )}
      </p>
      <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
        סה״כ מחושב לקורס: {computedCoursePrice > 0 ? `${computedCoursePrice} ש״ח` : "—"}
      </p>
      <p className="text-xs text-muted-foreground">
        (נשמר במערכת כמחיר מלא לקורס לצורכי תשלומים ודוחות)
      </p>
    </div>
  )}
  </div>
  )}
  </div>
  </CardContent>
  </Card>
  </TabsContent>
  </Tabs>

      {/* כפתורים */}
      <div className="flex gap-3 justify-start">
        <Button onClick={save} disabled={!formData.name.trim() || saving} className="gap-2 bg-primary">
          <Save className="h-4 w-4" />
          {saving ? l("שומר...", "Saving...", "جارٍ الحفظ...") : l("הוסף קורס חדש", "Add New Course", "إضافة دورة جديدة")}
        </Button>
        <Button variant="outline" onClick={() => router.back()} className="bg-transparent">
          {l("ביטול", "Cancel", "إلغاء")}
        </Button>
      </div>
    </div>
  )
}
