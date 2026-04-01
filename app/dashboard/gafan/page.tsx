"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { Plus, LayoutGrid, List, MapPin, Eye, Edit, Users, Trash2, Loader2 } from "lucide-react"
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
      <div className="flex min-h-[400px] items-center justify-center p-3" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-3 py-12 text-center" dir="rtl">
        <p className="text-destructive">שגיאה בטעינת הנתונים</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-3 sm:space-y-8 sm:p-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <PageHeader title="תוכניות גפ&quot;ן" description="נהל את כל תוכניות גפ&quot;ן המשתפות פעולה" />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="flex items-center rounded-lg border p-1">
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
          <Button asChild className="min-w-0 flex-1 gap-2 sm:flex-none">
            <Link href="/dashboard/gafan/new" className="flex w-full items-center justify-center gap-2 sm:w-auto">
              <Plus className="h-4 w-4 shrink-0" />
              תוכנית גפ"ן חדשה
            </Link>
          </Button>
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="mb-4 text-muted-foreground">אין תוכניות גפ"ן במערכת</p>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/gafan/new" className="gap-2">
              <Plus className="h-4 w-4 shrink-0" />
              הוסף תוכנית גפ"ן ראשונה
            </Link>
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id} className="overflow-hidden transition-shadow hover:shadow-lg">
              <div className="space-y-4 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 break-words text-lg font-semibold text-foreground">{program.name}</h3>
                    <p className="text-sm text-muted-foreground">מס׳ תוכנית: {program.programNumber}</p>
                  </div>
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
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
                    <span className="min-w-0 truncate">{program.companyAddress || "לא צוינה כתובת"}</span>
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

                <div className="flex flex-wrap gap-2 pt-2">
                  <Link href={`/dashboard/gafan/${program.id}`} className="min-w-0 flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                      <Eye className="h-4 w-4 shrink-0" />
                      צפה
                    </Button>
                  </Link>
                  <Link href={`/dashboard/gafan/${program.id}/edit`} className="min-w-0 flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                      <Edit className="h-4 w-4 shrink-0" />
                      ערוך
                    </Button>
                  </Link>
                  {canDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 bg-transparent text-destructive hover:text-destructive sm:w-auto"
                      onClick={() => handleDelete(program)}
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      מחק
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                    שם התוכנית
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                    מס׳ תוכנית
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                    חברה
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                    מפעיל
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                    מחיר
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                    תוקף
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                    סטטוס
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {programs.map((program) => (
                  <tr key={program.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-3 py-4 align-top sm:px-6">
                      <div className="max-w-[200px] break-words text-sm font-medium text-foreground sm:max-w-none">
                        {program.name}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 sm:px-6">
                      <div className="text-sm text-muted-foreground">{program.programNumber}</div>
                    </td>
                    <td className="px-3 py-4 align-top sm:px-6">
                      <div className="max-w-[160px] break-words text-sm text-muted-foreground sm:max-w-none">
                        {program.companyName}
                      </div>
                    </td>
                    <td className="px-3 py-4 align-top sm:px-6">
                      <div className="max-w-[140px] break-words text-sm text-muted-foreground sm:max-w-none">
                        {program.operatorName}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-center sm:px-6">
                      <div className="text-sm font-semibold text-primary">₪{program.priceMin || 0}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 sm:px-6">
                      <div className="text-sm text-muted-foreground">{program.validYear || "-"}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 sm:px-6">
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
                    <td className="px-3 py-4 sm:px-6">
                      <div className="flex flex-wrap gap-1">
                        <Link href={`/dashboard/gafan/${program.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Eye className="h-4 w-4 shrink-0" />
                            צפה
                          </Button>
                        </Link>
                        <Link href={`/dashboard/gafan/${program.id}/edit`}>
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Edit className="h-4 w-4 shrink-0" />
                            ערוך
                          </Button>
                        </Link>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(program)}
                          >
                            <Trash2 className="h-4 w-4 shrink-0" />
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
