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
  createdAt?: string
}

const statusLabels: Record<string, string> = {
  "מתעניין": "מתעניין",
  "רשום": "רשום",
  "פעיל": "פעיל",
  "לא פעיל": "לא פעיל",
  "הפסיק": "הפסיק",
}

const statusColors: Record<string, string> = {
  "מתעניין": "bg-yellow-100 text-yellow-800",
  "רשום": "bg-blue-100 text-blue-800",
  "פעיל": "bg-green-100 text-green-800",
  "לא פעיל": "bg-gray-100 text-gray-800",
  "הפסיק": "bg-red-100 text-red-800",
}

export default function StudentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

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
        setFetchError("אין הרשאה לצפות בתלמידים (403). פנה למנהל המערכת.")
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
        setFetchError(`שגיאה בטעינת תלמידים (${res.status})`)
        setStudents([])
      }
    } catch (error) {
      console.error("Error fetching students:", error)
      setFetchError("שגיאת רשת בטעינת תלמידים")
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
      <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" dir="rtl">
        <Card className="p-6 border-red-200 bg-red-50 max-w-md w-full text-center">
          <p className="text-red-700 font-semibold text-lg mb-2">שגיאת גישה</p>
          <p className="text-red-600 text-sm mb-4">{fetchError}</p>
          <Button variant="outline" onClick={fetchStudents}>נסה שוב</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader title="תלמידים" description="נהל את כל התלמידים במרכז" />
        <div className="flex items-center gap-2">
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
            <Link href="/dashboard/students/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                תלמיד חדש
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש תלמידים..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Students Grid/List */}
      {filteredStudents.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">אין תלמידים</h3>
          <p className="text-muted-foreground mb-4">לא נמצאו תלמידים התואמים את החיפוש</p>
          {canEditStudents && (
            <Link href="/dashboard/students/new">
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                הוסף תלמיד חדש
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
          {filteredStudents.map((student) => (
            <Card key={student.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                {/* Header with Avatar and Status - RTL */}
                <div className="flex items-start justify-between mb-4 flex-row-reverse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="text-right">
                      <h3 className="font-semibold text-lg">{student.name}</h3>
                      {student.city && (
                        <p className="text-sm text-muted-foreground">{student.city}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={statusColors[student.status || "מתעניין"] || "bg-gray-100 text-gray-800"}>
                    {statusLabels[student.status || "מתעניין"] || student.status || "מתעניין"}
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
                      <span>אב: {student.father}</span>
                      <Users className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {/* Action Buttons - ערוך ומחיקה רק למי שיש לו הרשאה */}
                <div className="flex items-center gap-2 pt-3 border-t">
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
                        ערוך
                      </Button>
                    </Link>
                  )}
                  {canViewStudents && (
                    <Link href={`/dashboard/students/${student.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1 bg-transparent">
                        <Eye className="h-4 w-4" />
                        צפה
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
