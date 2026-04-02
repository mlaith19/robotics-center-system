"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Plus, Trash2, CalendarRange } from "lucide-react"

type TeacherOpt = { id: string; name: string }
type ClassroomDef = { number: number; name: string; notes?: string }
type CampMeetingCell = { id: string; classroomNo: number; lessonTitle: string; groupLabels: string[]; teacherIds: string[] }
type CampMeetingSlot = {
  id: string
  sortOrder: number
  startTime: string
  endTime: string
  isBreak: boolean
  breakTitle: string
  cells: CampMeetingCell[]
}
type CampMeeting = { id: string; sessionDate: string; sortOrder: number; slots: CampMeetingSlot[] }

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function hebrewWeekday(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`)
  const names = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
  return names[d.getDay()] || ""
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
  const [classroomsDef, setClassroomsDef] = useState<ClassroomDef[]>([])
  const [meetings, setMeetings] = useState<CampMeeting[]>([])
  const [activeMeetingId, setActiveMeetingId] = useState("")

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
      setClassroomsDef(Array.isArray(data.classrooms) ? data.classrooms : [])
      setMeetings(Array.isArray(data.meetings) ? data.meetings : [])
    } catch {
      setErr("שגיאת רשת")
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (!activeMeetingId && meetings.length > 0) setActiveMeetingId(meetings[0].id)
    if (activeMeetingId && !meetings.some((d) => d.id === activeMeetingId)) {
      setActiveMeetingId(meetings[0]?.id || "")
    }
  }, [meetings, activeMeetingId])

  const classrooms = Array.from({ length: Math.max(1, classroomsCount) }, (_, i) => i + 1).map((n) => ({
    number: n,
    name: (classroomsDef.find((c) => Number(c.number) === n)?.name || `כיתה ${n}`),
  }))

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/camp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetings }),
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

  function cellFor(slot: CampMeetingSlot, classroomNo: number): CampMeetingCell {
    return slot.cells.find((c) => c.classroomNo === classroomNo)
      || { id: newId(), classroomNo, lessonTitle: "", groupLabels: [], teacherIds: [] }
  }

  function patchCell(meetingId: string, slotId: string, classroomNo: number, patch: Partial<CampMeetingCell>) {
    setMeetings((prev) => prev.map((m) => {
      if (m.id !== meetingId) return m
      return {
        ...m,
        slots: m.slots.map((s) => {
          if (s.id !== slotId) return s
          const idx = s.cells.findIndex((c) => c.classroomNo === classroomNo)
          const base = idx >= 0 ? { ...s.cells[idx] } : cellFor(s, classroomNo)
          const merged = { ...base, ...patch }
          if (idx >= 0) {
            const next = [...s.cells]
            next[idx] = merged
            return { ...s, cells: next }
          }
          return { ...s, cells: [...s.cells, merged] }
        }),
      }
    }))
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  const sortedMeetings = [...meetings].sort((a, b) => a.sortOrder - b.sortOrder || a.sessionDate.localeCompare(b.sessionDate))

  return (
    <div className="space-y-6" dir="rtl">
      {err && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <CalendarRange className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-lg">מבנה קייטנה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">עמודות הטבלה הן כיתה 1..{classroomsCount} לפי הגדרת מרכז. משבצות זמן מוגדרות לכל מפגש בנפרד.</div>
          <div className="flex gap-2">
            {canEdit && <Button type="button" variant="secondary" onClick={handleGenerateDays} disabled={genLoading}>{genLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}צור ימים מתאריכי הקורס</Button>}
            {canEdit && <Button type="button" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}שמור מבנה</Button>}
          </div>
        </CardContent>
      </Card>

      {sortedMeetings.length > 0 && (
        <Tabs value={activeMeetingId} onValueChange={setActiveMeetingId} className="w-full">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            {sortedMeetings.map((meeting, i) => (
              <TabsTrigger key={meeting.id} value={meeting.id}>
                מפגש {i + 1} - {hebrewWeekday(meeting.sessionDate)}
              </TabsTrigger>
            ))}
          </TabsList>
          {sortedMeetings.map((meeting, i) => {
            const sortedSlots = [...meeting.slots].sort((a, b) => a.sortOrder - b.sortOrder || a.startTime.localeCompare(b.startTime))
            return (
            <TabsContent key={meeting.id} value={meeting.id}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">מפגש {i + 1} - {hebrewWeekday(meeting.sessionDate)} ({meeting.sessionDate})</CardTitle>
                  {canEdit && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() =>
                          setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : {
                            ...m,
                            slots: [...m.slots, { id: newId(), sortOrder: m.slots.length + 1, startTime: "08:30", endTime: "09:15", isBreak: false, breakTitle: "", cells: [] }],
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                        הוסף משבצת למפגש
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead><tr><th className="border p-2 bg-muted/40 text-right">שעה</th>{classrooms.map((c) => <th key={c.number} className="border p-2 bg-muted/40 text-right">{c.name}</th>)}</tr></thead>
                    <tbody>
                      {sortedSlots.map((slot) => (
                        slot.isBreak ? (
                          <tr key={slot.id} className="bg-amber-100/70">
                            <td className="border p-2 font-medium whitespace-nowrap">{slot.startTime} - {slot.endTime}</td>
                            <td className="border p-2 font-medium text-amber-900" colSpan={classrooms.length}>
                              {slot.breakTitle?.trim() || "הפסקה"}
                            </td>
                          </tr>
                        ) : (
                          <tr key={slot.id}>
                            <td className="border p-2 align-top whitespace-nowrap">
                              <div className="space-y-2">
                                <div>{slot.startTime} - {slot.endTime}</div>
                                {canEdit && (
                                  <div className="space-y-2">
                                    <Input type="number" value={slot.sortOrder} onChange={(e) => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.map((x) => x.id !== slot.id ? x : { ...x, sortOrder: Number(e.target.value || 0) }) }))} />
                                    <Input type="time" value={String(slot.startTime || "").slice(0, 5)} onChange={(e) => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.map((x) => x.id !== slot.id ? x : { ...x, startTime: e.target.value }) }))} />
                                    <Input type="time" value={String(slot.endTime || "").slice(0, 5)} onChange={(e) => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.map((x) => x.id !== slot.id ? x : { ...x, endTime: e.target.value }) }))} />
                                    <label className="flex items-center gap-2 text-xs">
                                      <Checkbox checked={slot.isBreak} onCheckedChange={(v) => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.map((x) => x.id !== slot.id ? x : { ...x, isBreak: Boolean(v) }) }))} />
                                      משבצת הפסקה
                                    </label>
                                    {slot.isBreak && (
                                      <Input placeholder="כותרת הפסקה" value={slot.breakTitle || ""} onChange={(e) => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.map((x) => x.id !== slot.id ? x : { ...x, breakTitle: e.target.value }) }))} />
                                    )}
                                    <Button type="button" variant="ghost" size="icon" onClick={() => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.filter((x) => x.id !== slot.id) }))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                  </div>
                                )}
                              </div>
                            </td>
                            {classrooms.map((classroom) => {
                              const classNo = classroom.number
                              const a = cellFor(slot, classNo)
                              return (
                                <td key={classroom.number} className="border p-2 align-top">
                                  <div className="space-y-2">
                                    <Input placeholder="שם שיעור" value={a.lessonTitle} disabled={!canEdit} onChange={(e) => patchCell(meeting.id, slot.id, classNo, { lessonTitle: e.target.value })} />
                                    <div className="grid grid-cols-6 gap-1">
                                      {groupLetters.map((g) => (
                                        <label key={g} className="flex items-center gap-1 text-xs">
                                          <Checkbox
                                            checked={a.groupLabels.includes(g)}
                                            disabled={!canEdit}
                                            onCheckedChange={(v) => {
                                              const next = v ? [...new Set([...a.groupLabels, g])] : a.groupLabels.filter((x) => x !== g)
                                              patchCell(meeting.id, slot.id, classNo, { groupLabels: next })
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
                                              patchCell(meeting.id, slot.id, classNo, { teacherIds: next })
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
                        )
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          )})}
        </Tabs>
      )}
    </div>
  )
}
