/**
 * Generate bilingual .xlsx templates for import (Hebrew or English).
 * Sheet 1: Template (header row + 1 example row)
 * Sheet 2: Instructions (required fields, descriptions, format hints)
 */

import * as XLSX from "xlsx"
import {
  ENTITY_FIELDS,
  getFieldLabel,
  type EntityType,
} from "./entity-fields"

const EXAMPLE_ROW_STUDENTS: Record<string, string> = {
  name: "יוסי כהן",
  email: "yosi@example.com",
  phone: "050-1234567",
  idNumber: "123456789",
  birthDate: "2015-03-20",
  address: "רחוב הרצל 10",
  city: "תל אביב",
  status: "מתעניין",
  father: "דוד כהן",
  mother: "שרה כהן",
  additionalPhone: "052-9876543",
  healthFund: "כללית",
  allergies: "",
  totalSessions: "12",
}

const EXAMPLE_ROW_TEACHERS: Record<string, string> = {
  name: "מורה דוגמה",
  email: "teacher@example.com",
  phone: "050-1112233",
  idNumber: "987654321",
  birthDate: "1990-01-15",
  city: "חיפה",
  specialty: "רובוטיקה",
  status: "פעיל",
  bio: "",
  centerHourlyRate: "120",
  travelRate: "30",
  externalCourseRate: "150",
}

const EXAMPLE_ROW_PAYMENTS: Record<string, string> = {
  studentIdentifier: "050-1234567",
  amount: "350",
  paymentDate: "2025-02-15",
  paymentType: "מזומן",
  description: "תשלום חודש פברואר",
}

function getExampleRow(entity: EntityType, lang: "he" | "en"): Record<string, string> {
  const fields = ENTITY_FIELDS[entity]
  const examples: Record<string, string> =
    entity === "students"
      ? { ...EXAMPLE_ROW_STUDENTS }
      : entity === "teachers"
        ? { ...EXAMPLE_ROW_TEACHERS }
        : { ...EXAMPLE_ROW_PAYMENTS }
  const row: Record<string, string> = {}
  for (const f of fields) {
    row[getFieldLabel(f, lang)] = examples[f.internalKey] ?? ""
  }
  return row
}

export function buildTemplateXlsx(entity: EntityType, lang: "he" | "en"): Buffer {
  const fields = ENTITY_FIELDS[entity]
  const headers = fields.map((f) => getFieldLabel(f, lang))
  const exampleRow = getExampleRow(entity, lang)
  const dataRow = headers.map((h) => exampleRow[h] ?? "")

  const wsData = [headers, dataRow]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  const instructionsRows: (string | number)[][] = [
    ["Required fields", "שדות חובה"],
    ...fields.filter((f) => f.required).map((f) => [f.label_en, f.label_he]),
    [],
    ["Field (EN)", "שדה (עברית)", "Description / Format"],
    ...fields.map((f) => [f.label_en, f.label_he, f.format_hint]),
    [],
    ["Date formats", "תאריכים: YYYY-MM-DD or DD/MM/YYYY"],
    ["Amount", "סכום: number, e.g. 350 or 350.50"],
    ["Phone", "טלפון: digits, spaces/dashes are stripped"],
  ]
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsRows)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Template")
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer)
}
