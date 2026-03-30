# Import from Excel

## Overview

The **Import from Excel** feature allows admins to import **Students**, **Teachers**, or **Payments** from `.xlsx` or `.csv` files. Mapping is **always manual** (no auto-map). Bilingual templates (Hebrew and English) are provided.

## Where to find it

**Settings** → tab **"ייבוא מאקסל" / "Import from Excel"**.

## Step-by-step

1. **Select import type**: Students, Teachers, or Payments.
2. **Download a template** (mandatory for correct column labels):
   - **"תבנית (עברית)"** – headers in Hebrew.
   - **"תבנית (English)"** – headers in English.
   - Each file has two sheets: **Template** (header + 1 example row) and **Instructions** (required fields, format hints).
3. **Fill the template** with your data (keep or change headers).
4. **Upload** your file (.xlsx or .csv, max 20MB). If the file has multiple sheets, choose the sheet to import.
5. **Parse file**: click **"נתח קובץ" / "Parse file"** to detect columns and load the first 10 rows for preview.
6. **Map columns manually**: for each Excel column, choose in the dropdown either **"התעלם מעמודה" / "Ignore column"** or the system field to map to. You must map all required fields and must not map the same system field twice.
7. **Validate**: click **"בדוק תצוגה מקדימה" / "Validate preview"** to see row-level errors (missing required, invalid date/amount/phone).
8. **Import mode**: choose **Create only** or **Upsert (create or update)**.
9. **Run import**: click **"הרץ ייבוא" / "Run import"**. The server processes the **full file** (not only the 10 preview rows). Progress and summary (created/updated/skipped/failed) are shown.
10. If there are failed rows, **download the error file** (link under the summary). It is an `.xlsx` with columns: Row, Error, and the original row data.

## Required fields (per entity)

### Students (תלמידים)

| Internal key | עברית      | English   | Required |
|-------------|------------|-----------|----------|
| name        | שם מלא     | Full name | Yes      |
| email       | אימייל     | Email     | No       |
| phone       | טלפון      | Phone     | No       |
| idNumber    | ת.ז.       | ID number | No       |
| birthDate   | תאריך לידה | Birth date| No       |
| address     | כתובת      | Address   | No       |
| city        | עיר        | City      | No       |
| status      | סטטוס      | Status    | No       |
| father      | שם האב     | Father name | No    |
| mother      | שם האם     | Mother name | No    |
| additionalPhone | טלפון נוסף | Additional phone | No |
| healthFund  | קופת חולים | Health fund | No   |
| allergies   | אלרגיות    | Allergies | No       |
| totalSessions | מס' מפגשים | Total sessions | No  |

### Teachers (מורים)

| Internal key | עברית   | English | Required |
|-------------|---------|---------|----------|
| name        | שם מלא  | Full name | Yes    |
| email       | אימייל  | Email   | No       |
| phone       | טלפון   | Phone   | No       |
| idNumber    | ת.ז.    | ID number | No    |
| birthDate   | תאריך לידה | Birth date | No  |
| city        | עיר     | City    | No       |
| specialty   | התמחות  | Specialty | No    |
| status      | סטטוס   | Status  | No       |
| bio         | אודות   | Bio     | No       |
| centerHourlyRate | שער שעתי מרכז | Center hourly rate | No |
| travelRate  | שער נסיעות | Travel rate | No |
| externalCourseRate | שער קורס חיצוני | External course rate | No |

### Payments (תשלומים)

| Internal key      | עברית           | English             | Required |
|-------------------|-----------------|---------------------|----------|
| studentIdentifier | מזהה תלמיד      | Student identifier  | Yes      |
| amount            | סכום            | Amount              | Yes      |
| paymentDate       | תאריך תשלום     | Payment date        | Yes      |
| paymentType       | סוג תשלום       | Payment type        | No       |
| description       | תיאור           | Description         | No       |

**Student identifier** can be: ת.ז. (ID number), טלפון (phone), or אימייל (email). The system resolves the student by the first match in that order.

## Unique key strategy (for Upsert)

- **Students**: `idNumber` (ת.ז.) **or** `phone` **or** `email` — first non-empty match in DB. Priority: idNumber → phone → email.
- **Teachers**: `phone` **or** `email` — first non-empty match.
- **Payments**: Composite key `(studentId, paymentDate, amount)`. There is no `receipt_number` column in the DB; duplicate detection is by same student, same date, same amount. If a row matches an existing payment, it is updated; otherwise a new payment is created.

## APIs (admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/import/templates?entity=students|teachers|payments&lang=he|en` | Download .xlsx template |
| POST   | `/api/import/parse` | Body: `FormData` with `file`, optional `selectedSheet`. Returns `sheetNames`, `columns`, first 10 `rows`. |
| POST   | `/api/import/validate` | Body: `{ entity, mapping, rows }`. Returns `valid`, `missingRequiredMappings`, `duplicateMappings`, `rowValidations`. |
| POST   | `/api/import/execute` | Body: `FormData` with `file`, `entity`, `mode`, `mapping` (JSON), optional `selectedSheet`, `lang`. Runs full import; returns `created`, `updated`, `skipped`, `failed`, `errorFileUrl`. |
| GET    | `/api/import/errors/[jobId]` | Download error file for that import job (admin only). |

- File size limit: **20MB**.
- All import APIs require **admin** (or super_admin) session.

## Error files

- **Stored at**: `import-errors/` in the project root (e.g. `import-errors/<jobId>-errors.xlsx`).
- **Download**: After import, if there are failed rows, the summary shows a link **"הורד קובץ שגיאות" / "Download error file"** pointing to `/api/import/errors/<jobId>`. Opening it downloads the `.xlsx` with columns: **Row**, **Error**, and all original file columns for failed rows.

## Audit (ImportJob)

Each import creates a row in **ImportJob**:

- `id`, `userId`, `entityType`, `lang`, `status` (running → completed)
- `startedAt`, `finishedAt`
- `created`, `updated`, `skipped`, `failed`
- `originalFilename`, `errorFilePath`

This allows auditing who imported what, when, and the outcome.
