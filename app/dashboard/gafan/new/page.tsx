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
import { useRouter } from "next/navigation"

export default function NewGafanProgramPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    programNumber: "",
    name: "",
    validYear: "",
    companyName: "",
    companyId: "",
    companyAddress: "",
    bankName: "",
    bankCode: "",
    branchNumber: "",
    accountNumber: "",
    operatorName: "",
    priceMin: "",
    priceMax: "",
    status: "מתעניין",
    providerType: "internal",
    notes: "",
  })

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/gafan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          program_number: formData.programNumber,
          name: formData.name,
          valid_year: formData.validYear,
          company_name: formData.companyName,
          company_id: formData.companyId,
          company_address: formData.companyAddress,
          bank_name: formData.bankName || null,
          bank_code: formData.bankCode || null,
          branch_number: formData.branchNumber || null,
          account_number: formData.accountNumber || null,
          operator_name: formData.operatorName,
          price_min: Number(formData.priceMin),
          price_max: formData.priceMax ? Number(formData.priceMax) : null,
          status: formData.status,
          provider_type: formData.providerType,
          notes: formData.notes || null,
        }),
      })

      if (response.ok) {
        router.push("/dashboard/gafan")
      } else {
        console.error("Failed to create gafan program")
      }
    } catch (error) {
      console.error("Error creating gafan program:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBankChange = (bankName: string) => {
    const bank = israeliBanks.find((b) => b.name === bankName)
    setFormData({
      ...formData,
      bankName,
      bankCode: bank?.code || "",
    })
  }

  return (
    <div className="container mx-auto max-w-5xl p-6" dir="rtl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/dashboard/gafan">
            <Button variant="ghost" size="icon" className="hover:bg-primary/10">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-foreground">תוכנית גפ"ן חדשה</h1>
        </div>
        <p className="text-muted-foreground mr-14">הוסף תוכנית גפ"ן חדשה למערכת הרובוטיקה</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500 text-white p-3 rounded-lg">
                <Rocket className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <Label htmlFor="status" className="text-base font-semibold">
                  סטטוס התוכנית
                </Label>
                <p className="text-sm text-muted-foreground">בחר את סטטוס תוכנית גפ"ן הנוכחי</p>
              </div>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger id="status" className="w-[200px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="מתעניין">מתעניין</SelectItem>
                  <SelectItem value="פעיל">פעיל</SelectItem>
                  <SelectItem value="לא פעיל">לא פעיל</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Provider Type Field */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-blue-200">
              <div className="flex-1">
                <Label htmlFor="providerType" className="text-base font-semibold">
                  סוג ספק
                </Label>
                <p className="text-sm text-muted-foreground">האם התוכנית מופעלת על ידי החברה או ספק חיצוני</p>
              </div>
              <Select value={formData.providerType} onValueChange={(value) => setFormData({ ...formData, providerType: value })}>
                <SelectTrigger id="providerType" className="w-[200px] bg-white">
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

        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="p-6">
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
                <Label htmlFor="programNumber" className="text-base">
                  מס' תוכנית *
                </Label>
                <Input
                  id="programNumber"
                  value={formData.programNumber}
                  onChange={(e) => setFormData({ ...formData, programNumber: e.target.value })}
                  placeholder="לדוגמה: GP2024-001"
                  className="h-11 bg-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="validYear" className="text-base">
                  תוקף לשנה *
                </Label>
                <Input
                  id="validYear"
                  type="number"
                  value={formData.validYear}
                  onChange={(e) => setFormData({ ...formData, validYear: e.target.value })}
                  placeholder="2024"
                  className="h-11 bg-white"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name" className="text-base">
                  שם התוכנית *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder='לדוגמה: תוכנית גפ"ן - רובוטיקה מתקדמת'
                  className="h-11 bg-white"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-6">
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
                <Label htmlFor="companyName" className="text-base">
                  שם חברה *
                </Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="לדוגמה: מרכז הרובוטיקה בע״מ"
                  className="h-11 bg-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyId" className="text-base">
                  ח"פ חברה *
                </Label>
                <Input
                  id="companyId"
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  placeholder="512345678"
                  className="h-11 bg-white"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="companyAddress" className="text-base">
                  כתובת חברה *
                </Label>
                <Input
                  id="companyAddress"
                  value={formData.companyAddress}
                  onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                  placeholder="רחוב, מספר, עיר, מיקוד"
                  className="h-11 bg-white"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-cyan-100/50">
          <CardContent className="p-6">
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
                <Label htmlFor="bankName" className="text-base">
                  בנק
                </Label>
                <Select value={formData.bankName} onValueChange={handleBankChange}>
                  <SelectTrigger id="bankName" className="h-11 bg-white">
                    <SelectValue placeholder="בחר בנק" />
                  </SelectTrigger>
                  <SelectContent>
                    {israeliBanks.map((bank) => (
                      <SelectItem key={bank.code} value={bank.name}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankCode" className="text-base">
                  קוד בנק
                </Label>
                <Input
                  id="bankCode"
                  value={formData.bankCode}
                  readOnly
                  placeholder="מתמלא אוטומטית"
                  className="h-11 bg-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branchNumber" className="text-base">
                  סניף
                </Label>
                <Input
                  id="branchNumber"
                  value={formData.branchNumber}
                  onChange={(e) => setFormData({ ...formData, branchNumber: e.target.value })}
                  placeholder="מספר סניף"
                  className="h-11 bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber" className="text-base">
                  מס' חשבון
                </Label>
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  placeholder="מספר חשבון"
                  className="h-11 bg-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-6">
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
              <Label htmlFor="operatorName" className="text-base">
                שם מפעיל התוכנית *
              </Label>
              <Input
                id="operatorName"
                value={formData.operatorName}
                onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
                placeholder="שם מלא"
                className="h-11 bg-white"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50">
          <CardContent className="p-6">
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
                <Label htmlFor="priceMin" className="text-base">
                  מחיר מינימום (₪) *
                </Label>
                <Input
                  id="priceMin"
                  type="number"
                  value={formData.priceMin}
                  onChange={(e) => setFormData({ ...formData, priceMin: e.target.value })}
                  placeholder="0"
                  className="h-11 bg-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priceMax" className="text-base">
                  מחיר מקסימום (₪)
                </Label>
                <Input
                  id="priceMax"
                  type="number"
                  value={formData.priceMax}
                  onChange={(e) => setFormData({ ...formData, priceMax: e.target.value })}
                  placeholder="השאר ריק למחיר קבוע"
                  className="h-11 bg-white"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              ניתן להזין מחיר בודד (רק מינימום) או טווח מחירים (מינימום ומקסימום)
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100/50">
          <CardContent className="p-6">
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-base">
                הערות
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="הערות או מידע נוסף על התוכנית..."
                rows={4}
                className="resize-none bg-white"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button type="submit" size="lg" className="gap-2 h-12 px-8" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            הוסף תוכנית גפ"ן
          </Button>
          <Link href="/dashboard/gafan">
            <Button type="button" variant="outline" size="lg" className="h-12 px-8 bg-transparent">
              ביטול
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
