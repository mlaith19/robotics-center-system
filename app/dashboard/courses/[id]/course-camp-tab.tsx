"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus, Trash2, CalendarRange } from "lucide-react"

type TeacherOpt = { id: string; name: string }
type CampSlot = { id: string; sortOrder: number; startTime: string; endTime: string }
type CampAssignment = { id: string; slotSortOrder: number; classroomNo: number; lessonTitle: string; groupLabels: string[]; teacherIds: string[] }
type CampDay = { id: string; sessionDate: string; assignments: CampAssignment[] }

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function CourseCampTab(props: { courseId: string; canEdit: boolean }) {
  const { courseId, canEdit } = props
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<TeacherOpt[]>([])
  const [groupLetters, setGroupLetters] = useState<string[]>([])
  const [classroomsCount, setClassroomsCount] = useState(6)
  const [slots, setSlots] = useState<CampSlot[]>([])
  const [days, setDays] = useState<CampDay[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/camp`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(String(j.error || "שגיאת טעינה"))
        return
      }
      const data = await res.json()
      setTeachers(Array.isArray(data.teachers) ? data.teachers : [])
      setGroupLetters(Array.isArray(data.groupLetters) ? data.groupLetters : [])
      setClassroomsCount(Number(data.classroomsCount || 6))
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
  const classrooms = Array.from({ length: Math.max(1, classroomsCount) }, (_, i) => i + 1)

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/camp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, days }),
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

  function assignmentFor(day: CampDay, slotSort: number, classroomNo: number): CampAssignment {
    return day.assignments.find((a) => a.slotSortOrder === slotSort && a.classroomNo === classroomNo)
      || { id: newId(), slotSortOrder: slotSort, classroomNo, lessonTitle: "", groupLabels: [], teacherIds: [] }
  }

  function patchAssignment(dayId: string, slotSort: number, classroomNo: number, patch: Partial<CampAssignment>) {
    setDays((prev) => prev.map((d) => {
      if (d.id !== dayId) return d
      const next = [...d.assignments]
      const idx = next.findIndex((a) => a.slotSortOrder === slotSort && a.classroomNo === classroomNo)
      const base = idx >= 0 ? { ...next[idx] } : assignmentFor(d, slotSort, classroomNo)
      const merged = { ...base, ...patch }
      if (idx >= 0) next[idx] = merged
      else next.push(merged)
      return { ...d, assignments: next }
    }))
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-6" dir="rtl">
      {err && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <CalendarRange className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-lg">מבנה קייטנה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">עמודות הטבלה הן כיתה 1..{classroomsCount} לפי הגדרת מרכז.</div>
          {slots.map((s, i) => (
            <div key={s.id} className="flex flex-wrap items-end gap-2">
              <Input type="number" className="w-20" disabled={!canEdit} value={s.sortOrder} onChange={(e) => setSlots((p) => p.map((x, j) => j === i ? { ...x, sortOrder: Number(e.target.value) } : x))} />
              <Input type="time" className="w-32" disabled={!canEdit} value={String(s.startTime || "").slice(0, 5)} onChange={(e) => setSlots((p) => p.map((x, j) => j === i ? { ...x, startTime: e.target.value } : x))} />
              <Input type="time" className="w-32" disabled={!canEdit} value={String(s.endTime || "").slice(0, 5)} onChange={(e) => setSlots((p) => p.map((x, j) => j === i ? { ...x, endTime: e.target.value } : x))} />
              {canEdit && <Button type="button" variant="ghost" size="icon" onClick={() => setSlots((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            </div>
          ))}
          {canEdit && <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setSlots((p) => [...p, { id: newId(), sortOrder: p.length, startTime: "08:30", endTime: "09:00" }])}><Plus className="h-4 w-4" />הוסף משבצת</Button>}
          <div className="flex gap-2">
            {canEdit && <Button type="button" variant="secondary" onClick={handleGenerateDays} disabled={genLoading}>{genLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}צור ימים מתאריכי הקורס</Button>}
            {canEdit && <Button type="button" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}שמור מבנה</Button>}
          </div>
        </CardContent>
      </Card>

      {days.slice().sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)).map((day) => (
        <Card key={day.id}>
          <CardHeader className="pb-2"><CardTitle className="text-base">יום {day.sessionDate}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead><tr><th className="border p-2 bg-muted/40 text-right">שעה</th>{classrooms.map((c) => <th key={c} className="border p-2 bg-muted/40 text-right">כיתה {c}</th>)}</tr></thead>
              <tbody>
                {sortedSlots.map((slot) => (
                  <tr key={slot.id}>
                    <td className="border p-2 align-top whitespace-nowrap">{slot.startTime} - {slot.endTime}</td>
                    {classrooms.map((classNo) => {
                      const a = assignmentFor(day, slot.sortOrder, classNo)
                      return (
                        <td key={classNo} className="border p-2 align-top">
                          <div className="space-y-2">
                            <Input placeholder="שם שיעור" value={a.lessonTitle} disabled={!canEdit} onChange={(e) => patchAssignment(day.id, slot.sortOrder, classNo, { lessonTitle: e.target.value })} />
                            <div className="grid grid-cols-6 gap-1">
                              {groupLetters.map((g) => (
                                <label key={g} className="flex items-center gap-1 text-xs">
                                  <Checkbox
                                    checked={a.groupLabels.includes(g)}
                                    disabled={!canEdit}
                                    onCheckedChange={(v) => {
                                      const next = v ? [...new Set([...a.groupLabels, g])] : a.groupLabels.filter((x) => x !== g)
                                      patchAssignment(day.id, slot.sortOrder, classNo, { groupLabels: next })
                                    }}
                                  />
                                  {g}
                                </label>
                              ))}
                            </div>
                            <div className="space-y-1">
                              {teachers.map((t) => (
                                <label key={t.id} className="flex items-center gap-1 text-xs">
                                  <Checkbox
                                    checked={a.teacherIds.includes(t.id)}
                                    disabled={!canEdit}
                                    onCheckedChange={(v) => {
                                      const next = v ? [...new Set([...a.teacherIds, t.id])] : a.teacherIds.filter((x) => x !== t.id)
                                      patchAssignment(day.id, slot.sortOrder, classNo, { teacherIds: next })
                                    }}
                                  />
                                  {t.name}
                                </label>
                              ))}
                            </div>
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
      ))}
    </div>
  )
}
