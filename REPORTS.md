# Reports Module – Robotics Center

## Overview

The Reports module provides operational, finance, schools, and GEFEN reports with date-range and optional filters, KPI cards, detailed tables, and CSV export. It is built to be **future-proof** for SuperAdmin, tenant-per-database, and plan/feature gating.

---

## Reports Available

| Category   | Report            | Path                                    | Description                          |
|-----------|-------------------|-----------------------------------------|--------------------------------------|
| Operational | Students         | `/dashboard/reports/students`           | Students by date range, course, teacher |
| Operational | Teachers         | `/dashboard/reports/teachers`           | Teachers by date range, course       |
| Operational | Courses          | `/dashboard/reports/courses`            | Courses by date, teacher, school     |
| Finance   | Revenue           | `/dashboard/reports/finance/revenue`    | Payments (excl. discount/credit)      |
| Finance   | Debts             | `/dashboard/reports/finance/debts`      | Students with positive balance (expected − paid) |
| Schools   | Summary           | `/dashboard/reports/schools/summary`    | Schools with course/student counts   |
| GEFEN     | Budget Utilization| `/dashboard/reports/gefen/utilization`  | Placeholder; “no data” until module exists |

---

## Required Roles / Permissions

- **Admin (super_admin / admin)**: Full access to all reports.
- **Secretary / Coordinator**: `reports.view` (and optionally `cashier.view` for finance). Can see operational + finance + schools + GEFEN (structure).
- **Teacher**: `reports.view`. Can access **operational reports only** (students, teachers, courses). Data is **scoped to their own courses** (via `Teacher.userId = session.id`). No finance reports.
- **Finance-only**: Implement by granting `reports.view` + `cashier.view` without full admin; `requireReportAccess` allows finance reports when `canAccessFinance(session)`.

RBAC is enforced **server-side** on every report endpoint in `lib/reports-auth.ts` (`requireReportAccess`).

---

## API Endpoints

All require **authentication** (session cookie). Query params are validated (dates, pagination).

| Method | Endpoint | Query params | Response shape |
|--------|----------|--------------|----------------|
| GET | `/api/reports/students` | `startDate`, `endDate`, `courseId`, `teacherId`, `page`, `limit` | `{ kpis, rows, pagination }` |
| GET | `/api/reports/teachers` | `startDate`, `endDate`, `courseId`, `page`, `limit` | `{ kpis, rows, pagination }` |
| GET | `/api/reports/courses` | `startDate`, `endDate`, `teacherId`, `schoolId`, `page`, `limit` | `{ kpis, rows, pagination }` |
| GET | `/api/reports/finance/revenue` | `startDate`, `endDate`, `courseId`, `page`, `limit` | `{ kpis, rows, pagination }` |
| GET | `/api/reports/finance/debts` | `page`, `limit` | `{ kpis, rows, pagination }` |
| GET | `/api/reports/schools/summary` | `page`, `limit` | `{ kpis, rows, pagination }` |
| GET | `/api/reports/gefen/utilization` | — | `{ kpis, rows, pagination, notAvailable, notAvailableReason }` |

**Response shape** (see `lib/reports-types.ts`):

- `kpis`: `{ id, label, value, format? }[]` (format: `number` | `currency` | `percent`)
- `chart?`: `{ labels, series }` (optional; reserved for future charts)
- `rows`: array of row objects
- `pagination`: `{ page, limit, total }`
- `notAvailable?`, `notAvailableReason?`: when module has no data or is disabled

---

## How Filters Work

- **Date range**: `startDate` / `endDate` (ISO date string). Applied to creation date or payment/expense date depending on report.
- **Course**: `courseId` – filter by course (e.g. students in course, revenue for course).
- **Teacher**: `teacherId` – filter by teacher (e.g. students in teacher’s courses, courses taught by teacher). For **teacher** role, the API automatically scopes to the current user’s teacher id; no need to send `teacherId`.
- **School**: `schoolId` – filter courses by school.

For **teacher** role, the UI can hide course/teacher filters and the backend still returns only data for that teacher’s courses.

---

## How to Add a New Report Later

1. **Backend**
   - Add a new report type in `lib/reports-auth.ts` (`ReportType`) and handle it in `requireReportAccess`.
   - Create route under `app/api/reports/...` (e.g. `app/api/reports/operational/myreport/route.ts`).
   - Use `parseReportDates`, `parseReportPagination` from `lib/reports-types.ts` and return `ReportResponse`.

2. **Frontend**
   - Add a card on the reports landing page (`app/dashboard/reports/page.tsx`) linking to the new path.
   - Add a page under `app/dashboard/reports/...` that uses `ReportView` with the correct `apiPath`, `title`, `filters`, and `columns`.

3. **Permissions**
   - If needed, add a permission (e.g. in `lib/permissions.ts`) and map it in `requireReportAccess` and in role presets.

---

## Future: SuperAdmin / Tenant / Plan Gating

The module is designed so that the following can be plugged in with minimal changes:

1. **`requireFeature(featureKey)`** (`lib/reports-auth.ts`)
   - Today: always returns `{ allowed: true }`.
   - Later: resolve from tenant/plan (e.g. `reports.finance`, `reports.schools`, `reports.gefen`) and return `{ allowed: false, reason }` when the plan does not include the feature.

2. **`requireLicenseReadAccess()`**
   - Today: returns allowed.
   - Later: enforce tenant license or read quota.

3. **Tenant resolution**
   - Today: single DB; no tenant id.
   - Later: resolve tenant from request (e.g. header or subdomain), select DB or schema, and run the same report queries in that context. No change to report logic, only to “which DB to query.”

4. **System reports (SuperAdmin-only)**
   - Not implemented. Extension point: add report type `system/*` and in `requireReportAccess` allow only when `session.roleKey === "super_admin"` (or a dedicated SuperAdmin flag). Add routes under `app/api/reports/system/...` and protect them accordingly.

---

## Data Dependencies

- **Operational (students, teachers, courses)**: Tables `Student`, `Teacher`, `Course`, `Enrollment`. Column `Course.teacherIds` (JSONB) for teacher–course relation.
- **Finance revenue**: Table `Payment` (columns: `amount`, `paymentDate`, `paymentType`, `courseId`, `studentId`). Excludes `paymentType` in `('discount', 'credit')`.
- **Finance debts**: Tables `Student`, `Enrollment`, `Course`, `Payment`. “Expected” = sum of course price per active enrollment; “Paid” = sum of payments per student; “Debt” = expected − paid (only rows with balance > 0).
- **Schools summary**: Tables `School`, `Course`, `Enrollment`. Course has `schoolId`; student count per school = distinct students in enrollments for courses of that school.
- **GEFEN utilization**: Placeholder; no tables yet. Returns `notAvailable: true` and a message.

---

## Testing

- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Manual smoke test** (with app running and a logged-in user):

```bash
# Replace COOKIE with a valid session cookie value (e.g. from browser DevTools).
COOKIE="robotics-session=..."

curl -s -H "Cookie: $COOKIE" "http://localhost:3000/api/reports/students?limit=2" | jq .
curl -s -H "Cookie: $COOKIE" "http://localhost:3000/api/reports/teachers?limit=2" | jq .
curl -s -H "Cookie: $COOKIE" "http://localhost:3000/api/reports/courses?limit=2" | jq .
curl -s -H "Cookie: $COOKIE" "http://localhost:3000/api/reports/finance/revenue?limit=2" | jq .
curl -s -H "Cookie: $COOKIE" "http://localhost:3000/api/reports/finance/debts?limit=2" | jq .
curl -s -H "Cookie: $COOKIE" "http://localhost:3000/api/reports/schools/summary?limit=2" | jq .
curl -s -H "Cookie: $COOKIE" "http://localhost:3000/api/reports/gefen/utilization" | jq .
```

Expect: 200 and JSON with `kpis`, `rows`, `pagination`. For GEFEN, `notAvailable: true`.

Without a valid cookie, expect **401 Unauthorized**.
