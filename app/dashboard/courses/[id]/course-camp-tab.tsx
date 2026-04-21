"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Plus, Trash2, ChevronDown, Printer, Copy } from "lucide-react"

type TeacherOpt = { id: string; name: string }
type ClassroomDef = { number: number; name: string; notes?: string }
type CampMeetingCell = { id: string; classroomNo: number; lessonTitle: string; groupLabels: string[]; teacherIds: string[]; isBreak?: boolean; breakTitle?: string }
type CampMeetingSlot = {
  id: string
  sortOrder: number
  startTime: string
  endTime: string
  isBreak: boolean
  breakTitle: string
  cells: CampMeetingCell[]
}
type CampMeeting = { id: string; sessionDate: string; sortOrder: number; isActive: boolean; slots: CampMeetingSlot[] }

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function hebrewWeekday(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`)
  const names = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
  return names[d.getDay()] || ""
}

export function CourseCampTab(props: { courseId: string; canEdit: boolean; onMeetingsSaved?: () => void }) {
  const { courseId, canEdit, onMeetingsSaved } = props
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<TeacherOpt[]>([])
  const [groupLetters, setGroupLetters] = useState<string[]>([])
  const [classroomsCount, setClassroomsCount] = useState(6)
  const [classroomsDef, setClassroomsDef] = useState<ClassroomDef[]>([])
  const [meetings, setMeetings] = useState<CampMeeting[]>([])
  const [activeMeetingId, setActiveMeetingId] = useState("")
  const [centerName, setCenterName] = useState("")
  const [centerLogo, setCenterLogo] = useState("")
  const [courseName, setCourseName] = useState("")

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
      const rawMeetings = (Array.isArray(data.meetings) ? data.meetings : []).map(
        (m: { isActive?: unknown } & CampMeeting) => ({
          ...m,
          isActive: m.isActive === undefined || m.isActive === null ? true : Boolean(m.isActive),
        }),
      ) as CampMeeting[]
      setMeetings(rawMeetings)
      setActiveMeetingId((prev) => {
        if (rawMeetings.length === 0) return ""
        if (prev && rawMeetings.some((m) => m.id === prev)) return prev
        return String(rawMeetings[0]?.id || "")
      })
      setCenterName(String(data.centerName || ""))
      setCenterLogo(String(data.centerLogo || ""))
      setCourseName(String(data.courseName || ""))
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

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstLoad = useRef(true)

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      return
    }
    if (!canEdit || meetings.length === 0) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      setSaving(true)
      fetch(`/api/courses/${courseId}/camp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetings }),
      })
        .then((res) => {
          if (!res.ok) {
            res.json().then((j) => setErr(String(j.error || "שמירה נכשלה")))
            return
          }
          if (onMeetingsSaved) onMeetingsSaved()
        })
        .catch(() => setErr("שגיאת רשת בשמירה"))
        .finally(() => setSaving(false))
    }, 1200)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [meetings, canEdit, courseId])

  function copyMeetingToOthers(sourceMeetingId: string) {
    const source = meetings.find((m) => m.id === sourceMeetingId)
    if (!source) return
    setMeetings((prev) => prev.map((m) => {
      if (m.id === sourceMeetingId) return m
      return {
        ...m,
        slots: source.slots.map((s) => ({
          ...s,
          id: newId(),
          cells: s.cells.map((c) => ({ ...c, id: newId() })),
        })),
      }
    }))
  }

  function cellFor(slot: CampMeetingSlot, classroomNo: number): CampMeetingCell {
    return slot.cells.find((c) => c.classroomNo === classroomNo)
      || { id: newId(), classroomNo, lessonTitle: "", groupLabels: [], teacherIds: [], isBreak: false, breakTitle: "" }
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
    <div className="space-y-2" dir="rtl">
      {err && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

      {sortedMeetings.length > 0 && (
        <>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => {
              const w = window.open("", "_blank")
              if (!w) return
              const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
              w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${courseName || "קייטנה"} - כל המפגשים</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:32px 40px;color:#1f2937;max-width:900px;margin:0 auto}
.header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #3b82f6}
.header h1{font-size:22px;color:#1e40af;margin-top:6px}
.header h2{font-size:15px;color:#4b5563;font-weight:400;margin-top:2px}
h3{font-size:16px;color:#1e40af;margin:24px 0 8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;margin-bottom:16px}
th{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:8px 10px;text-align:center;font-weight:600}
td{border:1px solid #d1d5db;padding:6px 8px;text-align:center;vertical-align:middle}
tr:nth-child(even) td{background:#f9fafb}
.break-cell{background:#fef3c7 !important;color:#92400e;font-weight:600;text-align:center}
.lesson{font-weight:600;font-size:15px;margin-bottom:3px}
.groups,.teachers{font-size:13px;color:#374151;margin-top:2px}
.groups span,.teachers span{display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:3px;padding:2px 6px;margin:1px;font-size:12px}
.teachers span{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
.time-cell{font-weight:600;white-space:nowrap;color:#4b5563;text-align:center}
@media print{body{padding:20px 28px;max-width:100%}@page{margin:20mm 15mm}h3{page-break-before:auto}}
</style></head><body>`)
              w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1>${courseName ? `<h2 style="font-size:17px;color:#1f2937;font-weight:600;margin-top:4px">${courseName}</h2>` : ""}</div>`)
              sortedMeetings.forEach((mt, idx) => {
                const el = document.getElementById(`camp-print-${mt.id}`)
                if (!el) return
                w.document.write(`<h3>מפגש ${idx + 1} - ${hebrewWeekday(mt.sessionDate)} (${mt.sessionDate})</h3>`)
                w.document.write(el.innerHTML)
              })
              w.document.write(`</body></html>`)
              w.document.close()
              setTimeout(() => w.print(), 300)
            }}
          >
            <Printer className="h-4 w-4" />
            הדפסת כל המפגשים
          </Button>
        </div>
        <Tabs
          dir="rtl"
          value={sortedMeetings.some((m) => m.id === activeMeetingId) ? activeMeetingId : sortedMeetings[0]!.id}
          onValueChange={setActiveMeetingId}
          className="w-full"
        >
          <TabsList dir="rtl" className="h-auto w-full flex-wrap justify-start gap-0.5 p-1">
            {sortedMeetings.map((meeting, i) => (
              <TabsTrigger
                key={meeting.id}
                value={meeting.id}
                className={`h-auto min-w-[74px] flex-none px-1.5 py-1 leading-tight whitespace-normal text-center flex flex-col items-center gap-0 data-[state=active]:bg-gradient-to-b data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md ${meeting.isActive === false ? "opacity-60" : ""}`}
              >
                <span className="block">
                  מפגש {i + 1}
                  {meeting.isActive === false ? " (לא פעיל)" : ""}
                </span>
                <span className="block text-[11px] opacity-90">{hebrewWeekday(meeting.sessionDate)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {sortedMeetings.map((meeting, i) => {
            const sortedSlots = [...meeting.slots].sort((a, b) => a.sortOrder - b.sortOrder || a.startTime.localeCompare(b.startTime))
            return (
            <TabsContent key={meeting.id} value={meeting.id}>
              <Card className={meeting.isActive === false ? "opacity-75" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="text-base">
                        מפגש {i + 1} - {hebrewWeekday(meeting.sessionDate)} ({meeting.sessionDate})
                      </CardTitle>
                      <label
                        className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${
                          meeting.isActive === false
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        <Switch
                          checked={meeting.isActive !== false}
                          disabled={!canEdit}
                          onCheckedChange={(v) =>
                            setMeetings((prev) =>
                              prev.map((m) => (m.id === meeting.id ? { ...m, isActive: Boolean(v) } : m)),
                            )
                          }
                        />
                        <span className="font-semibold">
                          {meeting.isActive === false ? "לא פעיל" : "פעיל"}
                        </span>
                      </label>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() =>
                            setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : {
                              ...m,
                              slots: [...m.slots, { id: newId(), sortOrder: m.slots.length + 1, startTime: "08:30", endTime: "09:15", isBreak: false, breakTitle: "", cells: [] }],
                            }))
                          }
                        >
                          <Plus className="h-4 w-4" />
                          הוסף משבצת
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => copyMeetingToOthers(meeting.id)}
                        >
                          <Copy className="h-4 w-4" />
                          העתק לכל המפגשים
                        </Button>
                        {saving && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />שומר...</span>}
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => {
                            const printArea = document.getElementById(`camp-print-${meeting.id}`)
                            if (!printArea) return
                            const w = window.open("", "_blank")
                            if (!w) return
                            const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
                            w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>מפגש ${i + 1} - ${hebrewWeekday(meeting.sessionDate)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:32px 40px;color:#1f2937;max-width:900px;margin:0 auto}
.header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #3b82f6}
.header h1{font-size:22px;color:#1e40af;margin-top:6px}
.header h2{font-size:15px;color:#4b5563;font-weight:400;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
th{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:8px 10px;text-align:center;font-weight:600}
td{border:1px solid #d1d5db;padding:6px 8px;text-align:center;vertical-align:middle}
tr:nth-child(even) td{background:#f9fafb}
.break-cell{background:#fef3c7 !important;color:#92400e;font-weight:600;text-align:center}
.lesson{font-weight:600;font-size:15px;margin-bottom:3px}
.groups,.teachers{font-size:13px;color:#374151;margin-top:2px}
.groups span,.teachers span{display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:3px;padding:2px 6px;margin:1px;font-size:12px}
.teachers span{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
.time-cell{font-weight:600;white-space:nowrap;color:#4b5563;text-align:center}
@media print{body{padding:20px 28px;max-width:100%}.header{margin-bottom:16px}@page{margin:20mm 15mm}}
</style></head><body>`)
                            w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1>${courseName ? `<h2 style="font-size:17px;color:#1f2937;font-weight:600;margin-top:4px">${courseName}</h2>` : ""}<h2>מפגש ${i + 1} - ${hebrewWeekday(meeting.sessionDate)} (${meeting.sessionDate})</h2></div>`)
                            w.document.write(printArea.innerHTML)
                            w.document.write(`</body></html>`)
                            w.document.close()
                            setTimeout(() => w.print(), 300)
                          }}
                        >
                          <Printer className="h-4 w-4" />
                          הדפסה
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="hidden md:block">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <thead><tr><th className="border p-2 bg-muted/40 text-right">שעה</th>{classrooms.map((c) => <th key={c.number} className="border p-2 bg-muted/40 text-right">{c.name}</th>)}</tr></thead>
                    <tbody>
                      {sortedSlots.map((slot) => (
                          <tr key={slot.id}>
                            <td className="border p-1.5 align-top w-[140px]">
                              {canEdit ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <input type="time" className="flex-1 rounded border px-1 py-0.5 text-xs [&::-webkit-calendar-picker-indicator]:hidden" value={String(slot.startTime || "").slice(0, 5)} onChange={(e) => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.map((x) => x.id !== slot.id ? x : { ...x, startTime: e.target.value }) }))} />
                                    <span className="text-xs">-</span>
                                    <input type="time" className="flex-1 rounded border px-1 py-0.5 text-xs [&::-webkit-calendar-picker-indicator]:hidden" value={String(slot.endTime || "").slice(0, 5)} onChange={(e) => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.map((x) => x.id !== slot.id ? x : { ...x, endTime: e.target.value }) }))} />
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" className="h-5 w-full text-[10px] text-destructive" onClick={() => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.filter((x) => x.id !== slot.id) }))}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              ) : (
                                <div className="text-xs font-medium">{slot.startTime} - {slot.endTime}</div>
                              )}
                            </td>
                            {classrooms.map((classroom) => {
                              const classNo = classroom.number
                              const a = cellFor(slot, classNo)
                              const cellBreak = Boolean(a.isBreak)
                              return (
                                <td key={classroom.number} className={`border p-1.5 align-top ${cellBreak ? "bg-amber-50" : ""}`}>
                                  {cellBreak ? (
                                    <div className="space-y-1">
                                      <div className="text-xs font-medium text-amber-800">{a.breakTitle?.trim() || "הפסקה"}</div>
                                      {canEdit && (
                                        <>
                                          <Input className="h-7 text-xs" placeholder="כותרת הפסקה" value={a.breakTitle || ""} onChange={(e) => patchCell(meeting.id, slot.id, classNo, { breakTitle: e.target.value })} />
                                          <Button type="button" variant="ghost" size="sm" className="h-6 w-full text-xs" onClick={() => patchCell(meeting.id, slot.id, classNo, { isBreak: false, breakTitle: "" })}>בטל הפסקה</Button>
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <Input className="h-7 text-xs" placeholder="שם שיעור" value={a.lessonTitle} disabled={!canEdit} onChange={(e) => patchCell(meeting.id, slot.id, classNo, { lessonTitle: e.target.value })} />
                                      {canEdit && (
                                        <label className="flex items-center gap-1.5 text-[11px]">
                                          <Checkbox className="h-3 w-3" checked={cellBreak} onCheckedChange={(v) => patchCell(meeting.id, slot.id, classNo, { isBreak: Boolean(v) })} />
                                          הפסקה
                                        </label>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button type="button" variant="outline" size="sm" className="h-7 w-full justify-between text-xs" disabled={!canEdit}>
                                            קבוצות ({a.groupLabels.length})
                                            <ChevronDown className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="max-h-64 w-44">
                                          {groupLetters.map((g) => (
                                            <DropdownMenuCheckboxItem
                                              key={g}
                                              checked={a.groupLabels.includes(g)}
                                              onCheckedChange={(v) => {
                                                const next = v ? [...new Set([...a.groupLabels, g])] : a.groupLabels.filter((x) => x !== g)
                                                patchCell(meeting.id, slot.id, classNo, { groupLabels: next })
                                              }}
                                            >
                                              {g}
                                            </DropdownMenuCheckboxItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                      {a.groupLabels.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5">
                                          {a.groupLabels.map((g) => (
                                            <Badge key={g} variant="secondary" className="text-[10px] px-1 py-0">{g}</Badge>
                                          ))}
                                        </div>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button type="button" variant="outline" size="sm" className="h-7 w-full justify-between text-xs" disabled={!canEdit}>
                                            מורים ({a.teacherIds.length})
                                            <ChevronDown className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="max-h-64 w-56">
                                          {teachers.map((t) => (
                                            <DropdownMenuCheckboxItem
                                              key={t.id}
                                              checked={a.teacherIds.includes(t.id)}
                                              onCheckedChange={(v) => {
                                                const next = v ? [...new Set([...a.teacherIds, t.id])] : a.teacherIds.filter((x) => x !== t.id)
                                                patchCell(meeting.id, slot.id, classNo, { teacherIds: next })
                                              }}
                                            >
                                              {t.name}
                                            </DropdownMenuCheckboxItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                      {a.teacherIds.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5">
                                          {a.teacherIds.map((teacherId) => (
                                            <Badge key={teacherId} variant="outline" className="text-[10px] px-1 py-0">
                                              {teachers.find((t) => t.id === teacherId)?.name || "מורה"}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
                <CardContent className="space-y-3 md:hidden">
                  {sortedSlots.map((slot) => (
                    <div key={slot.id} className="rounded-md border p-3 space-y-3">
                      <div className="text-sm font-medium">{slot.startTime} - {slot.endTime}</div>
                      {canEdit && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="time"
                            value={String(slot.startTime || "").slice(0, 5)}
                            onChange={(e) => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.map((x) => x.id !== slot.id ? x : { ...x, startTime: e.target.value }) }))}
                          />
                          <Input
                            type="time"
                            value={String(slot.endTime || "").slice(0, 5)}
                            onChange={(e) => setMeetings((prev) => prev.map((m) => m.id !== meeting.id ? m : { ...m, slots: m.slots.map((x) => x.id !== slot.id ? x : { ...x, endTime: e.target.value }) }))}
                          />
                        </div>
                      )}
                      {slot.isBreak ? (
                        <div className="rounded-md bg-amber-100 p-2 text-amber-900 font-medium">{slot.breakTitle?.trim() || "הפסקה"}</div>
                      ) : (
                        classrooms.map((classroom) => {
                          const classNo = classroom.number
                          const a = cellFor(slot, classNo)
                          return (
                            <div key={classroom.number} className="rounded-md border p-2 space-y-2">
                              <div className="text-xs text-muted-foreground">{classroom.name}</div>
                              <Input placeholder="שם שיעור" value={a.lessonTitle} disabled={!canEdit} onChange={(e) => patchCell(meeting.id, slot.id, classNo, { lessonTitle: e.target.value })} />
                              <div className="grid grid-cols-2 gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="outline" size="sm" className="justify-between" disabled={!canEdit}>
                                      קבוצות ({a.groupLabels.length})
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="max-h-64 w-44">
                                    {groupLetters.map((g) => (
                                      <DropdownMenuCheckboxItem
                                        key={g}
                                        checked={a.groupLabels.includes(g)}
                                        onCheckedChange={(v) => {
                                          const next = v ? [...new Set([...a.groupLabels, g])] : a.groupLabels.filter((x) => x !== g)
                                          patchCell(meeting.id, slot.id, classNo, { groupLabels: next })
                                        }}
                                      >
                                        {g}
                                      </DropdownMenuCheckboxItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="outline" size="sm" className="justify-between" disabled={!canEdit}>
                                      מורים ({a.teacherIds.length})
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="max-h-64 w-56">
                                    {teachers.map((t) => (
                                      <DropdownMenuCheckboxItem
                                        key={t.id}
                                        checked={a.teacherIds.includes(t.id)}
                                        onCheckedChange={(v) => {
                                          const next = v ? [...new Set([...a.teacherIds, t.id])] : a.teacherIds.filter((x) => x !== t.id)
                                          patchCell(meeting.id, slot.id, classNo, { teacherIds: next })
                                        }}
                                      >
                                        {t.name}
                                      </DropdownMenuCheckboxItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )})}
        </Tabs>
        {sortedMeetings.map((meeting) => {
          const slotsForPrint = [...meeting.slots].sort((a, b) => a.sortOrder - b.sortOrder || a.startTime.localeCompare(b.startTime))
          return (
            <div key={`print-${meeting.id}`} id={`camp-print-${meeting.id}`} className="hidden">
              <table>
                <thead>
                  <tr>
                    <th>שעה</th>
                    {classrooms.map((c) => <th key={c.number}>{c.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {slotsForPrint.map((slot) => (
                    <tr key={slot.id}>
                      <td className="time-cell">{slot.startTime} - {slot.endTime}</td>
                      {classrooms.map((classroom) => {
                        const a = cellFor(slot, classroom.number)
                        const cellBreak = Boolean(a.isBreak)
                        return (
                          <td key={classroom.number} className={cellBreak ? "break-cell" : ""}>
                            {cellBreak ? (a.breakTitle?.trim() || "הפסקה") : (
                              <>
                                {a.lessonTitle && <div className="lesson">{a.lessonTitle}</div>}
                                {a.groupLabels.length > 0 && <div className="groups">{a.groupLabels.map((g) => <span key={g}>קבוצה {g}</span>)}</div>}
                                {a.teacherIds.length > 0 && <div className="teachers">מורה: {a.teacherIds.map((tid) => <span key={tid}>{teachers.find((t) => t.id === tid)?.name || ""}</span>)}</div>}
                              </>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
        </>
      )}
    </div>
  )
}
