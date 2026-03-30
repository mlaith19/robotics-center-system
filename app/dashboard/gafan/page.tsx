"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { Plus, Mail, Phone, LayoutGrid, List, MapPin, Eye, Edit, Users, Trash2, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import useSWR, { mutate } from "swr"
import { arrayFetcher } from "@/lib/swr-fetcher"
import { hasPermission } from "@/lib/permissions"
import { deleteWithUndo } from "@/lib/notify"

interface GafanProgram {
  id: string
  name: string
  programNumber: string
  validYear: number
  companyName: string
  companyId: string
  companyAddress: string
  bankName: string | null
  bankCode: string | null
  branchNumber: string | null
  accountNumber: string | null
  operatorName: string
  priceMin: number
  priceMax: number | null
  status: string
  notes: string | null
  schoolId: string | null
  createdAt: string
}

export default function GafanProgramsPage() {
  const { data: rawPrograms, error, isLoading } = useSWR<GafanProgram[]>("/api/gafan", arrayFetcher)
  const programs = Array.isArray(rawPrograms) ? rawPrograms : []
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [canDelete, setCanDelete] = useState(false)
  useEffect(() => {
    setCanDelete(hasPermission("gafan-delete"))
  }, [])

  const handleDelete = (program: GafanProgram) => {
    deleteWithUndo({
      entityKey: "gafan",
      itemId: program.id,
      itemLabel: program.name,
      removeFromUI: () =>
        mutate("/api/gafan", programs.filter((p) => p.id !== program.id), false),
      restoreFn: () => mutate("/api/gafan"),
      deleteFn: async () => {
        const res = await fetch(`/api/gafan/${program.id}`, { method: "DELETE", credentials: "include" })
        if (!res.ok) throw new Error("Delete failed")
        mutate("/api/gafan")
      },
      confirmPolicy: "standard",
      undoWindowMs: 10_000,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12" dir="rtl">
        <p className="text-destructive">שגיאה בטעינת הנתונים</p>
      </div>
    )
  }

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <PageHeader title="תוכניות גפ&quot;ן" description="נהל את כל תוכניות גפ&quot;ן המשתפות פעולה" />
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 p-0"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button asChild className="gap-2">
            <Link href="/dashboard/gafan/new">
              <Plus className="h-4 w-4" />
              תוכנית גפ"ן חדשה
            </Link>
          </Button>
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">אין תוכניות גפ"ן במערכת</p>
          <Button asChild>
            <Link href="/dashboard/gafan/new">
              <Plus className="h-4 w-4 ml-2" />
              הוסף תוכנית גפ"ן ראשונה
            </Link>
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground mb-1">{program.name}</h3>
                    <p className="text-sm text-muted-foreground">מס׳ תוכנית: {program.programNumber}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap mr-2 ${
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

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{program.companyAddress || "לא צוינה כתובת"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>מפעיל: {program.operatorName}</span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <div className="font-semibold text-foreground">₪{program.priceMin || 0}</div>
                      <div className="text-muted-foreground">מחיר מינימום</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <div className="font-semibold text-foreground">{program.validYear || "-"}</div>
                      <div className="text-muted-foreground">תוקף לשנה</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Link href={`/dashboard/gafan/${program.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                      <Eye className="h-4 w-4" />
                      צפה
                    </Button>
                  </Link>
                  <Link href={`/dashboard/gafan/${program.id}/edit`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                      <Edit className="h-4 w-4" />
                      ערוך
                    </Button>
                  </Link>
                  {canDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 bg-transparent text-destructive hover:text-destructive"
                      onClick={() => handleDelete(program)}
                    >
                      <Trash2 className="h-4 w-4" />
                      מחק
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    שם התוכנית
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    מס׳ תוכנית
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    חברה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    מפעיל
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    מחיר
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    תוקף
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    סטטוס
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {programs.map((program) => (
                  <tr key={program.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">{program.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-muted-foreground">{program.programNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-muted-foreground">{program.companyName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-muted-foreground">{program.operatorName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-center font-semibold text-primary">₪{program.priceMin || 0}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-muted-foreground">{program.validYear || "-"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          program.status === "פעיל"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : program.status === "מתעניין"
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {program.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Link href={`/dashboard/gafan/${program.id}`}>
                          <Button variant="ghost" size="sm" className="gap-2">
                            <Eye className="h-4 w-4" />
                            צפה
                          </Button>
                        </Link>
                        <Link href={`/dashboard/gafan/${program.id}/edit`}>
                          <Button variant="ghost" size="sm" className="gap-2">
                            <Edit className="h-4 w-4" />
                            ערוך
                          </Button>
                        </Link>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(program)}
                          >
                            <Trash2 className="h-4 w-4" />
                            מחק
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
