"use client"

import { useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CityCombobox } from "@/components/ui/combobox-city"
import { ArrowRight, User, Mail, Phone, GraduationCap, FileText, Banknote, Calendar, Award as IdCard, MapPin, KeyRound, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { fileToProfileImageDataUrl } from "@/lib/profile-image-client"

export default function NewTeacherPage() {
  const router = useRouter()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newTeacher, setNewTeacher] = useState({
    name: "",
    idNumber: "",
    birthDate: "",
    city: "",
    email: "",
    phone: "",
    specialization: "",
    status: "פעיל",
    bio: "",
    centerHourlyRate: 50,
    travelRate: 30,
    externalCourseRate: 80,
    profileImage: "",
  })

  // User account fields
  const [createUserAccount, setCreateUserAccount] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const handleAddTeacher = async () => {
    try {
      setError(null)
      setSubmitting(true)

      // Validate user account fields if creating account
      if (createUserAccount) {
        if (!username.trim()) {
          throw new Error("יש להזין שם משתמש")
        }
        if (!password || password.length < 4) {
          throw new Error("הסיסמה חייבת להכיל לפחות 4 תווים")
        }
      }

      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeacher.name.trim(),
          email: newTeacher.email.trim() || null,
          phone: newTeacher.phone.trim() || null,
          idNumber: newTeacher.idNumber.trim() || null,
          birthDate: newTeacher.birthDate || null,
          city: newTeacher.city || null,
          specialization: newTeacher.specialization.trim() || null,
          status: newTeacher.status || null,
          bio: newTeacher.bio.trim() || null,
          centerHourlyRate: newTeacher.centerHourlyRate || null,
          travelRate: newTeacher.travelRate || null,
          externalCourseRate: newTeacher.externalCourseRate || null,
          profileImage: newTeacher.profileImage.trim() || null,
          // User account data
          createUserAccount,
          username: createUserAccount ? username.trim() : null,
          password: createUserAccount ? password : null,
        }),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(txt || `Failed to create teacher (${res.status})`)
      }

      // אם ה-API מחזיר את המורה החדש, אפשר להשתמש בזה בעתיד
      // const created = await res.json()

      router.push("/dashboard/teachers")
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בהוספת מורה")
    } finally {
      setSubmitting(false)
    }
  }

  const handleProfileImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToProfileImageDataUrl(file)
    setNewTeacher((prev) => ({ ...prev, profileImage: dataUrl }))
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">מורה חדש</h1>
            <p className="text-muted-foreground mt-2">הוסף מורה חדש למערכת הרובוטיקה</p>
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
            <Select value={newTeacher.status} onValueChange={(value) => setNewTeacher({ ...newTeacher, status: value })}>
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
                value={newTeacher.name}
                onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
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
                  value={newTeacher.idNumber}
                  onChange={(e) => setNewTeacher({ ...newTeacher, idNumber: e.target.value })}
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
                  value={newTeacher.birthDate}
                  onChange={(e) => setNewTeacher({ ...newTeacher, birthDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profileImageUpload">תמונת פרופיל</Label>
              <div className="flex items-center gap-3">
                {newTeacher.profileImage ? (
                  <img src={newTeacher.profileImage} alt="profile preview" className="h-16 w-16 rounded-full object-contain bg-white p-0.5 border" />
                ) : (
                  <div className="h-16 w-16 rounded-full border-2 border-dashed bg-muted" />
                )}
                <div className="flex-1 space-y-2">
                  <Input id="profileImageUpload" type="file" accept="image/*" capture="environment" onChange={handleProfileImageUpload} />
                  {newTeacher.profileImage && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setNewTeacher((prev) => ({ ...prev, profileImage: "" }))}>
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
                value={newTeacher.city}
                onChange={(value) => setNewTeacher({ ...newTeacher, city: value })}
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
                value={newTeacher.specialization}
                onChange={(e) => setNewTeacher({ ...newTeacher, specialization: e.target.value })}
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
                value={newTeacher.bio}
                onChange={(e) => setNewTeacher({ ...newTeacher, bio: e.target.value })}
                placeholder="מידע על המורה, ניסיון מקצועי וכו׳"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact info */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
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
                value={newTeacher.email}
                onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
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
                value={newTeacher.phone}
                onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                placeholder="050-1234567"
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
              <div className="flex-1">
                <CardTitle>חשבון משתמש</CardTitle>
                <CardDescription>יצירת חשבון התחברות למורה במערכת</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* Rates (UI only for now) */}
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
                value={newTeacher.centerHourlyRate}
                onChange={(e) => setNewTeacher({ ...newTeacher, centerHourlyRate: Number(e.target.value) })}
                placeholder="50"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="travelRate">נסיעות (₪)</Label>
              <Input
                id="travelRate"
                type="number"
                value={newTeacher.travelRate}
                onChange={(e) => setNewTeacher({ ...newTeacher, travelRate: Number(e.target.value) })}
                placeholder="30"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="externalCourseRate">מחיר שעה בקורס חיצוני (₪)</Label>
              <Input
                id="externalCourseRate"
                type="number"
                value={newTeacher.externalCourseRate}
                onChange={(e) => setNewTeacher({ ...newTeacher, externalCourseRate: Number(e.target.value) })}
                placeholder="80"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="lg" onClick={() => router.back()} disabled={submitting}>
            ביטול
          </Button>

          <Button
            size="lg"
            onClick={handleAddTeacher}
            disabled={submitting || !newTeacher.name.trim() || !newTeacher.email.trim()}
          >
            {submitting ? "שומר..." : "הוסף מורה"}
          </Button>
        </div>
      </div>
    </div>
  )
}
