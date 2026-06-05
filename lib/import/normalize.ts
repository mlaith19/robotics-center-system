/**
 * Normalize and parse values for import: dates, amounts, phones.
 */

const DATE_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})$|^(\d{1,2})\/(\d{1,2})\/(\d{4})$|^(\d{1,2})\.(\d{1,2})\.(\d{4})$/

export function normalizePhone(value: unknown): string {
  if (value == null) return ""
  const s = String(value).replace(/\s+/g, "").replace(/-/g, "").replace(/\./g, "")
  return s.replace(/^\+972/, "0").trim()
}

export function normalizeAmount(value: unknown): number | null {
  if (value == null || value === "") return null
  const s = String(value).replace(/,/g, "").trim()
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

export function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, "0")
    const d = String(value.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  const s = String(value).trim()
  const m = s.match(DATE_REGEX)
  if (!m) return null
  if (m[1]) return `${m[1]}-${m[2]}-${m[3]}`
  if (m[4]) return `${m[7]}-${m[5].padStart(2, "0")}-${m[6].padStart(2, "0")}`
  if (m[8]) return `${m[11]}-${m[9].padStart(2, "0")}-${m[10].padStart(2, "0")}`
  return null
}

export function normalizeString(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}
