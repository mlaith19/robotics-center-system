"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Trash2, Pencil, Eye, Plus, RefreshCw, 
  LayoutGrid, List, User, Mail, Phone, MapPin, GraduationCap, Banknote
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { deleteWithUndo } from "@/lib/notify"
import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, hasFullAccessRole } from "@/lib/permissions"

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
  totalPaid?: number | null
  balance?: number | null
  profileImage?: string | null
  createdAt?: string
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState("")
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
  const canViewTeachers = isAdmin || hasPermission(userPerms, "teachers.view")
  const canEditTeachers = isAdmin || hasPermission(userPerms, "teachers.edit")
  const canDeleteTeachers = isAdmin || hasPermission(userPerms, "teachers.delete")

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch("/api/teachers", { cache: "no-store" })
      if (res.status === 404) {
        setTeachers([])
        return
      }
      if (!res.ok) throw new Error(`Failed to load teachers (${res.status})`)
      const data = await res.json()
      setTeachers(data ?? [])
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  function remove(id: string) {
    const teacher = teachers.find((t) => t.id === id)
    deleteWithUndo({
      entityKey: "teacher",
      itemId: id,
      itemLabel: teacher?.name,
      removeFromUI: () => setTeachers((prev) => prev.filter((t) => t.id !== id)),
      restoreFn: () => teacher && setTeachers((prev) => [...prev, teacher]),
      deleteFn: async () => {
        const res = await fetch(`/api/teachers/${id}`, { method: "DELETE", credentials: "include" })
        if (!res.ok) throw new Error("Delete failed")
      },
      confirmPolicy: "dangerous",
      undoWindowMs: 10_000,
    })
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const visibleTeachers = teachers.filter((t) => (t.status || "").trim() !== "מתעניין")
    const s = q.trim().toLowerCase()
    if (!s) return visibleTeachers
    return visibleTeachers.filter((t) => 
      t.name.toLowerCase().includes(s) || 
      t.email?.toLowerCase().includes(s) ||
      t.phone?.includes(s) ||
      t.specialization?.toLowerCase().includes(s) ||
      t.city?.toLowerCase().includes(s)
    )
  }, [q, teachers])

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case "פעיל":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">פעיל</Badge>
      case "חופשה":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">חופשה</Badge>
      case "לא פעיל":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">לא פעיל</Badge>
      default:
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">פעיל</Badge>
    }
  }

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <PageHeader title="מורים" description="ניהול צוות ההוראה במרכז" />

        <div className="flex gap-2 items-center">
          {/* View Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <Button 
              variant={viewMode === "list" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === "grid" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {canEditTeachers && (
            <Link href="/dashboard/teachers/new">
              <Button className="gap-2 bg-primary">
                <Plus className="h-4 w-4" />
                מורה חדש
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חפש לפי שם, אימייל, טלפון, התמחות או עיר..."
            className="max-w-md text-right"
            dir="rtl"
          />
          <Button variant="outline" onClick={load} className="gap-2 bg-transparent">
            <RefreshCw className="h-4 w-4" />
            רענן
          </Button>
          <div className="text-sm text-muted-foreground mr-auto">
            סה״כ: {filtered.length} מורים
          </div>
        </div>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="text-muted-foreground text-center py-12">טוען...</div>
      ) : err ? (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="text-red-700 font-semibold">שגיאה</div>
          <div className="text-red-700/80 mt-1">{err}</div>
          <div className="mt-4">
            <Button variant="outline" onClick={load}>נסה שוב</Button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <div className="text-lg">אין מורים</div>
          {canEditTeachers && (
            <Link href="/dashboard/teachers/new">
              <Button className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                הוסף מורה ראשון
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className={viewMode === "grid" ? "grid md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
          {filtered.map((t) => (
            <Card key={t.id} className="p-5 space-y-4 hover:shadow-lg transition-shadow">
              {/* Header with status and avatar */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {t.profileImage ? (
                    <img src={t.profileImage} alt={t.name} className="w-12 h-12 rounded-full object-cover border" />
                  ) : (
                    <img src="/api/og-logo" alt="Center logo" className="w-12 h-12 rounded-full object-cover border" />
                  )}
                  <div className="text-right">
                    <h3 className="font-bold text-lg">{t.name}</h3>
                    {t.specialization && (
                      <p className="text-sm text-muted-foreground">{t.specialization}</p>
                    )}
                  </div>
                </div>
                {getStatusBadge(t.status)}
              </div>

              {/* Contact info */}
              <div className="space-y-2 text-sm">
                {t.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 text-green-500" />
                    <span dir="ltr">{t.phone}</span>
                  </div>
                )}

                {t.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <span dir="ltr">{t.email}</span>
                  </div>
                )}

                {t.city && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-purple-500" />
                    <span>{t.city}</span>
                  </div>
                )}
              </div>

              {/* Remaining balance to pay teacher */}
              <div className={`rounded-lg p-3 text-center ${
                (t.balance || 0) < 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-green-50 dark:bg-green-950/20"
              }`}>
                <div className="flex items-center justify-center gap-1 text-xs mb-1 text-muted-foreground">
                  <span className="font-bold">₪</span>
                  <span>{(t.balance || 0) < 0 ? "יתרה לתשלום" : "יתרת זכות"}</span>
                </div>
                <div className={`font-bold text-lg ${
                  (t.balance || 0) < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"
                }`}>
                  {Math.round(Math.abs(t.balance || 0)).toLocaleString()} ₪
                </div>
              </div>

              {/* Action buttons - צפה/עריכה/מחיקה לפי הרשאות */}
              <div className="flex gap-2 pt-2 border-t">
                {canDeleteTeachers && (
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 bg-transparent"
                    onClick={() => remove(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {canEditTeachers && (
                  <Link href={`/dashboard/teachers/${t.id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full gap-2 bg-transparent">
                      <Pencil className="h-4 w-4" />
                      ערוך
                    </Button>
                  </Link>
                )}
                {canViewTeachers && (
                  <Link href={`/dashboard/teachers/${t.id}`} className="flex-1">
                    <Button variant="outline" className="w-full gap-2 bg-transparent">
                      <Eye className="h-4 w-4" />
                      צפה
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
