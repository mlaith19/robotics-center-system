"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, Rocket, Building2, User, DollarSign, BookOpen, Users, TrendingUp, Edit, Loader2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { useEffect } from "react"
import { fetcher as apiFetcher } from "@/lib/swr-fetcher"

export default function GafanProgramViewPage() {
  const params = useParams()
  const router = useRouter()
  
  // אם ה-ID הוא "new", נפנה לדף היצירה
  const isNewPage = params.id === "new"
  
  useEffect(() => {
    if (isNewPage) {
      router.replace("/dashboard/gafan/new")
    }
  }, [isNewPage, router])
  
  const { data: program, error, isLoading } = useSWR(
    isNewPage ? null : `/api/gafan/${params.id}`, 
    apiFetcher
  )

  // אם זה דף new, מציג loader בזמן ה-redirect
  if (isNewPage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !program) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">שגיאה בטעינת הנתונים או שהתוכנית לא נמצאה</p>
        <Link href="/dashboard/gafan">
          <Button className="mt-4">חזרה לרשימה</Button>
        </Link>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen">
      <div className="container mx-auto max-w-4xl p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard/gafan">
              <Button variant="ghost" size="icon">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Link href="/dashboard/gafan" className="hover:text-foreground transition-colors">
                  תוכניות גפ"ן
                </Link>
                <span>/</span>
                <span className="text-foreground">{program.name}</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">פרטי תוכנית</h1>
            </div>
            <Link href={`/dashboard/gafan/${program.id}/edit`}>
              <Button className="gap-2">
                <Edit className="h-4 w-4" />
                ערוך תוכנית
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="general" className="w-full" dir="rtl">
              <div className="border-b">
                <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none">
                  <TabsTrigger
                    value="general"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-4"
                  >
                    כללי
                  </TabsTrigger>
                  <TabsTrigger
                    value="courses"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-4"
                  >
                    קורסים
                  </TabsTrigger>
                  <TabsTrigger
                    value="students"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-4"
                  >
                    תלמידים
                  </TabsTrigger>
                  <TabsTrigger
                    value="activity"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-4"
                  >
                    פעילות
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="general" className="p-6 space-y-6">
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Rocket className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-foreground mb-1">{program.name}</h2>
                        <p className="text-muted-foreground">מס׳ תוכנית: {program.programNumber}</p>
                      </div>
                      <span
                        className={`px-4 py-2 rounded-full text-sm font-medium ${
                          program.status === "פעיל"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : program.status === "מתעניין"
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {program.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Rocket className="h-5 w-5 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold">מידע על התוכנית</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">תוקף לשנה</p>
                        <p className="font-medium">{program.validYear}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">תאריך יצירה</p>
                        <p className="font-medium">
                          {program.createdAt ? new Date(program.createdAt).toLocaleDateString("he-IL") : "לא זמין"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold">פרטי חברה</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">שם חברה</p>
                        <p className="font-medium">{program.companyName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">ח"פ חברה</p>
                        <p className="font-medium">{program.companyId}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">כתובת</p>
                        <p className="font-medium">{program.companyAddress}</p>
                      </div>
                    </div>

                    {program.bankName && (
                      <div className="pt-6 border-t space-y-4">
                        <h4 className="font-semibold text-sm text-muted-foreground">פרטי חשבון בנק</h4>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">בנק</p>
                            <p className="font-medium">{program.bankName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">קוד בנק</p>
                            <p className="font-medium">{program.bankCode || "לא צוין"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">סניף</p>
                            <p className="font-medium">{program.branchNumber || "לא צוין"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">מס׳ חשבון</p>
                            <p className="font-medium">{program.accountNumber || "לא צוין"}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold">מפעיל התוכנית</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="font-medium">{program.operatorName}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-orange-600" />
                      </div>
                      <h3 className="text-lg font-semibold">תמחור</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-primary">₪{program.priceMin || 0}</p>
                      {program.priceMax && (
                        <>
                          <span className="text-muted-foreground">-</span>
                          <p className="text-2xl font-bold text-primary">₪{program.priceMax}</p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {program.notes && (
                  <Card>
                    <CardHeader className="border-b">
                      <h3 className="text-lg font-semibold">הערות</h3>
                    </CardHeader>
                    <CardContent className="p-6">
                      <p className="text-muted-foreground whitespace-pre-wrap">{program.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="courses" className="p-6">
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">קורסים משויכים</h3>
                  <p className="text-muted-foreground mb-4">0 קורסים משויכים לתוכנית זו</p>
                </div>
              </TabsContent>

              <TabsContent value="students" className="p-6">
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">תלמידים משויכים</h3>
                  <p className="text-muted-foreground mb-4">0 תלמידים רשומים לתוכנית זו</p>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="p-6">
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">פעילות התוכנית</h3>
                  <p className="text-muted-foreground">סטטיסטיקות ומעקב אחר פעילות התוכנית</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
