"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LayoutGrid, List, Eye, Edit, Trash2, Plus } from "lucide-react"
import { deleteWithUndo } from "@/lib/notify"

type Id = string

export type EntityListProps<T extends { id: Id }> = {
  title: string
  subtitle?: string

  basePath: string // לדוגמה: "/dashboard/students"
  apiBase: string  // לדוגמה: "/api/students"

  canDelete?: boolean

  // איך להציג כרטיס/שורה
  getTitle: (row: T) => string
  getSubtitle?: (row: T) => string

  // תצוגה בכרטיסים (רשת)
  renderGridMeta?: (row: T) => React.ReactNode

  // תצוגה בטבלה (רשימה)
  columns?: Array<{
    header: string
    cell: (row: T) => React.ReactNode
    className?: string
  }>
}

export function EntityList<T extends { id: Id }>(props: EntityListProps<T>) {
  const {
    title,
    subtitle,
    basePath,
    apiBase,
    canDelete = false,
    getTitle,
    getSubtitle,
    renderGridMeta,
    columns = [],
  } = props

  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(apiBase, { cache: "no-store" })
        if (!res.ok) throw new Error(`Failed to load (${res.status})`)
        const data = (await res.json()) as T[]
        if (!cancelled) setRows(Array.isArray(data) ? data : [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "שגיאה בטעינה")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiBase])

  const hasRows = useMemo(() => rows.length > 0, [rows.length])

  const handleDelete = (row: T) => {
    deleteWithUndo({
      entityKey: basePath,
      itemId: row.id,
      itemLabel: getTitle(row),
      removeFromUI: () => setRows((prev) => prev.filter((x) => x.id !== row.id)),
      restoreFn: () => setRows((prev) => [...prev, row]),
      deleteFn: async () => {
        const res = await fetch(`${apiBase}/${row.id}`, { method: "DELETE", credentials: "include" })
        if (!res.ok) throw new Error("Failed to delete")
      },
      confirmPolicy: "standard",
      undoWindowMs: 10_000,
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {subtitle ? <p className="text-muted-foreground mt-2">{subtitle}</p> : null}
        </div>

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
            <Link href={`${basePath}/new`}>
              <Plus className="h-4 w-4" />
              חדש
            </Link>
          </Button>
        </div>
      </div>

      {loading && <div className="border rounded-lg p-6 text-muted-foreground">טוען...</div>}

      {!loading && error && (
        <div className="border rounded-lg p-6">
          <div className="font-medium text-red-600">שגיאה</div>
          <div className="text-sm text-muted-foreground mt-1">{error}</div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => window.location.reload()} className="bg-transparent">
              נסה שוב
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && !hasRows && (
        <div className="border rounded-lg p-10 text-center">
          <div className="text-lg font-semibold">אין נתונים עדיין</div>
          <div className="text-muted-foreground mt-2">לחץ על "חדש" כדי להוסיף</div>
          <div className="mt-6">
            <Button asChild className="gap-2">
              <Link href={`${basePath}/new`}>
                <Plus className="h-4 w-4" />
                חדש
              </Link>
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && hasRows && viewMode === "grid" && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground mb-1">{getTitle(row)}</h3>
                    <p className="text-sm text-muted-foreground">{getSubtitle ? getSubtitle(row) : "—"}</p>
                  </div>
                </div>

                {renderGridMeta ? <div className="text-sm">{renderGridMeta(row)}</div> : null}

                <div className="flex gap-2 pt-2">
                  <Link href={`${basePath}/${row.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                      <Eye className="h-4 w-4" />
                      צפה
                    </Button>
                  </Link>
                  <Link href={`${basePath}/${row.id}/edit`} className="flex-1">
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
                      onClick={() => handleDelete(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && hasRows && viewMode === "list" && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  {columns.map((c, i) => (
                    <th
                      key={i}
                      className={`px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider ${c.className ?? ""}`}
                    >
                      {c.header}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>

              <tbody className="bg-card divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                    {columns.map((c, i) => (
                      <td key={i} className="px-6 py-4 whitespace-nowrap">
                        {c.cell(row)}
                      </td>
                    ))}

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Link href={`${basePath}/${row.id}`}>
                          <Button variant="ghost" size="sm" className="gap-2">
                            <Eye className="h-4 w-4" />
                            צפה
                          </Button>
                        </Link>
                        <Link href={`${basePath}/${row.id}/edit`}>
                          <Button variant="ghost" size="sm" className="gap-2">
                            <Edit className="h-4 w-4" />
                            ערוך
                          </Button>
                        </Link>
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2 text-destructive hover:text-destructive"
                                disabled={deletingId === row.id}
                              >
                                <Trash2 className="h-4 w-4" />
                                מחק
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                                <AlertDialogDescription>פעולה זו תמחק לצמיתות. לא ניתן לשחזר.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(row)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  מחק
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
