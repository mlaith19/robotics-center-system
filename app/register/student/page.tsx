"use client"

import { Suspense, useEffect, useState, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle, Heart } from "lucide-react"
import { fileToProfileImageDataUrl } from "@/lib/profile-image-client"

function RegisterStudentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [gender, setGender] = useState("")
  const [idNumber, setIdNumber] = useState("")
  const [className, setClassName] = useState("")
  const [schoolName, setSchoolName] = useState("")
  const [parent1Name, setParent1Name] = useState("")
  const [parent1Relation, setParent1Relation] = useState("")
  const [parent1Phone, setParent1Phone] = useState("")
  const [parent1Email, setParent1Email] = useState("")
  const [parent1City, setParent1City] = useState("")
  const [parent2Name, setParent2Name] = useState("")
  const [parent2Relation, setParent2Relation] = useState("")
  const [parent2Phone, setParent2Phone] = useState("")
  const [parent2Email, setParent2Email] = useState("")
  const [parent2City, setParent2City] = useState("")
  const [emergencyContactName, setEmergencyContactName] = useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [healthFund, setHealthFund] = useState("")
  const [allergies, setAllergies] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [registrationInterest, setRegistrationInterest] = useState("")
  const [confirmCenterAgreement, setConfirmCenterAgreement] = useState(false)
  const [confirmPhotoConsent, setConfirmPhotoConsent] = useState(false)
  const [noSensitivity, setNoSensitivity] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLookupLoading, setIsLookupLoading] = useState(false)
  const [foundExisting, setFoundExisting] = useState(false)
  const [submittedExistingStudent, setSubmittedExistingStudent] = useState<boolean | null>(null)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(1)
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
  function ageFromBirthDate(value: string): string {
    const normalized = normalizeBirthDateInput(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "—"
    const birth = new Date(normalized)
    if (Number.isNaN(birth.getTime())) return "—"
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1
    return age >= 0 ? String(age) : "—"
  }
  function isValidIsraeliId(value: string): boolean {
    const digits = String(value || "").replace(/\D/g, "")
    if (digits.length !== 9) return false
    let sum = 0
    for (let i = 0; i < 9; i += 1) {
      const n = Number(digits[i])
      const step = n * ((i % 2) + 1)
      sum += step > 9 ? step - 9 : step
    }
    return sum % 10 === 0
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
        const rawFirst = String((s as { firstName?: string | null }).firstName ?? "").trim()
        const rawLast = String((s as { lastName?: string | null }).lastName ?? "").trim()
        const full = String(s.name ?? "").trim()
        const [fallbackFirst = "", ...rest] = full.split(" ")
        setFirstName(rawFirst || fallbackFirst || "")
        setLastName(rawLast || rest.join(" ").trim())
        setGender(String((s as { gender?: string | null }).gender ?? ""))
        setClassName(String((s as { className?: string | null }).className ?? ""))
        setSchoolName(String((s as { schoolName?: string | null }).schoolName ?? ""))
        setParent1Name(String((s as { parent1Name?: string | null }).parent1Name ?? s.father ?? ""))
        setParent1Relation(String((s as { parent1Relation?: string | null }).parent1Relation ?? "אב"))
        setParent1Phone(String((s as { parent1Phone?: string | null }).parent1Phone ?? s.phone ?? ""))
        setParent1Email(String((s as { parent1Email?: string | null }).parent1Email ?? s.email ?? ""))
        setParent1City(String((s as { parent1City?: string | null }).parent1City ?? (s as { city?: string | null }).city ?? ""))
        setParent2Name(String((s as { parent2Name?: string | null }).parent2Name ?? s.mother ?? ""))
        setParent2Relation(String((s as { parent2Relation?: string | null }).parent2Relation ?? "אם"))
        setParent2Phone(String((s as { parent2Phone?: string | null }).parent2Phone ?? ""))
        setParent2Email(String((s as { parent2Email?: string | null }).parent2Email ?? ""))
        setParent2City(String((s as { parent2City?: string | null }).parent2City ?? ""))
        setEmergencyContactName(String((s as { emergencyContactName?: string | null }).emergencyContactName ?? ""))
        setEmergencyContactPhone(String((s as { emergencyContactPhone?: string | null }).emergencyContactPhone ?? ""))
        setHealthFund(String(s.healthFund ?? ""))
        setAllergies(String(s.allergies ?? ""))
        setProfileImage(String(s.profileImage ?? ""))
        setRegistrationInterest(String((s as { registrationInterest?: string | null }).registrationInterest ?? ""))
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
    if (!firstName.trim() || !lastName.trim()) {
      setError("יש להזין שם פרטי ושם משפחה")
      return
    }
    if (!idNumber.trim()) {
      setError("יש להזין תעודת זהות כדי ליצור משתמש תלמיד אוטומטי")
      return
    }
    if (!isValidIsraeliId(idNumber)) {
      setError("מספר תעודת זהות לא תקין")
      return
    }
    if (!gender.trim()) {
      setError("יש לבחור מין")
      return
    }
    if (!parent1Phone.trim()) {
      setError("יש להזין נייד של הורה ראשי")
      return
    }
    if (!confirmCenterAgreement) {
      setError("יש לאשר את הסכם המרכז כדי להמשיך")
      return
    }
    if (!noSensitivity && !allergies.trim()) {
      setError("יש לציין רגישויות או לסמן שאין רגישות לילד")
      return
    }
    if (!selectedCourseId && registrationInterest.trim().length < 2) {
      setError("יש לציין באיזה תחום או קורס מתעניינים (כשלא נרשמים מקישור לקורס ספציפי)")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/register/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender: gender || null,
          className: className.trim() || null,
          schoolName: schoolName.trim() || null,
          parent1Name: parent1Name.trim() || null,
          parent1Relation: parent1Relation.trim() || null,
          parent1Phone: parent1Phone.trim() || null,
          parent1Email: parent1Email.trim() || null,
          parent1City: parent1City.trim() || null,
          parent2Name: parent2Name.trim() || null,
          parent2Relation: parent2Relation.trim() || null,
          parent2Phone: parent2Phone.trim() || null,
          parent2Email: parent2Email.trim() || null,
          parent2City: parent2City.trim() || null,
          emergencyContactName: emergencyContactName.trim() || null,
          emergencyContactPhone: emergencyContactPhone.trim() || null,
          idNumber: idNumber.trim() || null,
          father: parent1Name.trim() || null,
          mother: parent2Name.trim() || null,
          birthDate: normalizeBirthDateInput(birthDate) || null,
          phone: parent1Phone.trim() || null,
          email: parent1Email.trim() || null,
          healthFund: healthFund.trim() || null,
          allergies: noSensitivity
            ? "אין רגישות (סומן בטופס רישום)"
            : allergies.trim(),
          profileImage: profileImage.trim() || null,
          status: "מתעניין",
          courseIds: selectedCourseId ? [selectedCourseId] : [],
          courseSessions: {},
          registrationInterest: selectedCourseId ? null : registrationInterest.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "שגיאה ברישום")
      }
      const data = await res.json().catch(() => ({}))
      setSubmittedExistingStudent(data?.existingStudent === true)
      setSuccess(true)
      setFirstName("")
      setLastName("")
      setGender("")
      setClassName("")
      setSchoolName("")
      setParent1Name("")
      setParent1Relation("")
      setParent1Phone("")
      setParent1Email("")
      setParent1City("")
      setParent2Name("")
      setParent2Relation("")
      setParent2Phone("")
      setParent2Email("")
      setParent2City("")
      setEmergencyContactName("")
      setEmergencyContactPhone("")
      setIdNumber("")
      setBirthDate("")
      setHealthFund("")
      setAllergies("")
      setProfileImage("")
      setRegistrationInterest("")
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
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-start py-6 sm:justify-center sm:py-8" dir="rtl">
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
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                שלב {activeStep}/3 • {activeStep === 1 ? "פרטי תלמיד" : activeStep === 2 ? "פרטי הורה" : "כללי"}
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setActiveStep(step)}
                    className={`h-2.5 w-7 rounded-full ${activeStep === step ? "bg-primary" : "bg-muted"}`}
                  />
                ))}
              </div>
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
            {activeStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="profileImageUpload">תמונת פרופיל (לא חובה)</Label>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center gap-3">
                      {profileImage ? (
                        <img src={profileImage} alt="profile preview" className="h-16 w-16 rounded-full border bg-white object-cover" />
                      ) : (
                        <div className="h-16 w-16 rounded-full border-2 border-dashed bg-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2 ps-3">
                      <Input
                        id="profileImageUpload"
                        type="file"
                        accept="image/*"
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
                    <div className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center">
                      <div className="text-xs text-blue-700">גיל</div>
                      <div className="text-xl font-bold text-blue-900 leading-none mt-1">{ageFromBirthDate(birthDate)}</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lastName">שם משפחה *</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={isSubmitting} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">שם פרטי *</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={isSubmitting} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="gender">מין *</Label>
                    <Select value={gender} onValueChange={setGender} disabled={isSubmitting}>
                      <SelectTrigger id="gender" className="h-10 text-sm">
                        <SelectValue placeholder="בחר מין" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">זכר</SelectItem>
                        <SelectItem value="female">נקבה</SelectItem>
                        <SelectItem value="other">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idNumber">תעודת זהות *</Label>
                    <Input
                      id="idNumber"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                      placeholder="9 ספרות"
                      className="h-10 text-sm"
                      disabled={isSubmitting}
                      inputMode="numeric"
                      maxLength={9}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">תאריך לידה</Label>
                    <Input
                      id="birthDate"
                      type="text"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="h-10 text-sm"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                {(isLookupLoading || foundExisting) && (
                  <div className="text-xs">
                    {isLookupLoading ? (
                      <p className="text-muted-foreground">בודק אם תלמיד כבר קיים...</p>
                    ) : (
                      <p className="text-blue-700">נמצא תלמיד קיים. הטופס מולא אוטומטית לפי ת״ז.</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="className">כיתה</Label>
                    <Input
                      id="className"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="לדוגמה: ה׳2"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schoolName">בית ספר</Label>
                    <Input
                      id="schoolName"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="שם בית ספר"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </>
            )}
            {activeStep === 2 && (
              <>
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="font-medium">הורה 1</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input value={parent1Name} onChange={(e) => setParent1Name(e.target.value)} placeholder="שם הורה" disabled={isSubmitting} />
                    <Select value={parent1Relation} onValueChange={setParent1Relation} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="קרבה לתלמיד" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="אב">אב</SelectItem>
                        <SelectItem value="אם">אם</SelectItem>
                        <SelectItem value="אח">אח</SelectItem>
                        <SelectItem value="אחות">אחות</SelectItem>
                        <SelectItem value="אחר">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={parent1Phone} onChange={(e) => setParent1Phone(e.target.value)} placeholder="נייד" disabled={isSubmitting} />
                    <Input value={parent1Email} onChange={(e) => setParent1Email(e.target.value)} placeholder="אימייל" disabled={isSubmitting} />
                    <Input value={parent1City} onChange={(e) => setParent1City(e.target.value)} placeholder="עיר" disabled={isSubmitting} />
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="font-medium">הורה 2</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input value={parent2Name} onChange={(e) => setParent2Name(e.target.value)} placeholder="שם הורה" disabled={isSubmitting} />
                    <Select value={parent2Relation} onValueChange={setParent2Relation} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="קרבה לתלמיד" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="אב">אב</SelectItem>
                        <SelectItem value="אם">אם</SelectItem>
                        <SelectItem value="אח">אח</SelectItem>
                        <SelectItem value="אחות">אחות</SelectItem>
                        <SelectItem value="אחר">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={parent2Phone} onChange={(e) => setParent2Phone(e.target.value)} placeholder="נייד" disabled={isSubmitting} />
                    <Input value={parent2Email} onChange={(e) => setParent2Email(e.target.value)} placeholder="אימייל" disabled={isSubmitting} />
                    <Input value={parent2City} onChange={(e) => setParent2City(e.target.value)} placeholder="עיר" disabled={isSubmitting} />
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="font-medium">איש קשר חירום</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="שם איש קשר" disabled={isSubmitting} />
                    <Input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="נייד חירום" disabled={isSubmitting} />
                  </div>
                </div>
              </>
            )}
            {activeStep === 3 && !selectedCourseId && (
              <div className="space-y-2">
                <Label htmlFor="registrationInterest">באיזה תחום או קורס מתעניינים? *</Label>
                <Textarea
                  id="registrationInterest"
                  value={registrationInterest}
                  onChange={(e) => setRegistrationInterest(e.target.value)}
                  placeholder="לדוגמה: רובוטיקה לילדים, קורס קיץ, לגו..."
                  className="min-h-[88px]"
                  disabled={isSubmitting}
                  required
                />
              </div>
            )}
            {activeStep === 3 && <div className="space-y-2">
              <Label htmlFor="healthFund">קופת חולים</Label>
              <Input
                id="healthFund"
                value={healthFund}
                onChange={(e) => setHealthFund(e.target.value)}
                placeholder="לדוגמה: כללית / מכבי / מאוחדת / לאומית"
                disabled={isSubmitting}
              />
            </div>}
            {activeStep === 3 && <div className="space-y-2">
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
            </div>}
            {activeStep === 3 && <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
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
                  מאשר צילום של הילד במסגרת הפעילות (רשות)
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
            </div>}
            <div className="flex flex-col gap-2 sm:flex-row">
              {activeStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full sm:h-11 sm:flex-1"
                  onClick={() => setActiveStep((s) => Math.max(1, s - 1))}
                >
                  חזרה
                </Button>
              )}
              {activeStep < 3 ? (
                <Button
                  type="button"
                  className="h-10 w-full sm:h-11 sm:flex-1"
                  onClick={() => setActiveStep((s) => Math.min(3, s + 1))}
                >
                  הבא
                </Button>
              ) : (
            <Button type="submit" className="h-10 w-full sm:h-11 sm:flex-1" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  שולח...
                </>
              ) : (
                "שלח רישום"
              )}
            </Button>
              )}
            </div>
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
