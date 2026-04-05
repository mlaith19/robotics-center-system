/**
 * Normalizes course date/time for Postgres TIMESTAMP columns.
 *
 * TIME storage strategy:
 *   - parseCourseTimeForDb returns "1970-01-01 HH:MM:SS" (no timezone suffix)
 *   - Postgres TIMESTAMP WITHOUT TIME ZONE stores this as-is (no TZ conversion)
 *   - SELECT uses to_char(col::time, 'HH24:MI') to read back plain "HH:MM"
 *   - This avoids all timezone shifts (UTC+2 / DST etc.)
 */

/**
 * YYYY-MM-DD לפי יום בלוח השנה המקומי של הדפדפן/שרת.
 * מונע סטייה מול toISOString() (יום UTC) כשמחרוזת היא ISO מלאה — חשוב לישראל/אזורי זמן חיוביים.
 */
export function normalizeCourseCalendarYmd(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function parseCourseDateForDb(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return normalizeCourseCalendarYmd(s)
}

/** Returns "1970-01-01 HH:MM:SS" – a valid timestamp literal without timezone. */
export function parseCourseTimeForDb(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null

  // "HH:MM" or "HH:MM:SS" from <input type="time">
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (m) {
    const h   = Number(m[1])
    const min = Number(m[2])
    const sec = m[3] != null ? Number(m[3]) : 0
    if (h >= 0 && h < 24 && min >= 0 && min < 60 && sec >= 0 && sec < 60) {
      const hh = String(h).padStart(2, "0")
      const mm = String(min).padStart(2, "0")
      const ss = String(sec).padStart(2, "0")
      return `1970-01-01 ${hh}:${mm}:${ss}`
    }
  }

  // Already a full ISO timestamp — extract the time part
  const ts = /(?:T|\s)(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s)
  if (ts) {
    return `1970-01-01 ${ts[1]}:${ts[2]}:${ts[3] ?? "00"}`
  }

  return null
}

/** For <input type="time"> — DB returns "HH:MM" from to_char, or a legacy ISO string. */
export function courseTimeToInputValue(raw: string | null | undefined): string {
  if (!raw) return ""
  const t = String(raw).trim()

  // Plain "HH:MM" or "HH:MM:SS" (what to_char returns)
  const plain = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(t)
  if (plain) return `${plain[1]}:${plain[2]}`

  // Extract time from ISO timestamp / datetime string
  const ts = /(?:T|\s)(\d{2}):(\d{2})/.exec(t)
  if (ts) return `${ts[1]}:${ts[2]}`

  return ""
}

/** Same as courseTimeToInputValue but returns null instead of "". */
export function courseTimeToDisplayValue(raw: string | null | undefined): string | null {
  const v = courseTimeToInputValue(raw)
  return v || null
}
