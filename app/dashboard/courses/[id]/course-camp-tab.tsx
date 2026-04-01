"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Trash2, CalendarRange } from "lucide-react"

type TeacherOpt = { id: string; name: string }

type CampGroup = { id: string; label: string; sortOrder: number }
type CampRoom = { id: string; label: string; teacherId: string | null; sortOrder: number; teacherName?: string | null }
type CampSlot = { id: string; sortOrder: number; startTime: string; endTime: string }
type CampAssignment = {
  id: string
  slotSortOrder: number
  roomId: string
  groupId: string
  lessonTitle: string
}
type CampDay = { id: string; sessionDate: string; assignments: CampAssignment[] }

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function CourseCampTab(props: { courseId: string; teachers: TeacherOpt[]; canEdit: boolean }) {
  const { courseId, teachers, canEdit } = props
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [groups, setGroups] = useState<CampGroup[]>([])
  const [rooms, setRooms] = useState<CampRoom[]>([])
  const [slots, setSlots] = useState<CampSlot[]>([])
  const [days, setDays] = useState<CampDay[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/camp`)
      if (res.status === 403) {
        setErr("אין הרשאה לצפות בטאב קייטנה")
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(String(j.error || "שגיאת טעינה"))
        return
      }
      const data = await res.json()
      setGroups(Array.isArray(data.groups) ? data.groups : [])
      setRooms(Array.isArray(data.rooms) ? data.rooms : [])
      setSlots(Array.isArray(data.slots) ? data.slots : [])
      setDays(Array.isArray(data.days) ? data.days : [])
    } catch {
      setErr("שגיאת רשת")
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  const sortedSlots = [...slots].sort((a, b) => a.sortOrder - b.sortOrder || a.startTime.localeCompare(b.startTime))
  const sortedRooms = [...rooms].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/camp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups, rooms, slots, days }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(String(j.error || "שמירה נכשלה"))
        return
      }
      await load()
    } catch {
      setErr("שגיאת רשת בשמירה")
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateDays() {
    if (!canEdit) return
    setGenLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/camp/generate-days`, { method: "POST" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(String(j.error || "יצירת ימים נכשלה"))
        return
      }
      await load()
    } catch {
      setErr("שגיאת רשת")
    } finally {
      setGenLoading(false)
    }
  }

  function assignmentFor(day: CampDay, slotSort: number, roomId: string): CampAssignment {
    const found = day.assignments.find((a) => a.slotSortOrder === slotSort && a.roomId === roomId)
    if (found) return found
    return { id: newId(), slotSortOrder: slotSort, roomId, groupId: "", lessonTitle: "" }
  }

  function patchAssignment(dayId: string, slotSort: number, roomId: string, patch: Partial<CampAssignment>) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d
        const next = [...d.assignments]
        const idx = next.findIndex((a) => a.slotSortOrder === slotSort && a.roomId === roomId)
        const base = idx >= 0 ? { ...next[idx] } : { id: newId(), slotSortOrder: slotSort, roomId, groupId: "", lessonTitle: "" }
        const merged = { ...base, ...patch }
        if (idx >= 0) next[idx] = merged
        else next.push(merged)
        return { ...d, assignments: next }
      }),
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      {err && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <CalendarRange className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-lg">מבנה קייטנה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            הגדירו קבוצות (א׳, ב׳…), כיתות עם מורה, משבצות שעות, ואז ימי פעילות. בכל יום ובכל צירוף משבצת×כיתה בוחרים קבוצה ושם שיעור — השם יופיע בלוח הזמנים של התלמידים, המורים והאדמין.
          </p>

          <div className="space-y-3">
            <div className="font-medium">קבוצות</div>
            {groups.map((g, i) => (
              <div key={g.id} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1">
                  <Label className="text-xs text-muted-foreground">שם קבוצה</Label>
                  <Input
                    value={g.label}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const v = e.target.value
                      setGroups((prev) => prev.map((x, j) => (j === i ? { ...x, label: v } : x)))
                    }}
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs text-muted-foreground">סדר</Label>
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={g.sortOrder}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setGroups((prev) => prev.map((x, j) => (j === i ? { ...x, sortOrder: n } : x)))
                    }}
                  />
                </div>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setGroups((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {canEdit && (
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setGroups((p) => [...p, { id: newId(), label: "", sortOrder: p.length }])}>
                <Plus className="h-4 w-4" />
                הוסף קבוצה
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div className="font-medium">כיתות / חדרים</div>
            {rooms.map((r, i) => (
              <div key={r.id} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1">
                  <Label className="text-xs text-muted-foreground">שם כיתה</Label>
                  <Input
                    value={r.label}
                    disabled={!canEdit}
                    onChange={(e) => setRooms((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  />
                </div>
                <div className="min-w-[180px] flex-1">
                  <Label className="text-xs text-muted-foreground">מורה בכיתה</Label>
                  <Select
                    disabled={!canEdit}
                    value={r.teacherId || "__none__"}
                    onValueChange={(v) =>
                      setRooms((prev) => prev.map((x, j) => (j === i ? { ...x, teacherId: v === "__none__" ? null : v } : x)))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="ללא" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">ללא</SelectItem>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label className="text-xs text-muted-foreground">סדר</Label>
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={r.sortOrder}
                    onChange={(e) => setRooms((prev) => prev.map((x, j) => (j === i ? { ...x, sortOrder: Number(e.target.value) } : x)))}
                  />
                </div>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setRooms((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {canEdit && (
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setRooms((p) => [...p, { id: newId(), label: "", teacherId: null, sortOrder: p.length }])}>
                <Plus className="h-4 w-4" />
                הוסף כיתה
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div className="font-medium">משבצות שעות</div>
            {slots.map((s, i) => (
              <div key={s.id} className="flex flex-wrap items-end gap-2">
                <div className="w-24">
                  <Label className="text-xs text-muted-foreground">סדר</Label>
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={s.sortOrder}
                    onChange={(e) => setSlots((prev) => prev.map((x, j) => (j === i ? { ...x, sortOrder: Number(e.target.value) } : x)))}
                  />
                </div>
                <div className="w-32">
                  <Label className="text-xs text-muted-foreground">התחלה</Label>
                  <Input
                    type="time"
                    disabled={!canEdit}
                    value={s.startTime?.length === 5 ? s.startTime : s.startTime?.slice(0, 5) || ""}
                    onChange={(e) => setSlots((prev) => prev.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))}
                  />
                </div>
                <div className="w-32">
                  <Label className="text-xs text-muted-foreground">סיום</Label>
                  <Input
                    type="time"
                    disabled={!canEdit}
                    value={s.endTime?.length === 5 ? s.endTime : s.endTime?.slice(0, 5) || ""}
                    onChange={(e) => setSlots((prev) => prev.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))}
                  />
                </div>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setSlots((p) => [...p, { id: newId(), sortOrder: p.length, startTime: "09:00", endTime: "10:00" }])}
              >
                <Plus className="h-4 w-4" />
                הוסף משבצת
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button type="button" variant="secondary" onClick={handleGenerateDays} disabled={genLoading}>
                {genLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                צור ימים מתאריכי הקורס
              </Button>
            )}
            {canEdit && (
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                שמור מבנה
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {days.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">אין עדיין ימי קייטנה. לחצו על «צור ימים מתאריכי הקורס» אחרי הגדרת ימי השבוע בקורס.</CardContent>
        </Card>
      ) : (
        days
          .slice()
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
          .map((day) => (
            <Card key={day.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  יום {day.sessionDate}
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mr-2 text-destructive"
                      onClick={() => setDays((prev) => prev.filter((d) => d.id !== day.id))}
                    >
                      הסר יום
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border p-2 text-right bg-muted/40">משבצת</th>
                      {sortedRooms.map((room) => (
                        <th key={room.id} className="border p-2 text-right bg-muted/40 min-w-[140px]">
                          {room.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSlots.map((slot) => (
                      <tr key={slot.id}>
                        <td className="border p-2 whitespace-nowrap">
                          {slot.startTime} – {slot.endTime}
                        </td>
                        {sortedRooms.map((room) => {
                          const a = assignmentFor(day, slot.sortOrder, room.id)
                          return (
                            <td key={room.id} className="border p-2 align-top">
                              <div className="space-y-2">
                                <Select
                                  disabled={!canEdit || groups.length === 0}
                                  value={a.groupId || "__empty__"}
                                  onValueChange={(v) => patchAssignment(day.id, slot.sortOrder, room.id, { groupId: v === "__empty__" ? "" : v })}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="קבוצה" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__empty__">—</SelectItem>
                                    {groups.map((g) => (
                                      <SelectItem key={g.id} value={g.id}>
                                        {g.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  placeholder="שם שיעור"
                                  disabled={!canEdit}
                                  value={a.lessonTitle}
                                  onChange={(e) => patchAssignment(day.id, slot.sortOrder, room.id, { lessonTitle: e.target.value })}
                                />
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))
      )}

      {canEdit && days.length > 0 && (
        <Button type="button" variant="default" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          שמור הכל
        </Button>
      )}
    </div>
  )
}
