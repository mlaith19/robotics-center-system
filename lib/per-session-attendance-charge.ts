import { normalizeCourseCalendarYmd } from "@/lib/course-db-fields"
import { listCampSessionDates } from "@/lib/camp-kaytana"
import { courseTypeIsPerSession, normalizeSessionPricesMap } from "@/lib/course-session-prices"

/** תאריך נוכחות כ־YYYY-MM-DD (מחרוזת או ISO) */
export function extractAttendanceDateYmd(raw: unknown): string {
  if (raw instanceof Date) {
    const y = raw.getUTCFullYear()
    const m = String(raw.getUTCMonth() + 1).padStart(2, "0")
    const d = String(raw.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  const s = String(raw ?? "").trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const head = s.split("T")[0]
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ""
}

export function isPresentAttendanceStatus(status: unknown): boolean {
  const x = String(status ?? "").trim().toLowerCase()
  return x === "present" || x === "נוכח"
}

function parseDaysOfWeek(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).toLowerCase().trim()).filter(Boolean)
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown
      if (Array.isArray(j)) return j.map((x) => String(x).toLowerCase().trim()).filter(Boolean)
    } catch {
      /* ignore */
    }
  }
  return []
}

export type PerSessionAttendanceSummary = {
  presentSessionCount: number
  attendedChargeSum: number
}

/**
 * לקורס מסוג *_session: סכום צפוי לפי מפגשים שבהם התלמיד מסומן נוכח,
 * לפי sessionPrices או מחיר אחיד (מחיר קורס / מספר מפגשים מתוכנן).
 */
export function summarizePerSessionAttendanceForEnrollment(input: {
  courseType: unknown
  coursePrice: number
  courseDuration: number | null
  startDate: unknown
  endDate: unknown
  daysOfWeek: unknown
  sessionPricesRaw: unknown
  attendanceRows: { date: unknown; status: unknown }[]
}): PerSessionAttendanceSummary | null {
  if (!courseTypeIsPerSession(String(input.courseType ?? ""))) return null

  const start = normalizeCourseCalendarYmd(input.startDate)
  const end = normalizeCourseCalendarYmd(input.endDate)
  const days = parseDaysOfWeek(input.daysOfWeek)
  if (!start || !end || days.length === 0) {
    return { presentSessionCount: 0, attendedChargeSum: 0 }
  }

  const scheduleDates = listCampSessionDates(start, end, days)
  const scheduleSet = new Set(scheduleDates)
  const priceMap = normalizeSessionPricesMap(input.sessionPricesRaw)
  const nPlanned =
    scheduleDates.length > 0 ? scheduleDates.length : Math.max(1, Number(input.courseDuration || 0) || 1)
  const coursePrice = Number(input.coursePrice || 0)
  const uniform = nPlanned > 0 ? coursePrice / nPlanned : 0

  const seenYmd = new Set<string>()
  let sum = 0

  for (const row of input.attendanceRows) {
    const ymd = extractAttendanceDateYmd(row.date)
    if (!ymd || !scheduleSet.has(ymd)) continue
    if (!isPresentAttendanceStatus(row.status)) continue
    if (seenYmd.has(ymd)) continue
    seenYmd.add(ymd)
    const p = priceMap[ymd] != null ? priceMap[ymd] : uniform
    sum += Math.max(0, p)
  }

  return {
    presentSessionCount: seenYmd.size,
    attendedChargeSum: Math.round(sum * 100) / 100,
  }
}
