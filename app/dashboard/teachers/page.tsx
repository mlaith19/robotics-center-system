"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Trash2,
  Pencil,
  Eye,
  Plus,
  RefreshCw,
  LayoutGrid,
  List,
  Mail,
  Phone,
  MapPin,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { deleteWithUndo } from "@/lib/notify"
import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, hasFullAccessRole } from "@/lib/permissions"
import { cn } from "@/lib/utils"

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
    return visibleTeachers.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        t.email?.toLowerCase().includes(s) ||
        t.phone?.includes(s) ||
        t.specialization?.toLowerCase().includes(s) ||
        t.city?.toLowerCase().includes(s),
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

  const balanceLabel = (t: Teacher) => ((t.balance || 0) < 0 ? "יתרה לתשלום" : "יתרת זכות")

  const renderTeacherCard = (t: Teacher) => (
    <Card key={t.id} className="space-y-4 p-4 transition-shadow hover:shadow-lg sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {t.profileImage ? (
            <img src={t.profileImage} alt={t.name} className="h-12 w-12 rounded-full border bg-white object-contain p-1" />
          ) : (
            <img src="/api/og-logo" alt="Center logo" className="h-12 w-12 rounded-full border bg-white object-contain p-1" />
          )}
          <div className="min-w-0 text-right">
            <h3 className="text-lg font-bold">{t.name}</h3>
            {t.specialization && <p className="text-sm text-muted-foreground">{t.specialization}</p>}
          </div>
        </div>
        {getStatusBadge(t.status)}
      </div>

      <div className="space-y-2 text-sm">
        {t.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0 text-green-500" />
            <span dir="ltr">{t.phone}</span>
          </div>
        )}
        {t.email && (
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0 text-blue-500" />
            <span className="break-all" dir="ltr">
              {t.email}
            </span>
          </div>
        )}
        {t.city && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-purple-500" />
            <span>{t.city}</span>
          </div>
        )}
      </div>

      <div
        className={cn(
          "rounded-lg p-3 text-center",
          (t.balance || 0) < 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-green-50 dark:bg-green-950/20",
        )}
      >
        <div className="mb-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span className="font-bold">₪</span>
          <span>{balanceLabel(t)}</span>
        </div>
        <div
          className={cn(
            "text-lg font-bold",
            (t.balance || 0) < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400",
          )}
        >
          {Math.round(Math.abs(t.balance || 0)).toLocaleString()} ₪
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-2">
        {canDeleteTeachers && (
          <Button
            variant="outline"
            size="icon"
            className="bg-transparent text-red-500 hover:bg-red-50 hover:text-red-700"
            onClick={() => remove(t.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {canEditTeachers && (
          <Link href={`/dashboard/teachers/${t.id}/edit`} className="min-w-0 flex-1">
            <Button variant="outline" className="w-full gap-2 bg-transparent">
              <Pencil className="h-4 w-4" />
              ערוך
            </Button>
          </Link>
        )}
        {canViewTeachers && (
          <Link href={`/dashboard/teachers/${t.id}`} className="min-w-0 flex-1">
            <Button variant="outline" className="w-full gap-2 bg-transparent">
              <Eye className="h-4 w-4" />
              צפה
            </Button>
          </Link>
        )}
      </div>
    </Card>
  )

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader title="מורים" description="ניהול צוות ההוראה במרכז" />

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <div className="flex overflow-hidden rounded-lg border">
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
            <Link href="/dashboard/teachers/new" className="w-full sm:w-auto">
              <Button className="w-full gap-2 bg-primary sm:w-auto">
                <Plus className="h-4 w-4" />
                מורה חדש
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חפש לפי שם, אימייל, טלפון, התמחות או עיר..."
            className="w-full min-w-0 text-right sm:max-w-md"
            dir="rtl"
          />
          <Button variant="outline" onClick={load} className="w-full gap-2 bg-transparent sm:w-auto">
            <RefreshCw className="h-4 w-4" />
            רענן
          </Button>
          <div className="w-full text-center text-sm text-muted-foreground sm:mr-auto sm:w-auto sm:text-right">
            סה״כ: {filtered.length} מורים
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">טוען...</div>
      ) : err ? (
        <Card className="border-red-200 bg-red-50 p-4 sm:p-6">
          <div className="font-semibold text-red-700">שגיאה</div>
          <div className="mt-1 text-red-700/80">{err}</div>
          <div className="mt-4">
            <Button variant="outline" onClick={load}>
              נסה שוב
            </Button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground sm:p-8">
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
      ) : viewMode === "list" ? (
        <>
          <div className="space-y-3 md:hidden">{filtered.map((t) => renderTeacherCard(t))}</div>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs sm:text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-right">
                    <th className="px-2 py-3 font-semibold sm:px-4">מורה</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">טלפון</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">התמחות</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">עיר</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">סטטוס</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">יתרה</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-2 py-3 sm:px-4">
                        <div className="flex items-center gap-2">
                          {t.profileImage ? (
                            <img src={t.profileImage} alt="" className="h-9 w-9 rounded-full border bg-white object-contain p-0.5" />
                          ) : (
                            <img src="/api/og-logo" alt="" className="h-9 w-9 rounded-full border bg-white object-contain p-0.5" />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold">{t.name}</div>
                            {t.email ? <div className="max-w-[10rem] truncate text-xs text-muted-foreground">{t.email}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 sm:px-4" dir="ltr">
                        {t.phone || "—"}
                      </td>
                      <td className="max-w-[8rem] px-2 py-3 break-words sm:px-4">{t.specialization || "—"}</td>
                      <td className="px-2 py-3 sm:px-4">{t.city || "—"}</td>
                      <td className="px-2 py-3 sm:px-4">{getStatusBadge(t.status)}</td>
                      <td className="px-2 py-3 text-left sm:px-4" dir="ltr">
                        {Math.round(Math.abs(t.balance || 0)).toLocaleString()} ₪
                      </td>
                      <td className="px-2 py-3 sm:px-4">
                        <div className="flex flex-wrap gap-2">
                          {canDeleteTeachers && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-transparent px-2 text-red-600 hover:bg-red-50"
                              onClick={() => remove(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canEditTeachers && (
                            <Link href={`/dashboard/teachers/${t.id}/edit`}>
                              <Button variant="outline" size="sm" className="bg-transparent">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                          {canViewTeachers && (
                            <Link href={`/dashboard/teachers/${t.id}`}>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((t) => renderTeacherCard(t))}</div>
      )}
    </div>
  )
}
