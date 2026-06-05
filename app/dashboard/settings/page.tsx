"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Upload, X, Loader2, Hash, Settings2, FolderOpen, Plus, Pencil, Trash2, FileSpreadsheet, Banknote } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/i18n/context"
import { deleteWithUndo } from "@/lib/notify"
import useSWR from "swr"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImportFromExcel } from "@/components/settings/import-from-excel"
import { Checkbox } from "@/components/ui/checkbox"

interface CenterSettings {
  id?: number
  center_name: string
  logo: string
  phone: string
  whatsapp: string
  address: string
  tax_id?: string
  lesson_price?: number
  monthly_price?: number
  registration_fee?: number
  discount_siblings?: number
  max_students_per_class?: number
  camp_classrooms_count?: number
  camp_classrooms?: { number: number; name: string; notes?: string }[]
  camp_classrooms_count?: number
  email?: string
  website?: string
  working_hours?: string
  notes?: string
}

interface CourseCategoryRow {
  id: string
  name: string
  sortOrder: number
  createdAt: string
}

interface SiblingPackageRow {
  id: string
  name: string
  description: string | null
  pricingMode: "perStudent" | "perCourse" | "perSession" | "perHour" | "custom"
  firstAmount: number
  secondAmount: number
  thirdAmount: number
  isActive: boolean
  createdAt: string
}

interface TeacherTariffProfileRow {
  id: string
  name: string
  description: string | null
  pricingMethod: "standard" | "per_student_tier"
  centerHourlyRate: number | null
  travelRate: number | null
  externalCourseRate: number | null
  officeHourlyRate: number | null
  studentTierRates: { upToStudents: number; hourlyRate: number }[]
  bonusEnabled: boolean
  bonusMinStudents: number | null
  bonusPerHour: number
  isActive: boolean
  createdAt: string
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((res) => {
    if (!res.ok) throw new Error("Failed to load settings")
    return res.json()
  })

export default function SettingsPage() {
  const { t } = useLanguage()
  const { data: settingsData, error, mutate, isLoading } = useSWR<CenterSettings>("/api/settings", fetcher)
  const { data: categories = [], mutate: mutateCategories } = useSWR<CourseCategoryRow[]>(
    "/api/course-categories",
    (url: string) => fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : []))
  )
  const { data: siblingPackages = [], mutate: mutateSiblingPackages } = useSWR<SiblingPackageRow[]>(
    "/api/sibling-discount-packages",
    (url: string) => fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : []))
  )
  const { data: teacherTariffProfiles = [], mutate: mutateTeacherTariffProfiles } = useSWR<TeacherTariffProfileRow[]>(
    "/api/teacher-tariff-profiles",
    (url: string) => fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : []))
  )

  const [settings, setSettings] = useState<CenterSettings>({
    center_name: "",
    logo: "",
    phone: "",
    whatsapp: "",
    address: "",
    tax_id: "",
    lesson_price: 0,
    monthly_price: 0,
    registration_fee: 0,
    discount_siblings: 0,
    max_students_per_class: 0,
    camp_classrooms_count: 6,
    camp_classrooms: [],
    email: "",
    website: "",
    working_hours: "",
    notes: "",
  })
  const [logoPreview, setLogoPreview] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const hasHydratedSettingsRef = useRef(false)
  const lastSavedSettingsRef = useRef("")
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; edit: CourseCategoryRow | null; name: string }>({ open: false, edit: null, name: "" })
  const [categorySaving, setCategorySaving] = useState(false)
  const [siblingDialog, setSiblingDialog] = useState<{
    open: boolean
    edit: SiblingPackageRow | null
    name: string
    description: string
    firstAmount: string
    secondAmount: string
    thirdAmount: string
    pricingMode: "perStudent" | "perCourse" | "perSession" | "perHour"
    | "custom"
    isActive: boolean
  }>({
    open: false,
    edit: null,
    name: "",
    description: "",
    firstAmount: "",
    secondAmount: "",
    thirdAmount: "",
    pricingMode: "perCourse",
    isActive: true,
  })
  const [siblingSaving, setSiblingSaving] = useState(false)
  const [tariffDialog, setTariffDialog] = useState<{
    open: boolean
    edit: TeacherTariffProfileRow | null
    name: string
    description: string
    pricingMethod: "standard" | "per_student_tier"
    centerHourlyRate: string
    travelRate: string
    externalCourseRate: string
    officeHourlyRate: string
    tierRates: number[]
    bonusEnabled: boolean
    bonusMinStudents: string
    bonusPerHour: string
    isActive: boolean
  }>({
    open: false,
    edit: null,
    name: "",
    description: "",
    pricingMethod: "standard",
    centerHourlyRate: "50",
    travelRate: "0",
    externalCourseRate: "80",
    officeHourlyRate: "",
    tierRates: Array.from({ length: 10 }, (_, i) => (i === 0 ? 32 : 0)),
    bonusEnabled: false,
    bonusMinStudents: "",
    bonusPerHour: "",
    isActive: true,
  })
  const [tariffSaving, setTariffSaving] = useState(false)
  const { toast } = useToast()
  const classroomsCount = Math.max(1, Math.min(12, Number(settings.camp_classrooms_count || 6)))
  const classroomsRows = Array.from({ length: classroomsCount }, (_, i) => {
    const n = i + 1
    const row = (settings.camp_classrooms || []).find((c) => Number(c?.number) === n)
    return { number: n, name: String(row?.name || `כיתה ${n}`), notes: String(row?.notes || "") }
  })

  useEffect(() => {
    if (settingsData && !error && !hasHydratedSettingsRef.current) {
      setSettings({
        id: settingsData.id,
        center_name: settingsData.center_name || "",
        logo: settingsData.logo || "",
        phone: settingsData.phone || "",
        whatsapp: settingsData.whatsapp || "",
        address: settingsData.address || "",
        tax_id: settingsData.tax_id ?? "",
        lesson_price: settingsData.lesson_price || 0,
        monthly_price: settingsData.monthly_price || 0,
        registration_fee: settingsData.registration_fee || 0,
        discount_siblings: settingsData.discount_siblings || 0,
        max_students_per_class: settingsData.max_students_per_class || 0,
        camp_classrooms_count: Number(settingsData.camp_classrooms_count || 6),
        camp_classrooms: Array.isArray((settingsData as any).camp_classrooms)
          ? (settingsData as any).camp_classrooms.map((c: any) => ({
              number: Number(c?.number || 0),
              name: String(c?.name || ""),
              notes: String(c?.notes || ""),
            }))
          : [],
        email: settingsData.email || "",
        website: settingsData.website || "",
        working_hours: settingsData.working_hours || "",
        notes: settingsData.notes || "",
      })
      if (settingsData.logo) {
        setLogoPreview(settingsData.logo)
      }
      hasHydratedSettingsRef.current = true
      lastSavedSettingsRef.current = JSON.stringify({
        ...settingsData,
        camp_classrooms_count: Number(settingsData.camp_classrooms_count || 6),
      })
    }
  }, [settingsData, error])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setLogoPreview(result)
        setSettings({ ...settings, logo: result })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveLogo = () => {
    setLogoPreview("")
    setSettings({ ...settings, logo: "" })
  }

  const handleSave = async (options?: { silent?: boolean }) => {
    setIsSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        const msg = [errData.message, errData.error, errData.reason].find((x) => typeof x === "string" && x.trim())
        throw new Error(msg || "שגיאה בשמירת ההגדרות")
      }

      const savedSettings = await response.json()
      mutate(savedSettings)
      
      if (!options?.silent) {
        toast({
          title: "ההגדרות נשמרו בהצלחה",
          description: "פרטי המרכז עודכנו במערכת",
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "אנא נסה שנית"
      toast({
        title: "שגיאה בשמירת ההגדרות",
        description: msg,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (!hasHydratedSettingsRef.current) return
    const serialized = JSON.stringify(settings)
    if (serialized === lastSavedSettingsRef.current) return

    const timer = setTimeout(async () => {
      setAutoSaveStatus("saving")
      try {
        await handleSave({ silent: true })
        lastSavedSettingsRef.current = serialized
        setAutoSaveStatus("saved")
      } catch {
        setAutoSaveStatus("error")
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [settings])

  const openAddCategory = () => {
    setCategoryDialog({ open: true, edit: null, name: "" })
  }
  const openEditCategory = (row: CourseCategoryRow) => {
    setCategoryDialog({ open: true, edit: row, name: row.name })
  }
  const saveCategory = async () => {
    const name = categoryDialog.name.trim()
    if (!name) {
      toast({ title: "נא להזין שם קטגוריה", variant: "destructive" })
      return
    }
    setCategorySaving(true)
    try {
      if (categoryDialog.edit) {
        const res = await fetch(`/api/course-categories/${categoryDialog.edit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "errors.updateCategory")
        }
        toast({ title: "הקטגוריה עודכנה" })
      } else {
        const res = await fetch("/api/course-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "errors.addCategory")
        }
        toast({ title: "הקטגוריה נוספה" })
      }
      setCategoryDialog({ open: false, edit: null, name: "" })
      mutateCategories()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "errors.updateCategory"
      toast({ title: msg.startsWith("errors.") ? t(msg) : msg, variant: "destructive" })
    } finally {
      setCategorySaving(false)
    }
  }
  const deleteCategory = (id: string) => {
    const cat = categories.find((c) => c.id === id)
    deleteWithUndo({
      entityKey: "courseCategory",
      itemId: id,
      itemLabel: cat?.name,
      removeFromUI: () =>
        mutateCategories((prev: CourseCategoryRow[]) => (Array.isArray(prev) ? prev.filter((c) => c.id !== id) : prev), false),
      restoreFn: () => mutateCategories(),
      deleteFn: async () => {
        const res = await fetch(`/api/course-categories/${id}`, { method: "DELETE", credentials: "include" })
        if (!res.ok) throw new Error("שגיאה במחיקה")
        mutateCategories()
      },
      confirmPolicy: "standard",
      undoWindowMs: 10_000,
    })
  }

  const openAddSiblingPackage = () => {
    setSiblingDialog({
      open: true,
      edit: null,
      name: "",
      description: "",
      firstAmount: "",
      secondAmount: "",
      thirdAmount: "",
      pricingMode: "perCourse",
      isActive: true,
    })
  }

  const openEditSiblingPackage = (pkg: SiblingPackageRow) => {
    setSiblingDialog({
      open: true,
      edit: pkg,
      name: pkg.name,
      description: pkg.description || "",
      firstAmount: String(pkg.firstAmount ?? ""),
      secondAmount: String(pkg.secondAmount ?? ""),
      thirdAmount: String(pkg.thirdAmount ?? ""),
      pricingMode: pkg.pricingMode || "perCourse",
      isActive: pkg.isActive !== false,
    })
  }

  const saveSiblingPackage = async () => {
    if (!siblingDialog.name.trim()) {
      toast({ title: "נא להזין שם חבילה", variant: "destructive" })
      return
    }
    setSiblingSaving(true)
    try {
      const payload = {
        name: siblingDialog.name.trim(),
        description: siblingDialog.description.trim(),
        firstAmount: Number(siblingDialog.firstAmount || 0),
        secondAmount: Number(siblingDialog.secondAmount || 0),
        thirdAmount: Number(siblingDialog.thirdAmount || 0),
        pricingMode: siblingDialog.pricingMode,
        isActive: siblingDialog.isActive,
      }
      const url = siblingDialog.edit
        ? `/api/sibling-discount-packages/${siblingDialog.edit.id}`
        : "/api/sibling-discount-packages"
      const method = siblingDialog.edit ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "שגיאה בשמירת חבילת אחים")
      }
      setSiblingDialog((s) => ({ ...s, open: false }))
      mutateSiblingPackages()
      toast({ title: siblingDialog.edit ? "חבילת אחים עודכנה" : "חבילת אחים נוספה" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה בשמירה"
      toast({ title: msg, variant: "destructive" })
    } finally {
      setSiblingSaving(false)
    }
  }

  const openAddTeacherTariff = () => {
    setTariffDialog({
      open: true,
      edit: null,
      name: "",
      description: "",
      pricingMethod: "standard",
      centerHourlyRate: "50",
      travelRate: "0",
      externalCourseRate: "80",
      officeHourlyRate: "",
      tierRates: Array.from({ length: 10 }, (_, i) => (i === 0 ? 32 : 0)),
      bonusEnabled: false,
      bonusMinStudents: "",
      bonusPerHour: "",
      isActive: true,
    })
  }
  const openEditTeacherTariff = (row: TeacherTariffProfileRow) => {
    let parsedStudentTierRates: Array<{ upToStudents?: unknown; hourlyRate?: unknown }> = []
    const raw = row.studentTierRates
    if (Array.isArray(raw)) {
      parsedStudentTierRates = raw as Array<{ upToStudents?: unknown; hourlyRate?: unknown }>
    } else if (typeof raw === "string" && raw.trim().length > 0) {
      try {
        const decoded = JSON.parse(raw)
        if (Array.isArray(decoded)) {
          parsedStudentTierRates = decoded as Array<{ upToStudents?: unknown; hourlyRate?: unknown }>
        }
      } catch {
        parsedStudentTierRates = []
      }
    }
    const tiers = Array.from({ length: 10 }, (_, i) => {
      const r = parsedStudentTierRates.find((x) => Number(x?.upToStudents) === i + 1)
      return Number(r?.hourlyRate || 0)
    })
    setTariffDialog({
      open: true,
      edit: row,
      name: row.name,
      description: row.description || "",
      pricingMethod: row.pricingMethod === "per_student_tier" ? "per_student_tier" : "standard",
      centerHourlyRate: String(row.centerHourlyRate ?? ""),
      travelRate: String(row.travelRate ?? ""),
      externalCourseRate: String(row.externalCourseRate ?? ""),
      officeHourlyRate: String(row.officeHourlyRate ?? ""),
      tierRates: tiers,
      bonusEnabled: row.bonusEnabled === true,
      bonusMinStudents: row.bonusMinStudents != null ? String(row.bonusMinStudents) : "",
      bonusPerHour: String(row.bonusPerHour ?? ""),
      isActive: row.isActive !== false,
    })
  }
  const saveTeacherTariffProfile = async () => {
    if (!tariffDialog.name.trim()) {
      toast({ title: "נא להזין שם פרופיל", variant: "destructive" })
      return
    }
    setTariffSaving(true)
    try {
      const studentTierRates = tariffDialog.tierRates.map((hourlyRate, idx) => ({
        upToStudents: idx + 1,
        hourlyRate: Number(hourlyRate || 0),
      }))
      const payload = {
        name: tariffDialog.name.trim(),
        description: tariffDialog.description.trim(),
        pricingMethod: tariffDialog.pricingMethod,
        centerHourlyRate: tariffDialog.centerHourlyRate === "" ? null : Number(tariffDialog.centerHourlyRate),
        travelRate: tariffDialog.travelRate === "" ? null : Number(tariffDialog.travelRate),
        externalCourseRate: tariffDialog.externalCourseRate === "" ? null : Number(tariffDialog.externalCourseRate),
        officeHourlyRate: tariffDialog.officeHourlyRate === "" ? null : Number(tariffDialog.officeHourlyRate),
        studentTierRates,
        bonusEnabled: tariffDialog.bonusEnabled,
        bonusMinStudents: tariffDialog.bonusEnabled && tariffDialog.bonusMinStudents !== "" ? Number(tariffDialog.bonusMinStudents) : null,
        bonusPerHour: tariffDialog.bonusEnabled && tariffDialog.bonusPerHour !== "" ? Number(tariffDialog.bonusPerHour) : 0,
        isActive: tariffDialog.isActive,
      }
      const url = tariffDialog.edit
        ? `/api/teacher-tariff-profiles/${tariffDialog.edit.id}`
        : "/api/teacher-tariff-profiles"
      const method = tariffDialog.edit ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "שגיאה בשמירת פרופיל תעריף")
      }
      setTariffDialog((d) => ({ ...d, open: false }))
      mutateTeacherTariffProfiles()
      toast({ title: tariffDialog.edit ? "פרופיל עודכן" : "פרופיל נוסף" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה בשמירה"
      toast({ title: msg, variant: "destructive" })
    } finally {
      setTariffSaving(false)
    }
  }
  const deleteTeacherTariffProfile = async (id: string) => {
    const res = await fetch(`/api/teacher-tariff-profiles/${id}`, { method: "DELETE", credentials: "include" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({ title: data.error || "שגיאה במחיקה", variant: "destructive" })
      return
    }
    mutateTeacherTariffProfiles()
    toast({ title: "הפרופיל נמחק" })
  }

  const deleteSiblingPackage = async (id: string) => {
    const res = await fetch(`/api/sibling-discount-packages/${id}`, { method: "DELETE", credentials: "include" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({ title: data.error || "שגיאה במחיקת חבילה", variant: "destructive" })
      return
    }
    mutateSiblingPackages()
    toast({ title: "חבילת האחים נמחקה" })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 min-h-[300px] items-center justify-center p-3 sm:p-6" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-3 sm:space-y-8 sm:p-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="הגדרות" description="הגדרות מערכת ותצורה" />
        <div className="text-sm text-muted-foreground">
          {autoSaveStatus === "saving"
            ? "שומר אוטומטית..."
            : autoSaveStatus === "saved"
              ? "נשמר אוטומטית"
              : autoSaveStatus === "error"
                ? "שגיאה בשמירה אוטומטית"
                : "שמירה אוטומטית פעילה"}
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full" dir="rtl">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
          <TabsList className="mb-4 flex h-auto w-max min-w-full max-w-none flex-nowrap justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:mb-6 lg:grid lg:w-full lg:min-w-0 lg:grid-cols-7 lg:overflow-visible lg:p-1">
          <TabsTrigger value="general" className="flex shrink-0 flex-row-reverse items-center justify-center gap-2 rounded-md px-2 text-xs data-[state=active]:shadow-sm sm:text-sm lg:min-w-0">
            <Building2 className="h-4 w-4 shrink-0" />
            <span>כללי</span>
          </TabsTrigger>
          <TabsTrigger value="numbers" className="flex shrink-0 flex-row-reverse items-center justify-center gap-2 rounded-md px-2 text-xs data-[state=active]:shadow-sm sm:text-sm lg:min-w-0">
            <Hash className="h-4 w-4 shrink-0" />
            <span>מספרים</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex shrink-0 flex-row-reverse items-center justify-center gap-2 rounded-md px-2 text-xs data-[state=active]:shadow-sm sm:text-sm lg:min-w-0">
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span>קטגוריות קורס (מתקדם)</span>
          </TabsTrigger>
          <TabsTrigger value="siblings" className="flex shrink-0 flex-row-reverse items-center justify-center gap-2 rounded-md px-2 text-xs data-[state=active]:shadow-sm sm:text-sm lg:min-w-0">
            <Hash className="h-4 w-4 shrink-0" />
            <span>חבילות אחים</span>
          </TabsTrigger>
          <TabsTrigger value="teacher-tariffs" className="flex shrink-0 flex-row-reverse items-center justify-center gap-2 rounded-md px-2 text-xs data-[state=active]:shadow-sm sm:text-sm lg:min-w-0">
            <Banknote className="h-4 w-4 shrink-0" />
            <span>תעריפי מורים</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="flex shrink-0 flex-row-reverse items-center justify-center gap-2 rounded-md px-2 text-xs data-[state=active]:shadow-sm sm:text-sm lg:min-w-0">
            <FileSpreadsheet className="h-4 w-4 shrink-0" />
            <span>ייבוא מאקסל</span>
          </TabsTrigger>
          <TabsTrigger value="other" className="flex shrink-0 flex-row-reverse items-center justify-center gap-2 rounded-md px-2 text-xs data-[state=active]:shadow-sm sm:text-sm lg:min-w-0">
            <Settings2 className="h-4 w-4 shrink-0" />
            <span>אחר</span>
          </TabsTrigger>
        </TabsList>
        </div>

        {/* טאב כללי */}
        <TabsContent value="general">
          <Card>
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                פרטי המרכז
              </CardTitle>
              <CardDescription className="text-right">הגדר את פרטי המרכז שלך</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-3 sm:px-6">
              {/* שם המרכז */}
              <div className="space-y-2">
                <Label htmlFor="centerName" className="block text-right">שם המרכז *</Label>
                <Input
                  id="centerName"
                  placeholder="לדוגמה: מרכז הרובוטיקה"
                  value={settings.center_name}
                  onChange={(e) => setSettings({ ...settings, center_name: e.target.value })}
                  className="text-right"
                  dir="rtl"
                />
              </div>

              {/* ע"ס / ח"פ */}
              <div className="space-y-2">
                <Label htmlFor="taxId" className="text-right block">ע&quot;ס / ח&quot;פ</Label>
                <Input
                  id="taxId"
                  placeholder="מספר עוסק מורשה או ח.פ. חברה"
                  value={settings.tax_id ?? ""}
                  onChange={(e) => setSettings({ ...settings, tax_id: e.target.value })}
                  className="text-right"
                  dir="rtl"
                />
              </div>

              {/* לוגו */}
              <div className="space-y-2">
                <Label>לוגו המרכז</Label>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {logoPreview ? (
                    <div className="relative shrink-0">
                      <img
                        src={logoPreview || "/placeholder.svg"}
                        alt="Logo preview"
                        className="h-24 w-24 rounded border object-contain"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
                        onClick={handleRemoveLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded border-2 border-dashed bg-muted">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full max-w-full sm:max-w-[280px]" />
                    <p className="mt-1 text-xs text-muted-foreground">PNG, JPG עד 2MB</p>
                  </div>
                </div>
              </div>

              {/* מספרי טלפון */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-right block">מספר נייד *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="050-1234567"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="text-right block">מספר WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="050-1234567"
                    value={settings.whatsapp}
                    onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* כתובת */}
              <div className="space-y-2">
                <Label htmlFor="address" className="text-right block">כתובת המרכז *</Label>
                <Textarea
                  id="address"
                  placeholder="רחוב 123, עיר, מיקוד"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  rows={3}
                  className="text-right"
                  dir="rtl"
                />
              </div>
              <div className="border-t pt-4 text-right text-xs text-muted-foreground">
                השינויים נשמרים אוטומטית.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="siblings">
          <Card>
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
                <Hash className="h-5 w-5 text-primary" />
                חבילות הנחת אחים
              </CardTitle>
              <CardDescription className="text-right">
                הגדרת מחיר לילד ראשון / שני / שלישי. את ההפעלה בפועל מבצעים עם הרשאת "הנחת אחים".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6">
              <div className="flex flex-row-reverse justify-stretch sm:justify-end">
                <Button type="button" onClick={openAddSiblingPackage} className="w-full gap-2 sm:w-auto">
                  <Plus className="h-4 w-4" />
                  הוסף חבילת אחים
                </Button>
              </div>
              {siblingPackages.length === 0 ? (
                <p className="text-muted-foreground text-right">לא הוגדרו חבילות אחים עדיין.</p>
              ) : (
                <ul className="space-y-2 border rounded-lg p-2">
                  {siblingPackages.map((pkg) => (
                    <li key={pkg.id} className="flex flex-col gap-3 rounded-md border bg-card px-3 py-3 sm:flex-row-reverse sm:items-center sm:justify-between sm:py-2">
                      <div className="min-w-0 text-right">
                        <div className="font-medium">{pkg.name}</div>
                        <div className="text-xs text-muted-foreground break-words">
                          {pkg.pricingMode === "perStudent"
                            ? "לפי ילד"
                            : pkg.pricingMode === "perCourse"
                              ? "לפי קורס"
                              : pkg.pricingMode === "perSession"
                                ? "לפי מפגש"
                                : pkg.pricingMode === "custom"
                                  ? "מותאם אישי"
                                  : "לפי שעה"} |
                          ראשון: ₪{pkg.firstAmount} | שני: ₪{pkg.secondAmount} | שלישי+: ₪{pkg.thirdAmount}
                          {pkg.isActive ? " | פעיל" : " | לא פעיל"}
                        </div>
                      </div>
                      <div className="flex shrink-0 justify-end gap-1">
                        <Button type="button" variant="outline" size="icon" onClick={() => openEditSiblingPackage(pkg)} title="ערוך">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => deleteSiblingPackage(pkg.id)} title="מחק">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teacher-tariffs">
          <Card>
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                פרופילי תעריף למורים
              </CardTitle>
              <CardDescription className="text-right">
                כאן מגדירים את מחירי השעה (מרכז / חיצוני / נסיעות / שעת משרד, לפי מספר תלמידים, בונוס). בעריכת קורס תבחרו לאיזה מורה איזה פרופיל
                חל — כל מורה בקורס יכולה לקבל פרופיל אחר. נדרשת הרשאת עריכת הגדרות לשינוי כאן; לשיוך בקורס נדרשת עריכת קורסים.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6">
              <div className="flex flex-row-reverse justify-stretch sm:justify-end">
                <Button type="button" onClick={openAddTeacherTariff} className="w-full gap-2 sm:w-auto">
                  <Plus className="h-4 w-4" />
                  הוסף פרופיל תעריף
                </Button>
              </div>
              {teacherTariffProfiles.length === 0 ? (
                <p className="text-muted-foreground text-right">לא הוגדרו פרופילים — הוסף פרופיל לפני שמירת קורס עם מורים.</p>
              ) : (
                <ul className="space-y-2 border rounded-lg p-2">
                  {teacherTariffProfiles.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-col gap-3 rounded-md border bg-card px-3 py-3 sm:flex-row-reverse sm:items-center sm:justify-between sm:py-2"
                    >
                      <div className="min-w-0 text-right">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.pricingMethod === "per_student_tier" ? "לפי תלמידים" : "רגיל (מרכז/חיצוני/נסיעות/משרד)"}
                          {row.isActive ? " | פעיל" : " | לא פעיל"}
                        </div>
                      </div>
                      <div className="flex shrink-0 justify-end gap-1">
                        <Button type="button" variant="outline" size="icon" onClick={() => openEditTeacherTariff(row)} title="ערוך">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => deleteTeacherTariffProfile(row.id)}
                          title="מחק"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* טאב מספרים */}
        <TabsContent value="numbers">
          <Card>
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
                <Hash className="h-5 w-5 text-primary" />
                מחירים והגדרות מספריות
              </CardTitle>
              <CardDescription className="text-right">הגדר מחירים והגבלות מספריות</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-3 sm:px-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lessonPrice" className="block text-right">מחיר שיעור בודד (בש"ח)</Label>
                  <Input
                    id="lessonPrice"
                    type="number"
                    placeholder="0"
                    value={settings.lesson_price || ""}
                    onChange={(e) => setSettings({ ...settings, lesson_price: Number(e.target.value) })}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyPrice" className="text-right block">מחיר חודשי (בש"ח)</Label>
                  <Input
                    id="monthlyPrice"
                    type="number"
                    placeholder="0"
                    value={settings.monthly_price || ""}
                    onChange={(e) => setSettings({ ...settings, monthly_price: Number(e.target.value) })}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="registrationFee" className="block text-right">דמי רישום (בש"ח)</Label>
                  <Input
                    id="registrationFee"
                    type="number"
                    placeholder="0"
                    value={settings.registration_fee || ""}
                    onChange={(e) => setSettings({ ...settings, registration_fee: Number(e.target.value) })}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountSiblings" className="text-right block">הנחת אחים (%)</Label>
                  <Input
                    id="discountSiblings"
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={settings.discount_siblings || ""}
                    onChange={(e) => setSettings({ ...settings, discount_siblings: Number(e.target.value) })}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxStudents" className="text-right block">מספר תלמידים מקסימלי בכיתה</Label>
                <Input
                  id="maxStudents"
                  type="number"
                  placeholder="0"
                  value={settings.max_students_per_class || ""}
                  onChange={(e) => setSettings({ ...settings, max_students_per_class: Number(e.target.value) })}
                  className="text-right"
                  dir="rtl"
                />
              </div>
              <div className="border-t pt-4 text-right text-xs text-muted-foreground">
                השינויים נשמרים אוטומטית.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* טאב קטגוריות קורס */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                קטגוריות קורס (מתקדם)
              </CardTitle>
              <CardDescription className="text-right">
                ניהול קטגוריות + הגדרת כיתות קייטנה (מספר/שם/הערות).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6">
              <div className="space-y-3 rounded-lg border p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="campClassroomsCount" className="text-right block">כמות כיתות לקייטנה</Label>
                    <Input
                      id="campClassroomsCount"
                      type="number"
                      min="1"
                      max="12"
                      value={settings.camp_classrooms_count || 6}
                      onChange={(e) => {
                        const nextCount = Math.max(1, Math.min(12, Number(e.target.value) || 6))
                        const nextRows = Array.from({ length: nextCount }, (_, i) => {
                          const n = i + 1
                          const row = (settings.camp_classrooms || []).find((c) => Number(c?.number) === n)
                          return { number: n, name: String(row?.name || `כיתה ${n}`), notes: String(row?.notes || "") }
                        })
                        setSettings({ ...settings, camp_classrooms_count: nextCount, camp_classrooms: nextRows })
                      }}
                      className="text-right"
                      dir="rtl"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground text-right self-end">
                    הגדרה זו משפיעה על עמודות הטבלה בטאב קייטנה.
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="p-2 text-right">כיתה מס'</th>
                        <th className="p-2 text-right">שם כיתה</th>
                        <th className="p-2 text-right">הערות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classroomsRows.map((row) => (
                        <tr key={row.number} className="border-t">
                          <td className="p-2 text-right">{row.number}</td>
                          <td className="p-2">
                            <Input
                              value={row.name}
                              onChange={(e) => {
                                const next = classroomsRows.map((r) => r.number === row.number ? { ...r, name: e.target.value } : r)
                                setSettings({ ...settings, camp_classrooms: next })
                              }}
                              className="text-right"
                              dir="rtl"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={row.notes || ""}
                              onChange={(e) => {
                                const next = classroomsRows.map((r) => r.number === row.number ? { ...r, notes: e.target.value } : r)
                                setSettings({ ...settings, camp_classrooms: next })
                              }}
                              className="text-right"
                              dir="rtl"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-row-reverse justify-stretch sm:justify-end">
                <Button type="button" onClick={openAddCategory} className="w-full gap-2 sm:w-auto">
                  <Plus className="h-4 w-4" />
                  הוסף קטגוריה
                </Button>
              </div>
              {categories.length === 0 ? (
                <p className="text-muted-foreground text-right">אין קטגוריות. הוסף קטגוריה כדי שיופיעו בטופס קורס.</p>
              ) : (
                <ul className="space-y-2 border rounded-lg p-2">
                  {categories.map((cat) => (
                    <li
                      key={cat.id}
                      className="flex flex-col gap-3 rounded-md border bg-card px-3 py-3 sm:flex-row-reverse sm:items-center sm:justify-between sm:py-2"
                    >
                      <span className="min-w-0 font-medium break-words" dir="rtl">{cat.name}</span>
                      <div className="flex shrink-0 justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => openEditCategory(cat)}
                          title="ערוך"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => deleteCategory(cat.id)}
                          title="מחק"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* טאב ייבוא מאקסל */}
        <TabsContent value="import">
          <ImportFromExcel />
        </TabsContent>

        {/* טאב אחר */}
        <TabsContent value="other">
          <Card>
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                הגדרות נוספות
              </CardTitle>
              <CardDescription className="text-right">הגדרות נוספות של המרכז</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-3 sm:px-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email" className="block text-right">כתובת אימייל</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@domain.com"
                    value={settings.email || ""}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-right block">אתר אינטרנט</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://www.example.com"
                    value={settings.website || ""}
                    onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workingHours" className="text-right block">שעות פעילות</Label>
                <Textarea
                  id="workingHours"
                  placeholder="ראשון-חמישי: 08:00-20:00&#10;שישי: 08:00-13:00"
                  value={settings.working_hours || ""}
                  onChange={(e) => setSettings({ ...settings, working_hours: e.target.value })}
                  rows={3}
                  className="text-right"
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-right block">הערות נוספות</Label>
                <Textarea
                  id="notes"
                  placeholder="הערות כלליות על המרכז..."
                  value={settings.notes || ""}
                  onChange={(e) => setSettings({ ...settings, notes: e.target.value })}
                  rows={4}
                  className="text-right"
                  dir="rtl"
                />
              </div>
              <div className="border-t pt-4 text-right text-xs text-muted-foreground">
                השינויים נשמרים אוטומטית.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={categoryDialog.open} onOpenChange={(open) => setCategoryDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{categoryDialog.edit ? "עריכת קטגוריה" : "הוספת קטגוריה"}</DialogTitle>
            <DialogDescription>שם הקטגוריה כפי שיופיע בבחירת קורס.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="categoryName">שם הקטגוריה</Label>
            <Input
              id="categoryName"
              value={categoryDialog.name}
              onChange={(e) => setCategoryDialog((d) => ({ ...d, name: e.target.value }))}
              placeholder="לדוגמה: רובוטיקה"
              className="text-right"
              dir="rtl"
            />
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setCategoryDialog({ open: false, edit: null, name: "" })}>
              ביטול
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={saveCategory} disabled={categorySaving}>
              {categorySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {categoryDialog.edit ? "עדכן" : "הוסף"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={siblingDialog.open} onOpenChange={(open) => setSiblingDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{siblingDialog.edit ? "עריכת חבילת אחים" : "הוספת חבילת אחים"}</DialogTitle>
            <DialogDescription>הגדר מחיר קבוע לכל סדר אחאות (ראשון, שני, שלישי+).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="siblingPackageName">שם החבילה</Label>
              <Input
                id="siblingPackageName"
                value={siblingDialog.name}
                onChange={(e) => setSiblingDialog((d) => ({ ...d, name: e.target.value }))}
                className="text-right"
                dir="rtl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="siblingPackageDescription">תיאור</Label>
              <Input
                id="siblingPackageDescription"
                value={siblingDialog.description}
                onChange={(e) => setSiblingDialog((d) => ({ ...d, description: e.target.value }))}
                className="text-right"
                dir="rtl"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>ראשון</Label>
                <Input type="number" value={siblingDialog.firstAmount} onChange={(e) => setSiblingDialog((d) => ({ ...d, firstAmount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>שני</Label>
                <Input type="number" value={siblingDialog.secondAmount} onChange={(e) => setSiblingDialog((d) => ({ ...d, secondAmount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>שלישי+</Label>
                <Input type="number" value={siblingDialog.thirdAmount} onChange={(e) => setSiblingDialog((d) => ({ ...d, thirdAmount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>שיטת חישוב חבילה</Label>
              <Select
                value={siblingDialog.pricingMode}
                onValueChange={(value: "perStudent" | "perCourse" | "perSession" | "perHour" | "custom") =>
                  setSiblingDialog((d) => ({ ...d, pricingMode: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="perStudent">לפי ילד</SelectItem>
                  <SelectItem value="perCourse">לפי קורס (סכום כולל)</SelectItem>
                  <SelectItem value="perSession">לפי מפגש</SelectItem>
                  <SelectItem value="perHour">לפי שעה</SelectItem>
                  <SelectItem value="custom">מותאם אישי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex flex-row-reverse items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={siblingDialog.isActive}
                onChange={(e) => setSiblingDialog((d) => ({ ...d, isActive: e.target.checked }))}
              />
              <span className="leading-snug">חבילה פעילה</span>
            </label>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setSiblingDialog((d) => ({ ...d, open: false }))}>
              ביטול
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={saveSiblingPackage} disabled={siblingSaving}>
              {siblingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {siblingDialog.edit ? "עדכן" : "הוסף"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tariffDialog.open} onOpenChange={(open) => setTariffDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{tariffDialog.edit ? "עריכת פרופיל תעריף" : "פרופיל תעריף חדש"}</DialogTitle>
            <DialogDescription>הגדרות אלה חלות על כל המורים שישויכו לפרופיל זה מתוך קורס.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>שם הפרופיל</Label>
              <Input
                value={tariffDialog.name}
                onChange={(e) => setTariffDialog((d) => ({ ...d, name: e.target.value }))}
                className="text-right"
                dir="rtl"
              />
            </div>
            <div className="space-y-1">
              <Label>תיאור</Label>
              <Input
                value={tariffDialog.description}
                onChange={(e) => setTariffDialog((d) => ({ ...d, description: e.target.value }))}
                className="text-right"
                dir="rtl"
              />
            </div>
            <div className="space-y-1">
              <Label>שיטת חישוב</Label>
              <Select
                value={tariffDialog.pricingMethod}
                onValueChange={(v: "standard" | "per_student_tier") =>
                  setTariffDialog((d) => ({ ...d, pricingMethod: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">רגיל: מרכז / חיצוני / נסיעות + שעת משרד</SelectItem>
                  <SelectItem value="per_student_tier">לפי מספר תלמידים (במרכז)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tariffDialog.pricingMethod === "standard" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>שעה במרכז (₪)</Label>
                    <Input
                      type="number"
                      value={tariffDialog.centerHourlyRate}
                      onChange={(e) => setTariffDialog((d) => ({ ...d, centerHourlyRate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>נסיעות לשעה (₪)</Label>
                    <Input
                      type="number"
                      value={tariffDialog.travelRate}
                      onChange={(e) => setTariffDialog((d) => ({ ...d, travelRate: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground leading-snug">
                      חל כשבקורס מוגדר מיקום &quot;נסיעות&quot;.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>שעה חיצוני (₪)</Label>
                    <Input
                      type="number"
                      value={tariffDialog.externalCourseRate}
                      onChange={(e) => setTariffDialog((d) => ({ ...d, externalCourseRate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>שעת משרד לשעה (₪)</Label>
                  <Input
                    type="number"
                    value={tariffDialog.officeHourlyRate}
                    onChange={(e) => setTariffDialog((d) => ({ ...d, officeHourlyRate: e.target.value }))}
                    placeholder="ריק = ללא תעריף משרד"
                  />
                  <p className="text-xs text-muted-foreground leading-snug">
                    נוכחות מורה שמסומנת כ&quot;שעת משרד&quot; תחושב לפי תעריף זה (בנפרד מהוראה בכיתה).
                  </p>
                </div>
              </div>
            )}
            {tariffDialog.pricingMethod === "per_student_tier" && (
              <div className="space-y-2 rounded-md border p-2">
                <Label>מחיר לשעה לפי כמות תלמידים (עד 10)</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {tariffDialog.tierRates.map((rate, idx) => (
                    <div key={idx} className="space-y-1">
                      <Label className="text-xs">עד {idx + 1}</Label>
                      <Input
                        type="number"
                        value={rate}
                        onChange={(e) => {
                          const next = [...tariffDialog.tierRates]
                          next[idx] = Number(e.target.value || 0)
                          setTariffDialog((d) => ({ ...d, tierRates: next }))
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-row-reverse items-start gap-2">
              <Checkbox
                id="tariff-bonus"
                className="mt-0.5 shrink-0"
                checked={tariffDialog.bonusEnabled}
                onCheckedChange={(c) => setTariffDialog((d) => ({ ...d, bonusEnabled: c === true }))}
              />
              <Label htmlFor="tariff-bonus" className="cursor-pointer leading-snug">
                בונוס לשעה מעל מספר תלמידים
              </Label>
            </div>
            {tariffDialog.bonusEnabled && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>מינימום תלמידים</Label>
                  <Input
                    type="number"
                    value={tariffDialog.bonusMinStudents}
                    onChange={(e) => setTariffDialog((d) => ({ ...d, bonusMinStudents: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>בונוס לשעה (₪)</Label>
                  <Input
                    type="number"
                    value={tariffDialog.bonusPerHour}
                    onChange={(e) => setTariffDialog((d) => ({ ...d, bonusPerHour: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div className="flex flex-row-reverse items-start gap-2">
              <Checkbox
                id="tariff-active"
                className="mt-0.5 shrink-0"
                checked={tariffDialog.isActive}
                onCheckedChange={(c) => setTariffDialog((d) => ({ ...d, isActive: c === true }))}
              />
              <Label htmlFor="tariff-active" className="cursor-pointer leading-snug">
                פרופיל פעיל (מופיע בבחירה בקורס)
              </Label>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setTariffDialog((d) => ({ ...d, open: false }))}>
              ביטול
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={saveTeacherTariffProfile} disabled={tariffSaving}>
              {tariffSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {tariffDialog.edit ? "עדכן" : "הוסף"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
