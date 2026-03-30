"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { User, Phone, Mail, Loader2, CheckCircle, Users, Heart } from "lucide-react"

export default function RegisterStudentPage() {
  const searchParams = useSearchParams()
  const [name, setName] = useState("")
  const [idNumber, setIdNumber] = useState("")
  const [father, setFather] = useState("")
  const [mother, setMother] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [healthFund, setHealthFund] = useState("")
  const [allergies, setAllergies] = useState("")
  const [confirmCenterAgreement, setConfirmCenterAgreement] = useState(false)
  const [confirmPhotoConsent, setConfirmPhotoConsent] = useState(false)
  const [noSensitivity, setNoSensitivity] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedCourseId = searchParams.get("courseId")?.trim() || ""
  const selectedCourseName = searchParams.get("courseName")?.trim() || ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("יש להזין שם")
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
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          idNumber: idNumber.trim() || null,
          father: father.trim() || null,
          mother: mother.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          healthFund: healthFund.trim() || null,
          allergies: noSensitivity
            ? "אין רגישות (סומן בטופס רישום)"
            : allergies.trim(),
          status: "מתעניין",
          courseIds: selectedCourseId ? [selectedCourseId] : [],
          courseSessions: {},
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "שגיאה ברישום")
      }
      setSuccess(true)
      setName("")
      setIdNumber("")
      setFather("")
      setMother("")
      setPhone("")
      setEmail("")
      setHealthFund("")
      setAllergies("")
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200 bg-green-50">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-800">הרישום התקבל</h2>
            <p className="text-green-700 mt-2">נצור איתך קשר בהקדם.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">רישום תלמיד</CardTitle>
          <CardDescription>מלא את הפרטים ונחזור אליך</CardDescription>
          {selectedCourseId && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              נרשמת לקורס: {selectedCourseName || "קורס ייעודי"}.
              הבקשה תופיע כמתעניין ותאושר על ידי מנהל לפני שיבוץ לקורס.
            </div>
          )}
        </CardHeader>
        <CardContent>
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
              <Label htmlFor="email">אימייל</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="הכנס אימייל"
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
              <div className="flex items-center gap-2">
                <Checkbox
                  id="confirmCenterAgreement"
                  checked={confirmCenterAgreement}
                  onCheckedChange={(checked) => setConfirmCenterAgreement(checked === true)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="confirmCenterAgreement" className="text-sm cursor-pointer">
                  מאשר את הסכם המרכז *
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="confirmPhotoConsent"
                  checked={confirmPhotoConsent}
                  onCheckedChange={(checked) => setConfirmPhotoConsent(checked === true)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="confirmPhotoConsent" className="text-sm cursor-pointer">
                  מאשר צילום של הילד *
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="noSensitivity"
                  checked={noSensitivity}
                  onCheckedChange={(checked) => {
                    const isChecked = checked === true
                    setNoSensitivity(isChecked)
                    if (isChecked) setAllergies("")
                  }}
                  disabled={isSubmitting}
                />
                <Label htmlFor="noSensitivity" className="text-sm cursor-pointer">
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
