# CLAUDE.md — Robotics Center SaaS

## Project Overview

Multi-tenant SaaS for managing robotics learning centers.
Built with Next.js 16, React 19, Prisma, PostgreSQL, Tailwind CSS v4, Radix UI, Zod, SWR.

**Architecture**: Tenant-per-database. One master DB (SaaS control plane) + one DB per center.
**Routing**: Wildcard subdomains → extract center slug → lookup tenant DB.
**Portals**: `/master/*` (super admin) + `/dashboard/*` (per-center tenant).

---

## Non-Negotiable Rules

### 1. Never break RTL / i18n
- The app supports **Hebrew (RTL), Arabic (RTL), English (LTR)**.
- Every UI change must work correctly in all three languages.
- Use `dir="rtl"` / `dir="ltr"` patterns already in the codebase — do not hardcode direction.
- Text must come from the translation layer — no hardcoded Hebrew/Arabic/English strings in JSX.

### 2. TypeScript strict — no `any`
- All new and modified code must be properly typed.
- No `as any`, no untyped function parameters, no implicit `any`.
- Reuse existing types from `lib/` and `prisma/` — do not duplicate.

### 3. Mobile-first
- Every UI change must be responsive.
- Test mentally for: hamburger nav, table scroll, form layout, button sizing on small screens.

### 4. Do NOT touch DB Schema
- No changes to `prisma/schema.prisma` or migration files without explicit user approval.
- The DB is live and deployed on a remote production server.

### 5. Absolutely no data deletion
- Never write code that deletes production data.
- Avoid any SQL `DELETE` or Prisma `deleteMany` / `delete` calls unless the user explicitly authorizes.
- For "soft" operations use status flags that already exist in the schema.

---

## Environment

- **DB**: Remote PostgreSQL (production/staging) — not a local Docker instance.
- **Deployment**: System is live on a server with Git. Changes go through Git.
- **Dev server**: `pnpm dev` or `npm run dev` (Next.js 16).
- **Env vars**: See `.env.example` — copy to `.env.local` with real remote DB credentials.

---

## Deployment Workflow — After Every Change

**After every completed fix or feature, always deploy:**

1. **Commit** the changes with a descriptive message.
2. **Push to GitHub**:
   ```bash
   git push origin main
   ```
3. **Deploy to production server** (the user runs this, or via SSH if key is available):
   ```bash
   ssh root@147.93.123.132
   cd /var/www/robotics-center
   git pull origin main
   pm2 restart all
   ```

> **Rule**: Never leave a session without pushing + prompting the user to deploy.
> The user explicitly requested this as a standing workflow after every change.

---

## Current Focus

**Bug fixing** across both portals equally:
- Master Portal (`/master/*`) — center management, plans, licenses, audit log.
- Tenant Dashboard (`/dashboard/*`) — students, teachers, courses, payments, attendance, reports.

Reference `TODO.md` and `QA.md` for known issues and audit checklist.

---

## Key Directories

| Path | Purpose |
|------|---------|
| `app/master/` | Super admin portal pages |
| `app/dashboard/` | Tenant portal pages |
| `app/api/` | API routes (Next.js Route Handlers) |
| `components/` | Shared UI components |
| `lib/` | Utilities, auth, tenant resolution, feature gating |
| `prisma/` | Schema + migrations |
| `hooks/` | Custom React hooks |
| `scripts/` | Dev/ops scripts |

---

## Patterns to Follow

- **API routes**: Check existing routes in `app/api/` before adding new ones.
- **Feature gating**: Use `requireFeature(featureKey)` for plan-based access control.
- **Tenant context**: Always resolve tenant DB via the existing middleware/lib — never bypass.
- **Forms**: `react-hook-form` + `zod` resolver — match existing form patterns.
- **Toasts**: Use `sonner` (`toast.success`, `toast.error`) — already wired up.
- **Data fetching**: Prefer `swr` for client-side fetching — matches the rest of the codebase.

---

## Business Logic: Teacher Hours & Gafan System

### שני מקורות שעות למורה
מורה יכול לצבור שעות מ-**שני מקורות שונים**, ושניהם חייבים להופיע בכרטסת שלו:

#### 1. מרכז — שעות רגילות
- המורה מסמן נוכחות תלמידים בקורס → המערכת **אוטומטית** יוצרת שורת נוכחות למורה.
- מקור הנתונים: טבלת `Attendance` (שורות עם `teacherId`, `studentId = NULL`).
- API: `GET /api/attendance?teacherId=<id>`

#### 2. בית ספר — תוכנית גפ"ן
- המורה משובץ לבית ספר תחת תוכנית גפ"ן (מימון ממשלתי).
- **הכנסת שעות ידנית** בדף בית הספר (לא אוטומטית מנוכחות).
- מקור הנתונים: `GafanSchoolLink.hourRows` — מערך JSON של שורות שעות לכל מורה בכל בית ספר.
- API: `GET /api/gafan` → מחזיר **כל** תוכניות הגפ"ן עם כל הקישורים לבתי ספר.
- הסינון לפי מורה ספציפי מתבצע **בצד הלקוח** ב-`teacherSchoolAttendanceRows` (דף המורה).

### כרטסת המורה (`/dashboard/teachers/[id]`)
בטאב **נוכחות** יש שני סאב-טאבים:
- **רגיל** — שעות מרכז מ-`/api/attendance?teacherId=...`
- **גפ"ן** — שעות בתי ספר מ-`/api/gafan` (מסוננות client-side לפי teacherId/name)

### מבנה נתוני גפ"ן
```
Gafan (תוכנית)
  └── GafanSchoolLink (קישור לבית ספר — אחד לכל בית ספר)
        ├── schoolId
        ├── teacherIds[]     — מורים משובצים
        ├── teacherRates{}   — תעריף לכל מורה
        └── hourRows[]       — שורות שעות שהוכנסו ידנית
              ├── date, startTime, endTime, totalHours
              ├── teacherId   — מזהה המורה (ייתכן חסר בשורות ישנות)
              └── teacherName — שם המורה (fallback לזיהוי)
```

### כלל זיהוי שורת שעות לפי מורה (client-side)
```
belongs = belongsById      // rowTeacherId === teacherIdStr
       || belongsByName    // שם מנורמל תואם
       || belongsBySingleAssignedFallback  // אין teacherId + זהו המורה היחיד בתוכנית
```

### נקודות רגישות וBugs ידועים שתוקנו
- `ensureGafanLinkColumns` רץ 16 DDL/DML בכל GET — תוקן עם WeakSet cache.
- אם בית ספר מסוים לא מופיע בכרטסת המורה — לרוב timeout ב-`/api/gafan` שמחזיר נתונים חלקיים.
- `ensureAttendanceCampColumns`, `ensureAttendanceHourKindColumn`, `ensureTeacherTariffTables`, `backfillCampTeacherRowsIfMissing` — כולם עם WeakSet/WeakMap cache.

---

## What NOT to Do

- Do not add new dependencies without asking.
- Do not refactor working code while fixing a bug — fix only what is broken.
- Do not remove existing translations or i18n keys.
- Do not add `console.log` statements to production code.
- Do not create new MD/README files unless asked.
