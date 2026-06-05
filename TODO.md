# System Audit Checklist
> בדיקה דף-דף בשתי המערכות: מאסטר + משנית (Dashboard)
> כל משימה בודקת: ✓ תקינות | ✓ מובייל (המבורגר) | ✓ שפה (HE/EN/AR)

---

## 🔐 מערכת מאסטר (Master Portal)

### Auth
- [x] `/master/login` — דף כניסה עובד | מובייל ✓ | HE/EN ✓ | AR ✓ (v1.1)
  - username: `owner` | password: `Master@12345`

### ניווט ו-Layout
- [x] `app/master/layout.tsx` — Sidebar + Topbar | המבורגר מובייל ✓ | RTL עברית ✓ | LTR אנגלית ✓

### דפים
- [ ] `/master` — Dashboard: ספירת מרכזים, לוג ביקורת אחרון
  - [ ] תקינות: fetch `/api/master/centers` ו-`/api/master/audit`
  - [ ] מובייל: רספונסיבי
  - [ ] שפה: כל הטקסטים מתורגמים HE/EN/AR

- [ ] `/master/centers` — רשימת מרכזים + חיפוש + סינון
  - [ ] תקינות: חיפוש, סינון סטטוס, pagination
  - [ ] מובייל: טבלה גלילה + כפתורים לייצנים
  - [ ] שפה: כותרות עמודות, placeholder חיפוש, כפתורים

- [ ] `/master/centers/new` — יצירת מרכז חדש
  - [ ] תקינות: שני מצבי DB (autoCreate/existingUrl), הצגת תוצאה
  - [ ] מובייל: form רספונסיבי
  - [ ] שפה: כל labels ו-placeholders

- [ ] `/master/centers/[id]` — פרטי מרכז (טאבים)
  - [ ] תקינות: Overview, Admin, Operations, Audit tabs
  - [ ] מובייל: טאבים גלילה אופקית
  - [ ] שפה: כל הכותרות, כפתורים, הודעות

- [ ] `/master/plans` — רשימת תוכניות
  - [ ] תקינות: הצגת features, מחיר, מחיקה עם 409 guard
  - [ ] מובייל: cards רספונסיביים
  - [ ] שפה: מחיר, features, כפתורים

- [ ] `/master/plans/new` — יצירת תוכנית
  - [ ] תקינות: בחירת features, custom feature key
  - [ ] מובייל: checkboxes features
  - [ ] שפה: labels, placeholders

- [ ] `/master/plans/[id]` — עריכת תוכנית
  - [ ] תקינות: שמירת שינויים, toast
  - [ ] מובייל: form רספונסיבי
  - [ ] שפה: labels, כפתורים

- [ ] `/master/licenses` — רשימת רישיונות
  - [ ] תקינות: יצירה (raw key shown once), ביטול
  - [ ] מובייל: טבלה גלילה + raw key copyable
  - [ ] שפה: כותרות, כפתורים

- [ ] `/master/audit` — יומן ביקורת
  - [ ] תקינות: pagination, סינון לפי action, expand details
  - [ ] מובייל: טבלה גלילה
  - [ ] שפה: filter options, כותרות עמודות

- [ ] `/master/ops` — פעולות תפעוליות
  - [ ] תקינות: Run all migrations, Backup all, תצוגת last runs
  - [ ] מובייל: כפתורים פעולה
  - [ ] שפה: כפתורים, הודעות

---

## 📋 מערכת משנית — Dashboard (Tenant)

### Auth
- [x] `/login` — דף כניסה | מובייל ✓ (responsive) | HE/AR/EN ✓

### Layout
- [x] `app/dashboard/layout.tsx` — Sidebar + Mobile hamburger (Menu/X icons) ✓ | RTL HE/AR ✓ | LTR EN ✓ | LanguageSelector בתחתית sidebar ✓

### דפים
- [ ] `/dashboard` — Home/Dashboard
  - [ ] תקינות: stats, quick actions
  - [ ] מובייל: cards רספונסיביים, hamburger ✓
  - [ ] שפה: HE/AR/EN ✓ (דרך useLanguage)

- [ ] `/dashboard/registration` — רישום תלמידים
  - [ ] תקינות: form עובד
  - [ ] מובייל: form רספונסיבי
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/students` — רשימת תלמידים
  - [ ] תקינות: fetch, search, pagination
  - [ ] מובייל: טבלה גלילה / cards
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/students/new` — הוספת תלמיד
  - [ ] תקינות: form submit, validation
  - [ ] מובייל: form רספונסיבי
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/students/[id]` — פרופיל תלמיד
  - [ ] תקינות: פרטים, קורסים, תשלומים
  - [ ] מובייל: tabs גלילה
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/students/[id]/edit` — עריכת תלמיד
  - [ ] תקינות: שמירה
  - [ ] מובייל: form
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/teachers` — רשימת מורים
  - [ ] תקינות: fetch
  - [ ] מובייל: טבלה/cards
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/teachers/new` — הוספת מורה
  - [ ] תקינות: form
  - [ ] מובייל: form
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/teachers/[id]` — פרופיל מורה
  - [ ] תקינות: פרטים, קורסים
  - [ ] מובייל: responsive
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/teachers/[id]/edit` — עריכת מורה
  - [ ] תקינות: שמירה
  - [ ] מובייל: form
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/courses` — רשימת קורסים
  - [ ] תקינות: fetch, filter
  - [ ] מובייל: cards/טבלה
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/courses/new` — הוספת קורס
  - [ ] תקינות: form
  - [ ] מובייל: form
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/courses/[id]` — פרטי קורס
  - [ ] תקינות: תלמידים, מורה, לוח שנה
  - [ ] מובייל: responsive
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/courses/[id]/edit` — עריכת קורס
  - [ ] תקינות: שמירה
  - [ ] מובייל: form
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/schools` — בתי ספר
  - [ ] תקינות: fetch
  - [ ] מובייל: cards
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/schools/new` / `[id]` / `[id]/edit`
  - [ ] תקינות: CRUD
  - [ ] מובייל: form/cards
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/gafan` — תוכניות גפ"ן
  - [ ] תקינות: fetch
  - [ ] מובייל: responsive
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/gafan/new` / `[id]` / `[id]/edit`
  - [ ] תקינות: CRUD
  - [ ] מובייל: form
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/cashier` — קופה
  - [ ] תקינות: תשלומים, הוצאות
  - [ ] מובייל: cards/טבלה
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/registration` — רישום
  - [ ] תקינות: workflow
  - [ ] מובייל: steps/form
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/attendance` — נוכחות
  - [ ] תקינות: mark attendance
  - [ ] מובייל: responsive grid
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/schedule` — לוח זמנים
  - [ ] תקינות: calendar/grid
  - [ ] מובייל: mobile calendar
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/users` — ניהול משתמשים
  - [ ] תקינות: CRUD users, roles
  - [ ] מובייל: טבלה/cards
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/settings` — הגדרות
  - [ ] תקינות: שמירת הגדרות מרכז
  - [ ] מובייל: form
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/reports` — דוחות ראשי
  - [ ] תקינות: ניווט לדוחות
  - [ ] מובייל: cards
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/reports/students` — דוח תלמידים
  - [ ] תקינות: נתונים, export
  - [ ] מובייל: טבלה גלילה
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/reports/teachers` — דוח מורים
  - [ ] תקינות: נתונים
  - [ ] מובייל: responsive
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/reports/courses` — דוח קורסים
  - [ ] תקינות: נתונים
  - [ ] מובייל: responsive
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/reports/finance/revenue` — הכנסות
  - [ ] תקינות: גרפים, נתונים
  - [ ] מובייל: charts responsive
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/reports/finance/debts` — חובות
  - [ ] תקינות: רשימת חייבים
  - [ ] מובייל: responsive
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/reports/schools/summary` — דוח בתי ספר
  - [ ] תקינות: נתונים
  - [ ] מובייל: responsive
  - [ ] שפה: HE/AR/EN

- [ ] `/dashboard/reports/gefen/utilization` — ניצול גפ"ן
  - [ ] תקינות: נתונים
  - [ ] מובייל: responsive
  - [ ] שפה: HE/AR/EN

---

## 🚀 Production — VPS Port 9030

- [x] `Dockerfile` — multi-stage build
- [x] `docker-compose.production.yml` — port 9030 + postgres
- [x] `.env.production.example` — template
- [x] `scripts/deploy.sh` — deploy to VPS
- [ ] `npm run build` passes without errors
- [ ] Health check: `GET /api/health` returns 200
- [ ] Session cookie Secure=true in production
- [ ] DATABASE_URL points to production DB
- [ ] BASE_DOMAIN set correctly for subdomain routing

---

## ✅ סיכום תיקונים שבוצעו

| תיקון | סטטוס |
|---|---|
| Master portal hamburger מובייל | ✅ בוצע |
| Master portal — ערבית (AR) | ✅ בוצע |
| Dashboard hamburger מובייל | ✅ קיים מלכתחילה |
| Dashboard HE/AR/EN | ✅ קיים מלכתחילה |
| Dockerfile + docker-compose.production.yml | ✅ בוצע |
| deploy.sh לפורט 9030 | ✅ בוצע |
| Migration phase16 מסד נתונים | ✅ בוצע |
| Bug: plan.monthly_price.toFixed | ✅ תוקן |
| Bug: audit key prop | ✅ תוקן |
| Master login redirect loop | ✅ תוקן |
