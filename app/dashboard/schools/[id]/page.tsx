"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import NewSchoolPage from "../new/page"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, Pencil, Mail, Phone, MapPin, User2, Loader2, Users, Building2, BookOpen, Activity, CreditCard } from "lucide-react"

interface School {
  id: string
  name: string
  city: string | null
  address: string | null
  contactPerson: string | null
  phone: string | null
  email: string | null
  status: string | null
  institutionCode: string | null
  schoolType: string | null
  schoolPhone: string | null
  contactPhone: string | null
  bankName: string | null
  bankCode: string | null
  bankBranch: string | null
  bankAccount: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

function safe(v: any) {
  if (v === null || v === undefined || v === "") return "—"
  return String(v)
}

const statusLabels: Record<string, string> = {
  active: "פעיל",
  inactive: "לא פעיל",
  interested: "מתעניין",
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-red-100 text-red-800",
  interested: "bg-yellow-100 text-yellow-800",
}

const schoolTypeLabels: Record<string, string> = {
  elementary: "יסודי",
  middle: "חטיבת ביניים",
  high: "תיכון",
  comprehensive: "מקיף",
  religious: "דתי",
  other: "אחר",
}

export default function SchoolViewPage() {
  const params = useParams()
  const id = params.id as string
  const isNewPage = id === "new"
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isNewPage) return
    
    const fetchSchool = async () => {
      try {
        const res = await fetch(`/api/schools/${id}`)
        if (res.ok) {
          const data = await res.json()
          setSchool(data)
        }
      } catch (err) {
        console.error("Failed to fetch school:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchSchool()
  }, [id, isNewPage])

  // אם זה דף new, מציג את טופס יצירת בית הספר
  if (isNewPage) {
    return <NewSchoolPage />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!school) {
    return <div className="p-6 text-center">לא נמצא בית ספר</div>
  }

  const status = school.status || "active"

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
          <Link href="/dashboard/schools" className="shrink-0">
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold break-words sm:text-3xl">פרטי בית ספר</h1>
            <p className="mt-1 break-words text-muted-foreground">בתי ספר &gt; {school.name}</p>
          </div>
        </div>

        <Link href={`/dashboard/schools/${school.id}/edit`} className="w-full shrink-0 sm:w-auto">
          <Button className="w-full gap-2 sm:w-auto">
            <Pencil className="h-4 w-4 shrink-0" />
            ערוך פרטים
          </Button>
        </Link>
      </div>

      {/* Main Card with Tabs */}
      <Card className="overflow-hidden">
        <Tabs defaultValue="general" dir="rtl">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-b bg-muted/30 sm:grid-cols-4">
            <TabsTrigger value="general" className="rounded-none text-xs data-[state=active]:bg-background sm:text-sm">
              כללי
            </TabsTrigger>
            <TabsTrigger value="courses" className="rounded-none text-xs data-[state=active]:bg-background sm:text-sm">
              קורסים
            </TabsTrigger>
            <TabsTrigger value="students" className="rounded-none text-xs data-[state=active]:bg-background sm:text-sm">
              תלמידים
            </TabsTrigger>
            <TabsTrigger value="activity" className="rounded-none text-xs data-[state=active]:bg-background sm:text-sm">
              פעילות
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 p-3 sm:space-y-6 sm:p-6">
            {/* School Header */}
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Users className="h-10 w-10 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold break-words sm:text-2xl">{school.name}</h2>
              <Badge className={`mt-2 ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
                {statusLabels[status] || status}
              </Badge>
            </div>

            {/* Info Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg bg-slate-50/50 flex items-start gap-3">
                <MapPin className="h-5 w-5 text-blue-600 mt-1" />
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-sm text-muted-foreground">כתובת</div>
                  <div className="break-words font-medium">
                    {safe(school.address)}
                    {school.city ? `, ${school.city}` : ""}
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-slate-50/50 flex items-start gap-3">
                <Phone className="h-5 w-5 text-blue-600 mt-1" />
                <div className="text-right flex-1">
                  <div className="text-sm text-muted-foreground">טלפון</div>
                  <div className="font-medium">{safe(school.schoolPhone || school.phone)}</div>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-slate-50/50 flex items-start gap-3">
                <Mail className="h-5 w-5 text-blue-600 mt-1" />
                <div className="text-right flex-1">
                  <div className="text-sm text-muted-foreground">אימייל</div>
                  <div className="font-medium">{safe(school.email)}</div>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-slate-50/50 flex items-start gap-3">
                <User2 className="h-5 w-5 text-blue-600 mt-1" />
                <div className="text-right flex-1">
                  <div className="text-sm text-muted-foreground">איש קשר</div>
                  <div className="font-medium">{safe(school.contactPerson)}</div>
                </div>
              </div>
            </div>

            {/* School Type */}
            <div className="p-4 border rounded-lg bg-slate-50/50">
              <div className="text-sm text-muted-foreground text-right">סוג בית הספר</div>
              <div className="font-medium text-right">{schoolTypeLabels[school.schoolType || ""] || safe(school.schoolType)}</div>
            </div>

            {/* Additional Info */}
            {school.institutionCode && (
              <div className="p-4 border rounded-lg bg-slate-50/50">
                <div className="text-sm text-muted-foreground text-right">קוד מוסד</div>
                <div className="font-medium text-right">{school.institutionCode}</div>
              </div>
            )}

            {/* Bank Details */}
            {(school.bankName || school.bankAccount) && (
              <div className="p-4 border rounded-lg bg-orange-50/50 space-y-3">
                <div className="flex items-center gap-2 text-right">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                  <span className="font-semibold">פרטי חשבון בנק</span>
                </div>
                <div className="grid gap-4 text-right sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-sm text-muted-foreground">בנק</div>
                    <div className="font-medium">{safe(school.bankName)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">קוד בנק</div>
                    <div className="font-medium">{safe(school.bankCode)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">סניף</div>
                    <div className="font-medium">{safe(school.bankBranch)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">מספר חשבון</div>
                    <div className="font-medium">{safe(school.bankAccount)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {school.notes && (
              <div className="p-4 border rounded-lg bg-pink-50/50">
                <div className="text-sm text-muted-foreground text-right">הערות</div>
                <div className="font-medium whitespace-pre-wrap text-right">{school.notes}</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="courses" className="p-3 sm:p-6">
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mb-4 opacity-50" />
              <p>אין קורסים משויכים לבית ספר זה</p>
            </div>
          </TabsContent>

          <TabsContent value="students" className="p-3 sm:p-6">
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p>אין תלמידים משויכים לבית ספר זה</p>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="p-3 sm:p-6">
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Activity className="h-12 w-12 mb-4 opacity-50" />
              <p>אין פעילות לבית ספר זה</p>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
