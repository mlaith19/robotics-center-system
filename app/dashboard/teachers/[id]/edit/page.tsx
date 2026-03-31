"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CityCombobox } from "@/components/ui/combobox-city"
import { ArrowRight, User, Mail, Phone, GraduationCap, FileText, Banknote, Calendar, Award as IdCard, MapPin, Save, Loader2, KeyRound, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { fileToProfileImageDataUrl } from "@/lib/profile-image-client"

type Teacher = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  idNumber?: string | null
  birthDate?: string | null
  city?: string | null
  specialization?: string | null
  status?: string | null
  bio?: string | null
  centerHourlyRate?: number | null
  travelRate?: number | null
  externalCourseRate?: number | null
  profileImage?: string | null
  userId?: string | null
}

export default function EditTeacherPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // User account fields
  const [hasUserAccount, setHasUserAccount] = useState(false)
  const [createUserAccount, setCreateUserAccount] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const [form, setForm] = useState({
    name: "",
    idNumber: "",
    birthDate: "",
    city: "",
    email: "",
    phone: "",
    specialization: "",
    status: "פעיל",
    bio: "",
    centerHourlyRate: 0,
    travelRate: 0,
    externalCourseRate: 0,
    profileImage: "",
  })

  useEffect(() => {
    if (!id) return
    let cancelled = false

    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/teachers/${id}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`Failed to load teacher (${res.status})`)

        const t = (await res.json()) as Teacher | null
        if (!t) throw new Error("מורה לא נמצא")

        if (!cancelled) {
          setForm({
            name: t.name ?? "",
            idNumber: t.idNumber ?? "",
            birthDate: t.birthDate ? t.birthDate.split("T")[0] : "",
            city: t.city ?? "",
            email: t.email ?? "",
            phone: t.phone ?? "",
            specialization: (t as any).specialty ?? "",
            status: t.status ?? "פעיל",
            bio: t.bio ?? "",
            centerHourlyRate: t.centerHourlyRate ?? 0,
            travelRate: t.travelRate ?? 0,
            externalCourseRate: t.externalCourseRate ?? 0,
            profileImage: t.profileImage ?? "",
          })
          // Check if teacher has user account
          setHasUserAccount(!!t.userId)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "שגיאה בטעינת מורה")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  const onSave = async () => {
    if (!id) return
    try {
      setSaving(true)
      setError(null)

      // Validate user account fields if creating account
      if (createUserAccount && !hasUserAccount) {
        if (!username.trim()) {
          throw new Error("יש להזין שם משתמש")
        }
        if (!password || password.length < 4) {
          throw new Error("הסיסמה חייבת להכיל לפחות 4 תווים")
        }
      }

      const res = await fetch(`/api/teachers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          idNumber: form.idNumber.trim() || null,
          birthDate: form.birthDate || null,
          city: form.city || null,
          specialization: form.specialization.trim() || null,
          status: form.status || null,
          bio: form.bio.trim() || null,
          centerHourlyRate: form.centerHourlyRate || null,
          travelRate: form.travelRate || null,
          externalCourseRate: form.externalCourseRate || null,
          profileImage: form.profileImage.trim() || null,
          // User account data
          createUserAccount: createUserAccount && !hasUserAccount,
          username: createUserAccount && !hasUserAccount ? username.trim() : null,
          password: createUserAccount && !hasUserAccount ? password : null,
        }),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(txt || `Failed to update teacher (${res.status})`)
      }

      window.location.href = "/dashboard/teachers"
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשמירה")
    } finally {
      setSaving(false)
    }
  }

  const handleProfileImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToProfileImageDataUrl(file)
    setForm((prev) => ({ ...prev, profileImage: dataUrl }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard/teachers">
            <Button variant="ghost" size="sm">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">עריכת מורה</h1>
            <p className="text-muted-foreground mt-2">עדכן את פרטי המורה</p>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50/60">
            <CardContent className="p-4">
              <div className="font-semibold text-red-700">שגיאה</div>
              <div className="text-sm text-red-700/80 mt-1 whitespace-pre-wrap">{error}</div>
            </CardContent>
          </Card>
        )}

        {/* Status */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">סטטוס המורה</CardTitle>
                <CardDescription>בחר את סטטוס המורה הנוכחי</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="פעיל">פעיל</SelectItem>
                <SelectItem value="חופשה">חופשה</SelectItem>
                <SelectItem value="לא פעיל">לא פעיל</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Personal info */}
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>מידע אישי</CardTitle>
                <CardDescription>פרטי זיהוי בסיסיים של המורה</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                שם מלא *
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="לדוגמה: ד״ר משה לוי"
                className="text-lg"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="idNumber" className="flex items-center gap-2">
                  <IdCard className="h-4 w-4" />
                  תעודת זהות
                </Label>
                <Input
                  id="idNumber"
                  value={form.idNumber}
                  onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                  placeholder="123456789"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="birthDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  תאריך לידה
                </Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profileImageUpload">תמונת פרופיל</Label>
              <div className="flex items-center gap-3">
                {form.profileImage ? (
                  <img src={form.profileImage} alt="profile preview" className="h-16 w-16 rounded-full object-contain bg-white p-1 border" />
                ) : (
                  <div className="h-16 w-16 rounded-full border-2 border-dashed bg-muted" />
                )}
                <div className="flex-1 space-y-2">
                  <Input id="profileImageUpload" type="file" accept="image/*" capture="environment" onChange={handleProfileImageUpload} />
                  {form.profileImage && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setForm((prev) => ({ ...prev, profileImage: "" }))}>
                      <X className="h-4 w-4 mr-1" />
                      הסר תמונה
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="city" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                עיר
              </Label>
              <CityCombobox
                value={form.city}
                onChange={(value) => setForm({ ...form, city: value })}
                placeholder="בחר עיר"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="specialization" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                התמחות
              </Label>
              <Input
                id="specialization"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                placeholder="רובוטיקה, תכנות, אלקטרוניקה וכו׳"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bio" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                אודות
              </Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="מידע על המורה, ניסיון מקצועי וכו׳"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* User Account */}
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <KeyRound className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>חשבון משתמש</CardTitle>
                <CardDescription>יצירת חשבון התחברות למורה במערכת</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasUserAccount ? (
              <div className="text-center py-4 bg-green-100 rounded-lg border border-green-300">
                <p className="text-green-700 font-medium">למורה זה כבר יש חשבון משתמש במערכת</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Checkbox 
                    id="createUserAccount"
                    checked={createUserAccount}
                    onCheckedChange={(checked) => setCreateUserAccount(checked === true)}
                  />
                  <Label htmlFor="createUserAccount" className="cursor-pointer">
                    צור חשבון משתמש למורה (יאפשר למורה להתחבר למערכת)
                  </Label>
                </div>

                {createUserAccount && (
                  <div className="grid gap-4 pt-2 border-t">
                    <div className="grid gap-2">
                      <Label htmlFor="username">שם משתמש *</Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="שם משתמש להתחברות"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">סיסמה *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="לפחות 4 תווים"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Contact info */}
        <Card className="border-cyan-200 bg-cyan-50/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Phone className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <CardTitle>פרטי קשר</CardTitle>
                <CardDescription>מידע ליצירת קשר עם המורה</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                אימייל *
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="teacher@robotics.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                טלפון
              </Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="050-1234567"
              />
            </div>
          </CardContent>
        </Card>

        {/* Rates */}
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Banknote className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>תעריפים</CardTitle>
                <CardDescription>הגדרת מחירי השעה למורה</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="centerHourlyRate">מחיר שעה במרכז (₪)</Label>
              <Input
                id="centerHourlyRate"
                type="number"
                value={form.centerHourlyRate}
                onChange={(e) => setForm({ ...form, centerHourlyRate: Number(e.target.value) })}
                placeholder="50"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="travelRate">נסיעות (₪)</Label>
              <Input
                id="travelRate"
                type="number"
                value={form.travelRate}
                onChange={(e) => setForm({ ...form, travelRate: Number(e.target.value) })}
                placeholder="30"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="externalCourseRate">מחיר שעה בקורס חיצוני (₪)</Label>
              <Input
                id="externalCourseRate"
                type="number"
                value={form.externalCourseRate}
                onChange={(e) => setForm({ ...form, externalCourseRate: Number(e.target.value) })}
                placeholder="80"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link href="/dashboard/teachers">
            <Button variant="outline" size="lg" className="bg-transparent">
              ביטול
            </Button>
          </Link>

          <Button
            size="lg"
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                שומר...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                שמור שינויים
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
