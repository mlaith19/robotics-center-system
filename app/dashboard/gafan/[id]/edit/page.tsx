"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight, Save, Rocket, Building2, User, DollarSign, Landmark, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import useSWR from "swr"
import { fetcher as apiFetcher } from "@/lib/swr-fetcher"

interface FormData {
  programNumber: string
  name: string
  validYear: string
  companyName: string
  companyId: string
  companyAddress: string
  bankName: string
  bankCode: string
  branchNumber: string
  accountNumber: string
  operatorName: string
  priceMin: string
  priceMax: string
  status: string
  providerType: string
  notes: string
}

// פונקציה לבניית formData מהנתונים שמגיעים מהשרת
function buildFormData(program: any): FormData {
  return {
    programNumber: program?.programNumber || "",
    name: program?.name || "",
    validYear: program?.validYear?.toString() || "",
    companyName: program?.companyName || "",
    companyId: program?.companyId || "",
    companyAddress: program?.companyAddress || "",
    bankName: program?.bankName || "",
    bankCode: program?.bankCode || "",
    branchNumber: program?.branchNumber || "",
    accountNumber: program?.accountNumber || "",
    operatorName: program?.operatorName || "",
    priceMin: program?.priceMin?.toString() || "",
    priceMax: program?.priceMax?.toString() || "",
    status: program?.status || "מתעניין",
    providerType: program?.provider_type || "internal",
    notes: program?.notes || "",
  }
}

const israeliBanks = [
  { name: "בנק לאומי", code: "10" },
  { name: "בנק הפועלים", code: "12" },
  { name: "בנק דיסקונט", code: "11" },
  { name: "בנק מזרחי טפחות", code: "20" },
  { name: "בנק איגוד", code: "13" },
  { name: "הבנק הבינלאומי", code: "31" },
  { name: "בנק מרכנתיל", code: "17" },
  { name: "בנק ירושלים", code: "54" },
  { name: "בנק אוצר החייל", code: "14" },
]

export default function EditGafanProgramPage() {
  const router = useRouter()
  const params = useParams()
  const programId = params.id as string
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData | null>(null)
  
  // שימוש ב-onSuccess callback כדי לאתחל את הטופס פעם אחת כשהנתונים מגיעים
  const { data: program, error, isLoading } = useSWR(
    programId ? `/api/gafan/${programId}` : null, 
    apiFetcher,
    { 
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onSuccess: (data) => {
        // אתחול הטופס רק אם עדיין לא אותחל
        if (data && !data.error && formData === null) {
          setFormData(buildFormData(data))
        }
      }
    }
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData) return
    
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/gafan/${programId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programNumber: formData.programNumber,
          name: formData.name,
          validYear: formData.validYear,
          companyName: formData.companyName,
          companyId: formData.companyId,
          companyAddress: formData.companyAddress,
          bankName: formData.bankName || null,
          bankCode: formData.bankCode || null,
          branchNumber: formData.branchNumber || null,
          accountNumber: formData.accountNumber || null,
          operatorName: formData.operatorName,
          priceMin: Number(formData.priceMin),
          priceMax: formData.priceMax ? Number(formData.priceMax) : null,
          status: formData.status,
          providerType: formData.providerType,
          notes: formData.notes || null,
        }),
      })

      if (response.ok) {
        router.push(`/dashboard/gafan/${programId}`)
      } else {
        console.error("Failed to update gafan program")
      }
    } catch (error) {
      console.error("Error updating gafan program:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBankChange = (bankName: string) => {
    if (!formData) return
    const bank = israeliBanks.find((b) => b.name === bankName)
    setFormData({
      ...formData,
      bankName,
      bankCode: bank?.code || "",
    })
  }

  const updateField = (field: keyof FormData, value: string) => {
    if (!formData) return
    setFormData({ ...formData, [field]: value })
  }

  // טעינה
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // שגיאה
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">שגיאה בטעינת הנתונים</p>
      </div>
    )
  }

  // הטופס עדיין לא אותחל - נאתחל אותו כאן
  if (formData === null && program && !program.error) {
    setFormData(buildFormData(program))
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // אין נתונים או הטופס לא אותחל
  if (!formData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">לא נמצאו נתונים</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl p-3 sm:p-6" dir="rtl">
      <div className="mb-6 sm:mb-8">
        <div className="mb-2 flex items-start gap-2 sm:items-center sm:gap-3">
          <Link href={`/dashboard/gafan/${programId}`} className="shrink-0">
            <Button variant="ghost" size="icon" className="hover:bg-primary/10">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="min-w-0 text-2xl font-bold break-words text-foreground sm:text-3xl">ערוך תוכנית גפ"ן</h1>
        </div>
        <p className="text-right text-muted-foreground sm:mr-14">עדכן את פרטי התוכנית</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Status Card */}
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="rounded-lg bg-blue-500 p-3 text-white">
                <Rocket className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor="status" className="text-base font-semibold">סטטוס התוכנית</Label>
                <p className="text-sm text-muted-foreground">בחר את סטטוס תוכנית גפ"ן הנוכחי</p>
              </div>
              <Select value={formData.status} onValueChange={(value) => updateField("status", value)}>
                <SelectTrigger id="status" className="w-full bg-white sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="מתעניין">מתעניין</SelectItem>
                  <SelectItem value="פעיל">פעיל</SelectItem>
                  <SelectItem value="לא פעיל">לא פעיל</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="mt-4 flex flex-col gap-4 border-t border-blue-200 pt-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Label htmlFor="providerType" className="text-base font-semibold">סוג ספק</Label>
                <p className="text-sm text-muted-foreground">האם התוכנית מופעלת על ידי החברה או ספק חיצוני</p>
              </div>
              <Select value={formData.providerType} onValueChange={(value) => updateField("providerType", value)}>
                <SelectTrigger id="providerType" className="w-full bg-white sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">החברה שלנו</SelectItem>
                  <SelectItem value="external">ספק חיצוני</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Basic Info Card */}
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-500 text-white p-2.5 rounded-lg">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">מידע בסיסי על התוכנית</h3>
                <p className="text-sm text-muted-foreground">פרטי תוכנית גפ"ן הראשוניים</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="programNumber" className="text-base">מס' תוכנית *</Label>
                <Input
                  id="programNumber"
                  value={formData.programNumber}
                  onChange={(e) => updateField("programNumber", e.target.value)}
                  placeholder="לדוגמה: GP2024-001"
                  className="h-11 bg-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validYear" className="text-base">תוקף לשנה *</Label>
                <Input
                  id="validYear"
                  type="number"
                  value={formData.validYear}
                  onChange={(e) => updateField("validYear", e.target.value)}
                  placeholder="2024"
                  className="h-11 bg-white"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name" className="text-base">שם התוכנית *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder='לדוגמה: תוכנית גפ"ן - רובוטיקה מתקדמת'
                  className="h-11 bg-white"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Info Card */}
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-purple-500 text-white p-2.5 rounded-lg">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">פרטי חברה</h3>
                <p className="text-sm text-muted-foreground">מידע על החברה המפעילה</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-base">שם חברה *</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  placeholder="לדוגמה: מרכז הרובוטיקה בע״מ"
                  className="h-11 bg-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyId" className="text-base">ח"פ חברה *</Label>
                <Input
                  id="companyId"
                  value={formData.companyId}
                  onChange={(e) => updateField("companyId", e.target.value)}
                  placeholder="512345678"
                  className="h-11 bg-white"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="companyAddress" className="text-base">כתובת חברה *</Label>
                <Input
                  id="companyAddress"
                  value={formData.companyAddress}
                  onChange={(e) => updateField("companyAddress", e.target.value)}
                  placeholder="רחוב, מספר, עיר, מיקוד"
                  className="h-11 bg-white"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Info Card */}
        <Card className="border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-cyan-100/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-cyan-500 text-white p-2.5 rounded-lg">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">פרטי חשבון בנק</h3>
                <p className="text-sm text-muted-foreground">מידע בנקאי של החברה</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="bankName" className="text-base">בנק</Label>
                <Select value={formData.bankName} onValueChange={handleBankChange}>
                  <SelectTrigger id="bankName" className="h-11 bg-white">
                    <SelectValue placeholder="בחר בנק" />
                  </SelectTrigger>
                  <SelectContent>
                    {israeliBanks.map((bank) => (
                      <SelectItem key={bank.code} value={bank.name}>{bank.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankCode" className="text-base">קוד בנק</Label>
                <Input
                  id="bankCode"
                  value={formData.bankCode}
                  readOnly
                  placeholder="מתמלא אוטומטית"
                  className="h-11 bg-white/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branchNumber" className="text-base">סניף</Label>
                <Input
                  id="branchNumber"
                  value={formData.branchNumber}
                  onChange={(e) => updateField("branchNumber", e.target.value)}
                  placeholder="מספר סניף"
                  className="h-11 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber" className="text-base">מס' חשבון</Label>
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChange={(e) => updateField("accountNumber", e.target.value)}
                  placeholder="מספר חשבון"
                  className="h-11 bg-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operator Card */}
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-amber-500 text-white p-2.5 rounded-lg">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">מפעיל התוכנית</h3>
                <p className="text-sm text-muted-foreground">איש הקשר המפעיל את התוכנית</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="operatorName" className="text-base">שם מפעיל התוכנית *</Label>
              <Input
                id="operatorName"
                value={formData.operatorName}
                onChange={(e) => updateField("operatorName", e.target.value)}
                placeholder="שם מלא"
                className="h-11 bg-white"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing Card */}
        <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-orange-500 text-white p-2.5 rounded-lg">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">תמחור</h3>
                <p className="text-sm text-muted-foreground">מחיר התוכנית או טווח מחירים</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="priceMin" className="text-base">מחיר מינימום (₪) *</Label>
                <Input
                  id="priceMin"
                  type="number"
                  value={formData.priceMin}
                  onChange={(e) => updateField("priceMin", e.target.value)}
                  placeholder="0"
                  className="h-11 bg-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceMax" className="text-base">מחיר מקסימום (₪)</Label>
                <Input
                  id="priceMax"
                  type="number"
                  value={formData.priceMax}
                  onChange={(e) => updateField("priceMax", e.target.value)}
                  placeholder="השאר ריק למחיר קבוע"
                  className="h-11 bg-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes Card */}
        <Card className="border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100/50">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-base">הערות</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="הערות או מידע נוסף על התוכנית..."
                rows={4}
                className="resize-none bg-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
          <Button type="submit" size="lg" className="h-12 w-full gap-2 px-8 sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            שמור שינויים
          </Button>
          <Link href={`/dashboard/gafan/${programId}`} className="w-full sm:w-auto">
            <Button type="button" variant="outline" size="lg" className="h-12 w-full bg-transparent px-8 sm:w-auto">
              ביטול
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
