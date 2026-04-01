"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, List, LayoutGrid, Eye, Pencil, Trash2, Phone, Mail, User, MapPin, Users, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { deleteWithUndo } from "@/lib/notify"
import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, hasFullAccessRole } from "@/lib/permissions"
import { useLanguage } from "@/lib/i18n/context"

interface Student {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  status?: string | null
  city?: string | null
  father?: string | null
  mother?: string | null
  additionalPhone?: string | null
  healthFund?: string | null
  profileImage?: string | null
  createdAt?: string
}

const statusLabels: Record<string, Record<"he" | "en" | "ar", string>> = {
  "מתעניין": { he: "מתעניין", en: "Pending", ar: "قيد الانتظار" },
  "רשום": { he: "רשום", en: "Registered", ar: "مسجل" },
  "פעיל": { he: "פעיל", en: "Active", ar: "نشط" },
  "לא פעיל": { he: "לא פעיל", en: "Inactive", ar: "غير نشط" },
  "הפסיק": { he: "הפסיק", en: "Stopped", ar: "متوقف" },
}

const statusColors: Record<string, string> = {
  "מתעניין": "bg-yellow-100 text-yellow-800",
  "רשום": "bg-blue-100 text-blue-800",
  "פעיל": "bg-green-100 text-green-800",
  "לא פעיל": "bg-gray-100 text-gray-800",
  "הפסיק": "bg-red-100 text-red-800",
}

export default function StudentsPage() {
  const { t, locale } = useLanguage()
  const isRtl = locale !== "en"
  const l = (he: string, en: string, ar: string) => (locale === "en" ? en : locale === "ar" ? ar : he)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")

  const currentUser = useCurrentUser()
  const roleKey = (currentUser?.roleKey || currentUser?.role)?.toString().toLowerCase()
  const isAdmin =
    hasFullAccessRole(currentUser?.roleKey) ||
    hasFullAccessRole(currentUser?.role) ||
    roleKey === "admin" ||
    currentUser?.role === "Administrator" ||
    currentUser?.role === "אדמין" ||
    currentUser?.role === "מנהל"
  const userPerms = currentUser?.permissions || []
  const canViewStudents = isAdmin || hasPermission(userPerms, "students.view")
  const canEditStudents = isAdmin || hasPermission(userPerms, "students.edit")
  const canDeleteStudents = isAdmin || hasPermission(userPerms, "students.delete")

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    setFetchError(null)
    try {
      const res = await fetch("/api/students")
      if (res.status === 403) {
        setFetchError(l("אין הרשאה לצפות בתלמידים (403). פנה למנהל המערכת.", "No permission to view students (403). Contact system admin.", "لا توجد صلاحية لعرض الطلاب (403). تواصل مع مدير النظام."))
        setStudents([])
        return
      }
      if (res.status === 404) {
        setStudents([])
        return
      }
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : []
        // Public registrations stay in "רישום" until approved.
        setStudents(list.filter((s) => (s?.status || "").trim() !== "מתעניין"))
      } else {
        setFetchError(l(`שגיאה בטעינת תלמידים (${res.status})`, `Error loading students (${res.status})`, `خطأ في تحميل الطلاب (${res.status})`))
        setStudents([])
      }
    } catch (error) {
      console.error("Error fetching students:", error)
      setFetchError(l("שגיאת רשת בטעינת תלמידים", "Network error while loading students", "خطأ شبكة أثناء تحميل الطلاب"))
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.phone?.includes(searchTerm) ||
    student.city?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-3 sm:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-3 sm:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <Card className="w-full max-w-md border-red-200 bg-red-50 p-4 text-center sm:p-6">
          <p className="text-red-700 font-semibold text-lg mb-2">{l("שגיאת גישה", "Access error", "خطأ صلاحية")}</p>
          <p className="text-red-600 text-sm mb-4">{fetchError}</p>
          <Button variant="outline" onClick={fetchStudents}>{t("courses.retry")}</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <PageHeader title={t("students.title")} description={t("students.manageAll")} />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="px-2"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="px-2"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          {canEditStudents && (
            <Link href="/dashboard/students/new" className="w-full sm:w-auto">
              <Button className="w-full gap-2 sm:w-auto">
                <Plus className="h-4 w-4" />
                {t("students.newStudent")}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("students.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Students Grid/List */}
      {filteredStudents.length === 0 ? (
        <Card className="p-6 text-center sm:p-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">{t("students.none")}</h3>
          <p className="text-muted-foreground mb-4">{t("students.noneMatchSearch")}</p>
          {canEditStudents && (
            <Link href="/dashboard/students/new">
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                {t("students.addFirst")}
              </Button>
            </Link>
          )}
        </Card>
      ) : viewMode === "list" ? (
        <>
          <div className="space-y-3 md:hidden">
            {filteredStudents.map((student) => (
              <Card key={student.id} className="overflow-hidden p-4">
                <div className="flex flex-col gap-3 text-right">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      {student.profileImage ? (
                        <img src={student.profileImage} alt={student.name} className="h-12 w-12 rounded-full border bg-white object-contain p-1" />
                      ) : (
                        <img src="/api/og-logo" alt="Center logo" className="h-12 w-12 rounded-full border bg-white object-contain p-1" />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold">{student.name}</div>
                        {student.email ? <div className="break-all text-xs text-muted-foreground">{student.email}</div> : null}
                      </div>
                    </div>
                    <Badge className={`w-fit shrink-0 ${statusColors[student.status || "מתעניין"] || "bg-gray-100 text-gray-800"}`}>
                      {statusLabels[student.status || "מתעניין"]?.[locale] || student.status || statusLabels["מתעניין"][locale]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>
                      <span className="block text-xs opacity-80">{l("טלפון", "Phone", "الهاتف")}</span>
                      <span className="font-medium text-foreground" dir="ltr">
                        {student.phone || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs opacity-80">{l("עיר", "City", "المدينة")}</span>
                      <span className="font-medium text-foreground">{student.city || "—"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {canDeleteStudents && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          deleteWithUndo({
                            entityKey: "student",
                            itemId: student.id,
                            itemLabel: student.name,
                            removeFromUI: () => setStudents((prev) => prev.filter((s) => s.id !== student.id)),
                            restoreFn: () => setStudents((prev) => [...prev, student]),
                            deleteFn: async () => {
                              const res = await fetch(`/api/students/${student.id}`, { method: "DELETE", credentials: "include" })
                              if (!res.ok) throw new Error("Delete failed")
                            },
                            confirmPolicy: "dangerous",
                            undoWindowMs: 10_000,
                          })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {canEditStudents && (
                      <Link href={`/dashboard/students/${student.id}/edit`} className="min-w-0 flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1 bg-transparent">
                          <Pencil className="h-4 w-4" />
                          {t("courses.edit")}
                        </Button>
                      </Link>
                    )}
                    {canViewStudents && (
                      <Link href={`/dashboard/students/${student.id}`} className="min-w-0 flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1 bg-transparent">
                          <Eye className="h-4 w-4" />
                          {t("courses.view")}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs sm:text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-right">
                    <th className="px-2 py-3 font-semibold sm:px-4">תלמיד</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">טלפון</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">עיר</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">סטטוס</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-t">
                      <td className="px-2 py-3 sm:px-4">
                        <div className="flex items-center gap-3">
                          {student.profileImage ? (
                            <img src={student.profileImage} alt={student.name} className="h-10 w-10 rounded-full border bg-white object-contain p-1" />
                          ) : (
                            <img src="/api/og-logo" alt="Center logo" className="h-10 w-10 rounded-full border bg-white object-contain p-1" />
                          )}
                          <div>
                            <div className="font-semibold">{student.name}</div>
                            {student.email ? <div className="text-xs text-muted-foreground">{student.email}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 sm:px-4" dir="ltr">
                        {student.phone || "-"}
                      </td>
                      <td className="px-2 py-3 sm:px-4">{student.city || "-"}</td>
                      <td className="px-2 py-3 sm:px-4">
                        <Badge className={statusColors[student.status || "מתעניין"] || "bg-gray-100 text-gray-800"}>
                          {statusLabels[student.status || "מתעניין"]?.[locale] || student.status || statusLabels["מתעניין"][locale]}
                        </Badge>
                      </td>
                      <td className="px-2 py-3 sm:px-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {canDeleteStudents && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-transparent px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => {
                                deleteWithUndo({
                                  entityKey: "student",
                                  itemId: student.id,
                                  itemLabel: student.name,
                                  removeFromUI: () => setStudents((prev) => prev.filter((s) => s.id !== student.id)),
                                  restoreFn: () => setStudents((prev) => [...prev, student]),
                                  deleteFn: async () => {
                                    const res = await fetch(`/api/students/${student.id}`, { method: "DELETE", credentials: "include" })
                                    if (!res.ok) throw new Error("Delete failed")
                                  },
                                  confirmPolicy: "dangerous",
                                  undoWindowMs: 10_000,
                                })
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canEditStudents && (
                            <Link href={`/dashboard/students/${student.id}/edit`}>
                              <Button variant="outline" size="sm" className="bg-transparent">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                          {canViewStudents && (
                            <Link href={`/dashboard/students/${student.id}`}>
                              <Button variant="outline" size="sm" className="bg-transparent">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => (
            <Card key={student.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                {/* Header with Avatar and Status - RTL */}
                <div className="flex items-start justify-between mb-4 flex-row-reverse">
                  <div className="flex items-center gap-3">
                    {student.profileImage ? (
                      <img src={student.profileImage} alt={student.name} className="w-12 h-12 rounded-full object-contain bg-white p-1 border" />
                    ) : (
                      <img src="/api/og-logo" alt="Center logo" className="w-12 h-12 rounded-full object-contain bg-white p-1 border" />
                    )}
                    <div className="text-right">
                      <h3 className="font-semibold text-lg">{student.name}</h3>
                      {student.city && (
                        <p className="text-sm text-muted-foreground">{student.city}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={statusColors[student.status || "מתעניין"] || "bg-gray-100 text-gray-800"}>
                    {statusLabels[student.status || "מתעניין"]?.[locale] || student.status || statusLabels["מתעניין"][locale]}
                  </Badge>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4 text-sm">
                  {student.phone && (
                    <div className="flex items-center justify-end gap-2 text-muted-foreground">
                      <span dir="ltr">{student.phone}</span>
                      <Phone className="h-4 w-4" />
                    </div>
                  )}
                  {student.email && (
                    <div className="flex items-center justify-end gap-2 text-muted-foreground">
                      <span>{student.email}</span>
                      <Mail className="h-4 w-4" />
                    </div>
                  )}
                  {student.father && (
                    <div className="flex items-center justify-end gap-2 text-muted-foreground">
                      <span>{l(`אב: ${student.father}`, `Father: ${student.father}`, `الأب: ${student.father}`)}</span>
                      <Users className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {/* Action Buttons - ערוך ומחיקה רק למי שיש לו הרשאה */}
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  {canDeleteStudents && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 bg-transparent"
                      onClick={() => {
                        deleteWithUndo({
                          entityKey: "student",
                          itemId: student.id,
                          itemLabel: student.name,
                          removeFromUI: () => setStudents((prev) => prev.filter((s) => s.id !== student.id)),
                          restoreFn: () => setStudents((prev) => [...prev, student]),
                          deleteFn: async () => {
                            const res = await fetch(`/api/students/${student.id}`, { method: "DELETE", credentials: "include" })
                            if (!res.ok) throw new Error("Delete failed")
                          },
                          confirmPolicy: "dangerous",
                          undoWindowMs: 10_000,
                        })
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canEditStudents && (
                    <Link href={`/dashboard/students/${student.id}/edit`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1 bg-transparent">
                        <Pencil className="h-4 w-4" />
                        {t("courses.edit")}
                      </Button>
                    </Link>
                  )}
                  {canViewStudents && (
                    <Link href={`/dashboard/students/${student.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1 bg-transparent">
                        <Eye className="h-4 w-4" />
                        {t("courses.view")}
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  )
}
