"use client"

import { Suspense, useEffect, useState, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { User, Phone, Mail, Loader2, CheckCircle, Users, Heart } from "lucide-react"
import { fileToProfileImageDataUrl } from "@/lib/profile-image-client"

function RegisterStudentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState("")
  const [idNumber, setIdNumber] = useState("")
  const [father, setFather] = useState("")
  const [mother, setMother] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [healthFund, setHealthFund] = useState("")
  const [allergies, setAllergies] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [confirmCenterAgreement, setConfirmCenterAgreement] = useState(false)
  const [confirmPhotoConsent, setConfirmPhotoConsent] = useState(false)
  const [noSensitivity, setNoSensitivity] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLookupLoading, setIsLookupLoading] = useState(false)
  const [foundExisting, setFoundExisting] = useState(false)
  const [submittedExistingStudent, setSubmittedExistingStudent] = useState<boolean | null>(null)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  function normalizeBirthDateInput(value: string): string {
    const v = value.trim()
    if (!v) return ""
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    const m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/)
    if (!m) return v
    const dd = m[1].padStart(2, "0")
    const mm = m[2].padStart(2, "0")
    const yyyy = m[3]
    return `${yyyy}-${mm}-${dd}`
  }

  const selectedCourseId = searchParams.get("courseId")?.trim() || ""
  const selectedCourseName = searchParams.get("courseName")?.trim() || ""

  useEffect(() => {
    const id = idNumber.trim()
    if (!id) {
      setFoundExisting(false)
      return
    }
    if (id.length < 5) return
    const t = setTimeout(async () => {
      try {
        setIsLookupLoading(true)
        const res = await fetch(`/api/register/student?idNumber=${encodeURIComponent(id)}`)
        if (!res.ok) return
        const data = await res.json()
        if (!data?.found || !data?.student) {
          setFoundExisting(false)
          return
        }
        const s = data.student
        setFoundExisting(true)
        setName(String(s.name ?? ""))
        setFather(String(s.father ?? ""))
        setMother(String(s.mother ?? ""))
        setPhone(String(s.phone ?? ""))
        setEmail(String(s.email ?? ""))
        setHealthFund(String(s.healthFund ?? ""))
        setAllergies(String(s.allergies ?? ""))
        setProfileImage(String(s.profileImage ?? ""))
        const bd = s.birthDate ? String(s.birthDate).split("T")[0] : ""
        setBirthDate(bd)
      } catch {
        // no-op
      } finally {
        setIsLookupLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [idNumber])

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => {
      router.push("/login")
    }, 5000)
    return () => clearTimeout(timer)
  }, [success, router])

  const handleProfileImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToProfileImageDataUrl(file)
    setProfileImage(dataUrl)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("יש להזין שם")
      return
    }
    if (!idNumber.trim()) {
      setError("יש להזין תעודת זהות כדי ליצור משתמש תלמיד אוטומטי")
      return
    }
    if (!phone.trim()) {
      setError("יש להזין טלפון הורה כדי ליצור סיסמה ראשונית אוטומטית")
      return
    }
    if (!confirmCenterAgreement) {
      setError("יש לאשר את הסכם המרכז כדי להמשיך")
      return
    }
    if (!confirmPhotoConsent) {
      setError("יש לאשר צילום של הילד כדי להמשיך")
      return
    }
    if (!noSensitivity && !allergies.trim()) {
      setError("יש לציין רגישויות או לסמן שאין רגישות לילד")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/register/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          idNumber: idNumber.trim() || null,
          father: father.trim() || null,
          mother: mother.trim() || null,
          birthDate: normalizeBirthDateInput(birthDate) || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          healthFund: healthFund.trim() || null,
          allergies: noSensitivity
            ? "אין רגישות (סומן בטופס רישום)"
            : allergies.trim(),
          profileImage: profileImage.trim() || null,
          status: "מתעניין",
          courseIds: selectedCourseId ? [selectedCourseId] : [],
          courseSessions: {},
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "שגיאה ברישום")
      }
      const data = await res.json().catch(() => ({}))
      setSubmittedExistingStudent(data?.existingStudent === true)
      setSuccess(true)
      setName("")
      setIdNumber("")
      setFather("")
      setMother("")
      setBirthDate("")
      setPhone("")
      setEmail("")
      setHealthFund("")
      setAllergies("")
      setProfileImage("")
      setConfirmCenterAgreement(false)
      setConfirmPhotoConsent(false)
      setNoSensitivity(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "שגיאה ברישום")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-2 py-6 sm:px-4">
        <Card className="w-full max-w-md border-green-200 bg-green-50 shadow-md">
          <CardContent className="px-4 pt-6 text-center sm:px-6">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-green-800 sm:text-xl">הרישום התקבל</h2>
            <p className="mt-2 text-sm text-green-700 sm:text-base">נצור איתך קשר בהקדם.</p>
            {submittedExistingStudent === true ? (
              <p className="text-blue-800 mt-2 font-medium">זוהה תלמיד קיים — עודכנה הרשמה מחדש עם הנתונים הקיימים.</p>
            ) : (
              <p className="text-blue-800 mt-2 font-medium">נוצר תלמיד חדש במערכת עם משתמש התחברות אוטומטי.</p>
            )}
            {submittedExistingStudent !== true && (
              <div className="mt-3 rounded-lg border border-green-300 bg-white/70 px-3 py-2 text-sm text-green-900">
                נוצר משתמש תלמיד אוטומטי:
                <br />
                שם משתמש = תעודת זהות
                <br />
                סיסמה ראשונית = טלפון ההורה שהוזן בטופס
              </div>
            )}
            <p className="mt-2 text-sm text-green-700 sm:text-base">מעבירים אותך לדף התחברות בעוד 5 שניות...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-start py-6 sm:justify-center sm:py-8">
      <Card className="w-full max-w-md shadow-lg sm:max-w-lg">
        <CardHeader className="space-y-2 px-4 text-center sm:px-6">
          <CardTitle className="text-xl sm:text-2xl">רישום תלמיד</CardTitle>
          <CardDescription className="text-pretty">מלא את הפרטים ונחזור אליך</CardDescription>
          {selectedCourseId && (
            <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm leading-snug text-blue-800 sm:text-right">
              נרשמת לקורס: {selectedCourseName || "קורס ייעודי"}.
              הבקשה תופיע כמתעניין ותאושר על ידי מנהל לפני שיבוץ לקורס.
            </div>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-6 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">שם מלא *</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="הכנס שם"
                  className="pr-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="idNumber">תעודת זהות</Label>
              <Input
                id="idNumber"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="הכנס תעודת זהות"
                disabled={isSubmitting}
              />
              {isLookupLoading && (
                <p className="text-xs text-muted-foreground">בודק אם תלמיד כבר קיים...</p>
              )}
              {foundExisting && !isLookupLoading && (
                <p className="text-xs text-blue-700">נמצא תלמיד קיים. הטופס מולא אוטומטית לפי ת״ז.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="father">שם האב</Label>
              <div className="relative">
                <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="father"
                  value={father}
                  onChange={(e) => setFather(e.target.value)}
                  placeholder="הכנס שם האב"
                  className="pr-10"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mother">שם האם</Label>
              <div className="relative">
                <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="mother"
                  value={mother}
                  onChange={(e) => setMother(e.target.value)}
                  placeholder="הכנס שם האם"
                  className="pr-10"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">תאריך לידה</Label>
              <Input
                id="birthDate"
                type="text"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="YYYY-MM-DD או DD/MM/YYYY"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileImageUpload">תמונת פרופיל</Label>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                {profileImage ? (
                  <img src={profileImage} alt="profile preview" className="mx-auto h-16 w-16 rounded-full border bg-white object-cover sm:mx-0" />
                ) : (
                  <div className="mx-auto h-16 w-16 rounded-full border-2 border-dashed bg-muted sm:mx-0" />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    id="profileImageUpload"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="text-xs sm:text-sm"
                    onChange={handleProfileImageUpload}
                    disabled={isSubmitting}
                  />
                  {profileImage && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setProfileImage("")} disabled={isSubmitting}>
                      הסר תמונה
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">טלפון</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="הכנס טלפון"
                  className="pr-10"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">אימייל (לא חובה)</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="הכנס אימייל (לא חובה)"
                  className="pr-10"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="healthFund">קופת חולים</Label>
              <Input
                id="healthFund"
                value={healthFund}
                onChange={(e) => setHealthFund(e.target.value)}
                placeholder="לדוגמה: כללית / מכבי / מאוחדת / לאומית"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allergies">רגישויות</Label>
              <div className="relative">
                <Heart className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="allergies"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="אם קיימת רגישות, פרט כאן"
                  className="pr-10 min-h-[90px]"
                  disabled={isSubmitting || noSensitivity}
                />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirmCenterAgreement"
                  className="mt-0.5 shrink-0"
                  checked={confirmCenterAgreement}
                  onCheckedChange={(checked) => setConfirmCenterAgreement(checked === true)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="confirmCenterAgreement" className="cursor-pointer text-sm leading-snug">
                  מאשר את הסכם המרכז *
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirmPhotoConsent"
                  className="mt-0.5 shrink-0"
                  checked={confirmPhotoConsent}
                  onCheckedChange={(checked) => setConfirmPhotoConsent(checked === true)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="confirmPhotoConsent" className="cursor-pointer text-sm leading-snug">
                  מאשר צילום של הילד *
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="noSensitivity"
                  className="mt-0.5 shrink-0"
                  checked={noSensitivity}
                  onCheckedChange={(checked) => {
                    const isChecked = checked === true
                    setNoSensitivity(isChecked)
                    if (isChecked) setAllergies("")
                  }}
                  disabled={isSubmitting}
                />
                <Label htmlFor="noSensitivity" className="cursor-pointer text-sm leading-snug">
                  אין רגישות לילד
                </Label>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  שולח...
                </>
              ) : (
                "שלח רישום"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RegisterStudentPage() {
  return (
    <Suspense fallback={null}>
      <RegisterStudentContent />
    </Suspense>
  )
}
