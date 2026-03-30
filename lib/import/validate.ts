/**
 * Validate mapped rows per entity type. Returns per-row validation errors.
 * Does NOT auto-map; mapping is provided by the client.
 */

import { getRequiredKeys, type EntityType } from "./entity-fields"
import { normalizeAmount, normalizePhone, parseDate, normalizeString } from "./normalize"

export type Mapping = Record<string, string> // excel column name -> system field key or "__ignore__"

export interface RowValidation {
  rowIndex: number
  errors: string[]
  mapped?: Record<string, unknown>
}

export interface ValidateResult {
  valid: boolean
  missingRequiredMappings: string[]
  duplicateMappings: string[]
  rowValidations: RowValidation[]
}

function getMappedValue(row: Record<string, unknown>, mapping: Mapping, systemKey: string): unknown {
  for (const [excelCol, sysKey] of Object.entries(mapping)) {
    if (sysKey === systemKey && row[excelCol] !== undefined) return row[excelCol]
  }
  return undefined
}

export function validateMapping(
  entity: EntityType,
  mapping: Mapping
): { missingRequired: string[]; duplicates: string[] } {
  const required = getRequiredKeys(entity)
  const mappedToSystem = Object.values(mapping).filter((v) => v && v !== "__ignore__")
  const missingRequired = required.filter((k) => !mappedToSystem.includes(k))
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const v of mappedToSystem) {
    if (seen.has(v)) {
      if (!duplicates.includes(v)) duplicates.push(v)
    } else seen.add(v)
  }
  return { missingRequired, duplicates }
}

export function validateRows(
  entity: EntityType,
  mapping: Mapping,
  rows: Record<string, unknown>[]
): RowValidation[] {
  const required = getRequiredKeys(entity)
  const results: RowValidation[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errors: string[] = []
    const mapped: Record<string, unknown> = {}

    for (const [excelCol, systemKey] of Object.entries(mapping)) {
      if (!systemKey || systemKey === "__ignore__") continue
      const raw = row[excelCol]
      mapped[systemKey] = raw
    }

    for (const key of required) {
      const val = getMappedValue(row, mapping, key)
      const str = normalizeString(val)
      if (str === "") errors.push(`Missing required: ${key}`)
    }

    if (entity === "students" || entity === "teachers") {
      const phone = getMappedValue(row, mapping, "phone") as unknown
      if (phone != null && String(phone).trim() !== "") {
        const normalized = normalizePhone(phone)
        if (normalized.length > 0 && normalized.length < 9) errors.push("Invalid phone format")
      }
      const birthDate = getMappedValue(row, mapping, "birthDate") as unknown
      if (birthDate != null && String(birthDate).trim() !== "") {
        const parsed = parseDate(birthDate)
        if (!parsed) errors.push("Invalid birth date format")
      }
    }

    if (entity === "payments") {
      const amount = getMappedValue(row, mapping, "amount") as unknown
      const amountNum = normalizeAmount(amount)
      if (amount != null && String(amount).trim() !== "" && amountNum === null)
        errors.push("Invalid amount")
      if (required.includes("amount") && (amountNum === null || amountNum <= 0))
        errors.push("Amount is required and must be positive")
      const paymentDate = getMappedValue(row, mapping, "paymentDate") as unknown
      if (paymentDate != null && String(paymentDate).trim() !== "") {
        const parsed = parseDate(paymentDate)
        if (!parsed) errors.push("Invalid payment date format")
      }
      if (required.includes("paymentDate")) {
        const parsed = parseDate(getMappedValue(row, mapping, "paymentDate"))
        if (!parsed) errors.push("Payment date is required and must be valid")
      }
      const studentId = getMappedValue(row, mapping, "studentIdentifier") as unknown
      if (required.includes("studentIdentifier") && normalizeString(studentId) === "")
        errors.push("Student identifier is required")
    }

    results.push({ rowIndex: i + 1, errors, mapped })
  }

  return results
}
