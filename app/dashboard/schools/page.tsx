"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Trash2, 
  Pencil, 
  Eye, 
  Plus, 
  School as SchoolIcon, 
  MapPin, 
  Phone, 
  Mail, 
  User,
  LayoutGrid,
  List
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { deleteWithUndo } from "@/lib/notify"
import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, sessionRolesGrantFullAccess } from "@/lib/permissions"

type School = {
  id: string
  name: string
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  contactPerson: string | null
  schoolType: string | null
  status: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    courses?: number
    students?: number
  }
}

const statusLabels: Record<string, string> = {
  active: "פעיל",
  inactive: "לא פעיל",
  interested: "מתעניין",
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-gray-100 text-gray-700 border-gray-200",
  interested: "bg-blue-100 text-blue-700 border-blue-200",
}

const schoolTypeLabels: Record<string, string> = {
  elementary: "יסודי",
  middle: "חטיבת ביניים",
  high: "תיכון",
  special: "חינוך מיוחד",
  other: "אחר",
}

export default function SchoolsPage() {
  const currentUser = useCurrentUser()
  const perms = currentUser?.permissions || []
  const isFullAccess = sessionRolesGrantFullAccess(currentUser?.roleKey, currentUser?.role)
  const canEditSchools = isFullAccess || hasPermission(perms, "schools.edit")
  const canDeleteSchools = isFullAccess || hasPermission(perms, "schools.delete")
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch("/api/schools", { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      const data = await res.json()
      setSchools(data ?? [])
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  function remove(id: string) {
    const school = schools.find((s) => s.id === id)
    deleteWithUndo({
      entityKey: "school",
      itemId: id,
      itemLabel: school?.name,
      removeFromUI: () => setSchools((prev) => prev.filter((s) => s.id !== id)),
      restoreFn: () => school && setSchools((prev) => [...prev, school]),
      deleteFn: async () => {
        const res = await fetch(`/api/schools/${id}`, { method: "DELETE", credentials: "include" })
        if (!res.ok) throw new Error("Delete failed")
      },
      confirmPolicy: "standard",
      undoWindowMs: 10_000,
    })
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return schools
    return schools.filter((x) => (x.name ?? "").toLowerCase().includes(s))
  }, [q, schools])

  const getFullAddress = (school: School) => {
    const parts = [school.address, school.city].filter(Boolean)
    return parts.length > 0 ? parts.join(", ") : null
  }

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <PageHeader title="בתי ספר" description="נהל את כל בתי הספר המשתפים פעולה" />
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
          {/* View Toggle */}
          <div className="flex shrink-0 overflow-hidden rounded-lg border">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {canEditSchools && (
            <Link href="/dashboard/schools/new" className="min-w-0 flex-1 sm:flex-none">
              <Button className="w-full gap-2 sm:w-auto">
                <Plus className="h-4 w-4 shrink-0" />
                בית ספר חדש
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חפש לפי שם בית ספר..."
          className="w-full sm:max-w-md"
        />
        <div className="shrink-0 text-sm text-muted-foreground">סה״כ: {filtered.length}</div>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-center py-12">טוען...</div>
      ) : err ? (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="text-red-700 font-semibold">שגיאה</div>
          <div className="text-red-700/80 mt-1">{err}</div>
          <div className="mt-4">
            <Button variant="outline" onClick={load}>
              נסה שוב
            </Button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <SchoolIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>אין בתי ספר</p>
        </Card>
      ) : viewMode === "list" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">שם בית הספר</TableHead>
                  <TableHead className="text-right">סוג</TableHead>
                  <TableHead className="text-right">עיר / כתובת</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                  <TableHead className="text-right">אימייל</TableHead>
                  <TableHead className="text-right">איש קשר</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-center">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.schoolType ? schoolTypeLabels[s.schoolType] || s.schoolType : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getFullAddress(s) || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {s.phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {s.email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.contactPerson || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${statusColors[s.status || "active"]}`}
                      >
                        {statusLabels[s.status || "active"] || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/dashboard/schools/${s.id}`}>
                          <Button variant="outline" size="sm" title="צפה">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {canEditSchools && (
                          <Link href={`/dashboard/schools/${s.id}/edit`}>
                            <Button variant="outline" size="sm" title="ערוך">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        {canDeleteSchools && (
                          <Button
                            variant="outline"
                            size="sm"
                            title="מחק"
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => remove(s.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((s) => (
            <Card key={s.id} className="space-y-4 p-4 sm:p-5">
              {/* Header with name and status */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-lg font-bold">{s.name}</h3>
                  {s.schoolType && (
                    <p className="text-sm text-muted-foreground">
                      {schoolTypeLabels[s.schoolType] || s.schoolType}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 ${statusColors[s.status || "active"]}`}
                >
                  {statusLabels[s.status || "active"] || s.status}
                </Badge>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 text-sm">
                {getFullAddress(s) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 break-words">{getFullAddress(s)}</span>
                  </div>
                )}
                {s.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span dir="ltr">{s.phone}</span>
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span dir="ltr">{s.email}</span>
                  </div>
                )}
                {s.contactPerson && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" />
                    <span>איש קשר: {s.contactPerson}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{s._count?.courses ?? 0}</div>
                  <div className="text-xs text-muted-foreground">קורסים</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{s._count?.students ?? 0}</div>
                  <div className="text-xs text-muted-foreground">תלמידים</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:flex-wrap">
                <Link href={`/dashboard/schools/${s.id}`} className="flex-1">
                  <Button variant="outline" className="gap-2 w-full bg-transparent">
                    <Eye className="h-4 w-4" />
                    צפה
                  </Button>
                </Link>

                {canEditSchools && (
                  <Link href={`/dashboard/schools/${s.id}/edit`} className="flex-1">
                    <Button variant="outline" className="gap-2 w-full bg-transparent">
                      <Pencil className="h-4 w-4" />
                      ערוך
                    </Button>
                  </Link>
                )}

                {canDeleteSchools && (
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground sm:w-auto sm:px-3 bg-transparent" 
                    onClick={() => remove(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    מחק
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
