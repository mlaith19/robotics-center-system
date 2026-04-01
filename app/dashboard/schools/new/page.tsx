"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight, Building2, MapPin, Phone, CreditCard, FileText, Save, Loader2, ClipboardList } from "lucide-react"

const israelCities = [
  "תל אביב", "ירושלים", "חיפה", "ראשון לציון", "פתח תקווה", "אשדוד", "נתניה", "באר שבע",
  "בני ברק", "חולון", "רמת גן", "אשקלון", "רחובות", "בת ים", "הרצליה", "כפר סבא",
  "מודיעין", "לוד", "רמלה", "רעננה", "הוד השרון", "גבעתיים", "קריית גת", "נהריה",
  "עכו", "אילת", "טבריה", "צפת", "קריית שמונה", "עפולה", "נצרת", "אום אל-פחם"
]

const banksList = [
  { code: "12", name: "בנק הפועלים" },
  { code: "10", name: "בנק לאומי" },
  { code: "11", name: "בנק דיסקונט" },
  { code: "20", name: "בנק מזרחי טפחות" },
  { code: "14", name: "בנק אוצר החייל" },
  { code: "31", name: "בנק הבינלאומי" },
  { code: "17", name: "בנק מרכנתיל" },
  { code: "46", name: "בנק מסד" },
  { code: "54", name: "בנק ירושלים" },
]

export default function NewSchoolPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [form, setForm] = useState({
    status: "interested",
    name: "",
    institutionCode: "",
    schoolType: "",
    city: "",
    address: "",
    schoolPhone: "",
    contactPerson: "",
    contactPhone: "",
    email: "",
    bankName: "",
    bankCode: "",
    bankBranch: "",
    bankAccount: "",
    notes: "",
  })

  const handleBankChange = (bankName: string) => {
    const bank = banksList.find(b => b.name === bankName)
    setForm({ ...form, bankName, bankCode: bank?.code || "" })
  }

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? `Failed (${res.status})`)
      }
      router.push("/dashboard/schools")
    } catch (e: unknown) {
      const error = e as Error
      setErr(error?.message ?? "Failed to create school")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl space-y-6 p-3 sm:p-6">
      <div className="flex items-start gap-2 sm:items-center sm:gap-3">
        <Link href="/dashboard/schools">
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words sm:text-3xl">בית ספר חדש</h1>
          <p className="mt-1 text-muted-foreground">הוסף בית ספר חדש למערכת</p>
        </div>
      </div>

      {err && <Card className="p-4 border-red-200 bg-red-50 text-red-700">שגיאה: {err}</Card>}

      {/* סטטוס בית הספר */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="px-3 text-right sm:px-6">
          <div className="flex flex-row-reverse items-center justify-end gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>סטטוס בית הספר</CardTitle>
              <CardDescription>בחר את סטטוס בית הספר הנוכחי</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger className="text-right">
              <SelectValue placeholder="בחר סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interested">מתעניין</SelectItem>
              <SelectItem value="active">פעיל</SelectItem>
              <SelectItem value="inactive">לא פעיל</SelectItem>
              <SelectItem value="potential">פוטנציאלי</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* מידע כללי */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
        <CardHeader className="px-3 text-right sm:px-6">
          <div className="flex flex-row-reverse items-center justify-end gap-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>מידע כללי</CardTitle>
              <CardDescription>פרטי בית הספר הבסיסיים</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-3 sm:px-6">
          <div className="space-y-2">
            <Label className="text-right block">שם בית הספר *</Label>
            <Input 
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
              className="text-right"
              dir="rtl"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-right block">קוד מוסד</Label>
              <Input 
                value={form.institutionCode} 
                onChange={(e) => setForm({ ...form, institutionCode: e.target.value })} 
                className="text-right"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-right block">סוג בית הספר</Label>
              <Select value={form.schoolType} onValueChange={(v) => setForm({ ...form, schoolType: v })}>
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="בחר סוג" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="elementary">יסודי</SelectItem>
                  <SelectItem value="middle">חטיבת ביניים</SelectItem>
                  <SelectItem value="high">תיכון</SelectItem>
                  <SelectItem value="combined">משולב</SelectItem>
                  <SelectItem value="special">חינוך מיוחד</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* מיקום */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
        <CardHeader className="px-3 text-right sm:px-6">
          <div className="flex flex-row-reverse items-center justify-end gap-3">
            <div className="p-2 bg-purple-500 rounded-lg">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>מיקום</CardTitle>
              <CardDescription>כתובת בית הספר</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-3 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-right block">עיר *</Label>
              <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="בחר עיר" />
                </SelectTrigger>
                <SelectContent>
                  {israelCities.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-right block">כתובת *</Label>
              <Input 
                value={form.address} 
                onChange={(e) => setForm({ ...form, address: e.target.value })} 
                className="text-right"
                dir="rtl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-right block">טלפון בית ספר</Label>
            <Input 
              value={form.schoolPhone} 
              onChange={(e) => setForm({ ...form, schoolPhone: e.target.value })} 
              className="text-right"
              dir="rtl"
              type="tel"
            />
          </div>
        </CardContent>
      </Card>

      {/* פרטי קשר */}
      <Card className="border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-white">
        <CardHeader className="px-3 text-right sm:px-6">
          <div className="flex flex-row-reverse items-center justify-end gap-3">
            <div className="p-2 bg-cyan-500 rounded-lg">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>פרטי קשר</CardTitle>
              <CardDescription>איש קשר בבית הספר</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-3 sm:px-6">
          <div className="space-y-2">
            <Label className="text-right block">איש קשר *</Label>
            <Input 
              value={form.contactPerson} 
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} 
              className="text-right"
              dir="rtl"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-right block flex items-center gap-1 justify-end">
                <Phone className="h-4 w-4" />
                טלפון נייד *
              </Label>
              <Input 
                value={form.contactPhone} 
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} 
                className="text-right"
                dir="rtl"
                type="tel"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-right block flex items-center gap-1 justify-end">
                אימייל *
              </Label>
              <Input 
                value={form.email} 
                onChange={(e) => setForm({ ...form, email: e.target.value })} 
                className="text-right"
                dir="rtl"
                type="email"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* פרטי חשבון בנק */}
      <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
        <CardHeader className="px-3 text-right sm:px-6">
          <div className="flex flex-row-reverse items-center justify-end gap-3">
            <div className="p-2 bg-orange-500 rounded-lg">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>פרטי חשבון בנק</CardTitle>
              <CardDescription>מידע חשבון לתשלומים</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-3 sm:px-6">
          <div className="space-y-2">
            <Label className="text-right block">בנק</Label>
            <Select value={form.bankName} onValueChange={handleBankChange}>
              <SelectTrigger className="text-right">
                <SelectValue placeholder="בחר בנק" />
              </SelectTrigger>
              <SelectContent>
                {banksList.map((bank) => (
                  <SelectItem key={bank.code} value={bank.name}>{bank.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-right block">קוד בנק</Label>
              <Input 
                value={form.bankCode} 
                className="text-right bg-muted"
                dir="rtl"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label className="text-right block">סניף</Label>
              <Input 
                value={form.bankBranch} 
                onChange={(e) => setForm({ ...form, bankBranch: e.target.value })} 
                className="text-right"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-right block">מספר חשבון</Label>
              <Input 
                value={form.bankAccount} 
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} 
                className="text-right"
                dir="rtl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* מידע נוסף */}
      <Card className="border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-white">
        <CardHeader className="px-3 text-right sm:px-6">
          <div className="flex flex-row-reverse items-center justify-end gap-3">
            <div className="p-2 bg-pink-500 rounded-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>מידע נוסף</CardTitle>
              <CardDescription>הערות ומידע משלים</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="space-y-2">
            <Label className="text-right block">הערות</Label>
            <Textarea 
              value={form.notes} 
              onChange={(e) => setForm({ ...form, notes: e.target.value })} 
              className="text-right"
              dir="rtl"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* כפתורי פעולה */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-start">
        <Button onClick={save} disabled={!form.name.trim() || saving} className="w-full gap-2 sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              הוסף בית ספר
            </>
          )}
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.back()}>
          ביטול
        </Button>
      </div>
    </div>
  )
}
