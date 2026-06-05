/**
 * Parse uploaded .xlsx or .csv file on the server.
 * Returns: sheet names (for xlsx), columns (from first row), first 10 data rows (raw).
 * NO auto-mapping: columns are as-is from the file.
 */

import * as XLSX from "xlsx"

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
]

export interface ParseResult {
  sheetNames: string[]
  columns: string[]
  rows: Record<string, unknown>[]
  selectedSheet?: string
}

function normalizeHeaderCell(value: unknown): string {
  if (value == null) return ""
  const s = String(value).trim()
  return s
}

function rowToRecord(columns: string[], row: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  columns.forEach((col, i) => {
    const raw = row[i]
    out[col] = raw === undefined || raw === null ? "" : raw
  })
  return out
}

/** maxRows: limit preview rows (default 10). Omit or 0 = all rows. */
export function parseBuffer(
  buffer: Buffer,
  fileType: string,
  selectedSheetName?: string,
  maxRows: number = 10
): ParseResult {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error("FILE_TOO_LARGE")
  }

  const isCsv =
    fileType === "text/csv" ||
    fileType === "application/csv" ||
    (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf)

  if (isCsv) {
    const wb = XLSX.read(buffer, { type: "buffer", raw: true })
    const firstSheet = wb.SheetNames[0]
    const ws = wb.Sheets[firstSheet]
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" })
    if (data.length === 0) {
      return { sheetNames: [firstSheet], columns: [], rows: [] }
    }
    const headerRow = data[0] as unknown[]
    const columns = headerRow.map(normalizeHeaderCell)
    const end = maxRows > 0 ? Math.min(data.length, 1 + maxRows) : data.length
    const rows = data.slice(1, end).map((row) => rowToRecord(columns, (row as unknown[]) || []))
    return { sheetNames: [firstSheet], columns, rows, selectedSheet: firstSheet }
  }

  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheetNames = wb.SheetNames
  const sheetToUse = selectedSheetName && sheetNames.includes(selectedSheetName)
    ? selectedSheetName
    : sheetNames[0]
  const ws = wb.Sheets[sheetToUse]
  if (!ws) {
    return { sheetNames, columns: [], rows: [] }
  }
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" })
  if (data.length === 0) {
    return { sheetNames, columns: [], rows: [], selectedSheet: sheetToUse }
  }
  const headerRow = data[0] as unknown[]
  const columns = headerRow.map(normalizeHeaderCell)
  const end = maxRows > 0 ? Math.min(data.length, 1 + maxRows) : data.length
  const rows = data.slice(1, end).map((row) => rowToRecord(columns, (row as unknown[]) || []))
  return { sheetNames, columns, rows, selectedSheet: sheetToUse }
}

export { MAX_FILE_SIZE_BYTES, ALLOWED_TYPES }
