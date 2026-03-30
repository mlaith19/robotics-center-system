/**
 * Execute import: create or upsert rows. Unique keys:
 * - Students: idNumber (national_id) OR phone OR email (first available)
 * - Teachers: phone OR email
 * - Payments: (studentId + paymentDate + amount) composite (no receipt_number in DB)
 */

import * as XLSX from "xlsx"
import * as fs from "fs"
import * as path from "path"
import { sql } from "@/lib/db"
import { type EntityType } from "./entity-fields"
import { normalizeAmount, normalizePhone, parseDate, normalizeString } from "./normalize"
import type { Mapping } from "./validate"

const ERROR_DIR = "import-errors"

export type ImportMode = "create" | "upsert"

export interface RowResult {
  rowIndex: number
  status: "created" | "updated" | "skipped" | "failed"
  id?: string
  error?: string
}

export interface ExecuteResult {
  jobId: string
  created: number
  updated: number
  skipped: number
  failed: number
  results: RowResult[]
  errorFileUrl?: string
}

function ensureErrorDir(): string {
  const dir = path.join(process.cwd(), ERROR_DIR)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function buildMappedRow(
  row: Record<string, unknown>,
  mapping: Mapping
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [excelCol, systemKey] of Object.entries(mapping)) {
    if (!systemKey || systemKey === "__ignore__") continue
    out[systemKey] = row[excelCol]
  }
  return out
}

async function findStudentByUniqueKey(
  idNumber: string | null,
  phone: string | null,
  email: string | null
): Promise<string | null> {
  const n = normalizeString(idNumber)
  const p = normalizePhone(phone ?? "")
  const e = normalizeString(email)
  if (n) {
    const r = await sql`SELECT id FROM "Student" WHERE "idNumber" = ${n} LIMIT 1`
    if (r.length) return (r[0] as { id: string }).id
  }
  if (p) {
    const r = await sql`SELECT id FROM "Student" WHERE phone = ${p} OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', '') = ${p} LIMIT 1`
    if (r.length) return (r[0] as { id: string }).id
  }
  if (e) {
    const r = await sql`SELECT id FROM "Student" WHERE email = ${e} LIMIT 1`
    if (r.length) return (r[0] as { id: string }).id
  }
  return null
}

async function findTeacherByUniqueKey(phone: string | null, email: string | null): Promise<string | null> {
  const p = normalizePhone(phone ?? "")
  const e = normalizeString(email)
  if (p) {
    const r = await sql`SELECT id FROM "Teacher" WHERE phone = ${p} OR REPLACE(REPLACE(REPLACE(COALESCE(phone,''), ' ', ''), '-', ''), '.', '') = ${p} LIMIT 1`
    if (r.length) return (r[0] as { id: string }).id
  }
  if (e) {
    const r = await sql`SELECT id FROM "Teacher" WHERE email = ${e} LIMIT 1`
    if (r.length) return (r[0] as { id: string }).id
  }
  return null
}

async function resolveStudentId(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim()
  const idNum = /^\d+$/.test(trimmed) ? trimmed : null
  const em = trimmed.includes("@") ? trimmed : null
  const ph = !em ? normalizePhone(identifier) : ""
  return findStudentByUniqueKey(idNum, ph || null, em)
}

export async function executeImport(
  userId: string,
  entity: EntityType,
  mode: ImportMode,
  mapping: Mapping,
  rows: Record<string, unknown>[],
  originalFilename: string,
  lang: string | null
): Promise<ExecuteResult> {
  const jobId = crypto.randomUUID()
  const now = new Date().toISOString()
  await sql`
    INSERT INTO "ImportJob" (id, "userId", "entityType", lang, status, "startedAt", "originalFilename", created, "updated", skipped, failed)
    VALUES (${jobId}, ${userId}, ${entity}, ${lang}, 'running', ${now}, ${originalFilename}, 0, 0, 0, 0)
  `

  const results: RowResult[] = []
  let created = 0,
    updated = 0,
    skipped = 0,
    failed = 0
  const errorRows: { rowIndex: number; error: string; raw: Record<string, unknown> }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const mapped = buildMappedRow(row, mapping)
    const rowNum = i + 1

    try {
      if (entity === "students") {
        const name = normalizeString(mapped.name)
        if (!name) {
          failed++
          const err = "Name is required"
          errorRows.push({ rowIndex: rowNum, error: err, raw: row })
          results.push({ rowIndex: rowNum, status: "failed", error: err })
          continue
        }
        const idNumber = normalizeString(mapped.idNumber) || null
        const phone = normalizeString(mapped.phone) || null
        const email = normalizeString(mapped.email) || null
        const existingId = await findStudentByUniqueKey(idNumber, phone, email)

        if (mode === "create" && existingId) {
          skipped++
          results.push({ rowIndex: rowNum, status: "skipped", error: "Already exists" })
          continue
        }
        if (mode === "upsert" && existingId) {
          await sql`
            UPDATE "Student" SET
              name = ${name},
              email = ${email || null},
              phone = ${phone || null},
              address = ${normalizeString(mapped.address) || null},
              city = ${normalizeString(mapped.city) || null},
              status = ${normalizeString(mapped.status) || "מתעניין"},
              "birthDate" = ${parseDate(mapped.birthDate) || null},
              "idNumber" = ${idNumber},
              father = ${normalizeString(mapped.father) || null},
              mother = ${normalizeString(mapped.mother) || null},
              "additionalPhone" = ${normalizeString(mapped.additionalPhone) || null},
              "healthFund" = ${normalizeString(mapped.healthFund) || null},
              allergies = ${normalizeString(mapped.allergies) || null},
              "totalSessions" = ${typeof mapped.totalSessions === "number" ? mapped.totalSessions : parseInt(String(mapped.totalSessions || "12"), 10) || 12},
              "updatedAt" = ${now}
            WHERE id = ${existingId}
          `
          updated++
          results.push({ rowIndex: rowNum, status: "updated", id: existingId })
          continue
        }
        if (mode === "create" || !existingId) {
          const newId = crypto.randomUUID()
          await sql`
            INSERT INTO "Student" (id, name, email, phone, address, city, status, "birthDate", "idNumber", father, mother, "additionalPhone", "healthFund", allergies, "totalSessions", "courseIds", "courseSessions", "createdAt", "updatedAt")
            VALUES (
              ${newId}, ${name}, ${email}, ${phone},
              ${normalizeString(mapped.address) || null}, ${normalizeString(mapped.city) || null},
              ${normalizeString(mapped.status) || "מתעניין"}, ${parseDate(mapped.birthDate) || null},
              ${idNumber}, ${normalizeString(mapped.father) || null}, ${normalizeString(mapped.mother) || null},
              ${normalizeString(mapped.additionalPhone) || null}, ${normalizeString(mapped.healthFund) || null},
              ${normalizeString(mapped.allergies) || null},
              ${typeof mapped.totalSessions === "number" ? mapped.totalSessions : parseInt(String(mapped.totalSessions || "12"), 10) || 12},
              '[]'::jsonb, '{}'::jsonb, ${now}, ${now}
            )
          `
          created++
          results.push({ rowIndex: rowNum, status: "created", id: newId })
        }
      } else if (entity === "teachers") {
        const name = normalizeString(mapped.name)
        if (!name) {
          failed++
          const err = "Name is required"
          errorRows.push({ rowIndex: rowNum, error: err, raw: row })
          results.push({ rowIndex: rowNum, status: "failed", error: err })
          continue
        }
        const phone = normalizeString(mapped.phone) || null
        const email = normalizeString(mapped.email) || null
        const existingId = await findTeacherByUniqueKey(phone, email)

        if (mode === "create" && existingId) {
          skipped++
          results.push({ rowIndex: rowNum, status: "skipped", error: "Already exists" })
          continue
        }
        if (mode === "upsert" && existingId) {
          await sql`
            UPDATE "Teacher" SET
              name = ${name},
              email = ${email},
              phone = ${phone},
              "idNumber" = ${normalizeString(mapped.idNumber) || null},
              "birthDate" = ${parseDate(mapped.birthDate) || null},
              city = ${normalizeString(mapped.city) || null},
              specialty = ${normalizeString(mapped.specialty) || null},
              status = ${normalizeString(mapped.status) || "פעיל"},
              bio = ${normalizeString(mapped.bio) || null},
              "centerHourlyRate" = ${normalizeAmount(mapped.centerHourlyRate) ?? null},
              "travelRate" = ${normalizeAmount(mapped.travelRate) ?? null},
              "externalCourseRate" = ${normalizeAmount(mapped.externalCourseRate) ?? null},
              "updatedAt" = ${now}
            WHERE id = ${existingId}
          `
          updated++
          results.push({ rowIndex: rowNum, status: "updated", id: existingId })
          continue
        }
        const newId = crypto.randomUUID()
        await sql`
          INSERT INTO "Teacher" (id, name, email, phone, "idNumber", "birthDate", city, specialty, status, bio, "centerHourlyRate", "travelRate", "externalCourseRate", "createdAt", "updatedAt")
          VALUES (
            ${newId}, ${name}, ${email}, ${phone},
            ${normalizeString(mapped.idNumber) || null}, ${parseDate(mapped.birthDate) || null},
            ${normalizeString(mapped.city) || null}, ${normalizeString(mapped.specialty) || null},
            ${normalizeString(mapped.status) || "פעיל"}, ${normalizeString(mapped.bio) || null},
            ${normalizeAmount(mapped.centerHourlyRate) ?? null}, ${normalizeAmount(mapped.travelRate) ?? null},
            ${normalizeAmount(mapped.externalCourseRate) ?? null}, ${now}, ${now}
          )
        `
        created++
        results.push({ rowIndex: rowNum, status: "created", id: newId })
      } else if (entity === "payments") {
        const studentIdentifier = normalizeString(mapped.studentIdentifier)
        if (!studentIdentifier) {
          failed++
          const err = "Student identifier is required"
          errorRows.push({ rowIndex: rowNum, error: err, raw: row })
          results.push({ rowIndex: rowNum, status: "failed", error: err })
          continue
        }
        const studentId = await resolveStudentId(studentIdentifier)
        if (!studentId) {
          failed++
          const err = "Student not found for identifier"
          errorRows.push({ rowIndex: rowNum, error: err, raw: row })
          results.push({ rowIndex: rowNum, status: "failed", error: err })
          continue
        }
        const amount = normalizeAmount(mapped.amount)
        if (amount == null || amount <= 0) {
          failed++
          const err = "Invalid or missing amount"
          errorRows.push({ rowIndex: rowNum, error: err, raw: row })
          results.push({ rowIndex: rowNum, status: "failed", error: err })
          continue
        }
        const paymentDate = parseDate(mapped.paymentDate)
        if (!paymentDate) {
          failed++
          const err = "Invalid or missing payment date"
          errorRows.push({ rowIndex: rowNum, error: err, raw: row })
          results.push({ rowIndex: rowNum, status: "failed", error: err })
          continue
        }
        const paymentType = normalizeString(mapped.paymentType) || "cash"
        const description = normalizeString(mapped.description) || null

        if (mode === "upsert") {
          const existing = await sql`
            SELECT id FROM "Payment"
            WHERE "studentId" = ${studentId} AND "paymentDate"::date = ${paymentDate}::date AND amount = ${amount}
            LIMIT 1
          `
          if (existing.length > 0) {
            const payId = (existing[0] as { id: string }).id
            await sql`
              UPDATE "Payment" SET "paymentType" = ${paymentType}, description = ${description}
              WHERE id = ${payId}
            `
            updated++
            results.push({ rowIndex: rowNum, status: "updated", id: payId })
            continue
          }
        }

        const payId = crypto.randomUUID()
        await sql`
          INSERT INTO "Payment" (id, "studentId", amount, "paymentDate", "paymentType", description, "createdByUserId", "createdAt")
          VALUES (${payId}, ${studentId}, ${amount}, ${paymentDate}, ${paymentType}, ${description}, ${userId}, ${now})
        `
        created++
        results.push({ rowIndex: rowNum, status: "created", id: payId })
      }
    } catch (e) {
      failed++
      const err = e instanceof Error ? e.message : String(e)
      errorRows.push({ rowIndex: rowNum, error: err, raw: row })
      results.push({ rowIndex: rowNum, status: "failed", error: err })
    }
  }

  let errorFilePath: string | null = null
  if (errorRows.length > 0) {
    const dir = ensureErrorDir()
    const filename = `${jobId}-errors.xlsx`
    errorFilePath = path.join(dir, filename)
    const wsData = [
      ["Row", "Error", ...Object.keys(errorRows[0].raw || {})],
      ...errorRows.map((r) => [
        r.rowIndex,
        r.error,
        ...Object.values(r.raw || {}),
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Errors")
    XLSX.writeFile(wb, errorFilePath)
    errorFilePath = `${ERROR_DIR}/${filename}`
  }

  const finishedAt = new Date().toISOString()
  await sql`
    UPDATE "ImportJob" SET
      status = 'completed',
      "finishedAt" = ${finishedAt},
      created = ${created},
      "updated" = ${updated},
      skipped = ${skipped},
      failed = ${failed},
      "errorFilePath" = ${errorFilePath}
    WHERE id = ${jobId}
  `

  const errorFileUrl =
    errorFilePath != null ? `/api/import/errors/${jobId}` : undefined

  return {
    jobId,
    created,
    updated,
    skipped,
    failed,
    results,
    errorFileUrl,
  }
}
