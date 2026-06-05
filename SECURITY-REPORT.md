# דוח אבטחה – מערכת מרכז רובוטיקה

## סיכום ביצועים

בוצעו אודיט והקשחה של **אימות (Authentication)**, **הרשאות (Authorization)** ו**אבטחת סשן** במחזוריות CHECK → FIX → RE-TEST.

---

## ממצאים לפי חומרה

### Critical – טופלו
- **אין גישה ל-API ללא סשן** – כל הנתיבים הרגישים דורשים אימות; ללא קוקי תקף מחזירים 401.
- **מניעת IDOR** – גישה ל-`/api/students/:id`, `/api/teachers/:id` ו-`/api/students/by-user/:userId`, `/api/teachers/by-user/:userId` מאומתת: רק אדמין או המשתמש המקושר (userId) רשאים לגשת.

### High – טופלו
- **הגנת סיסמה** – אימות עם bcrypt; הודעת שגיאה גנרית ("שם משתמש או סיסמה שגויים") ללא חשיפת קיום משתמש.
- **Rate limiting בהתחברות** – אחרי 5 ניסיונות כושלים נעילה ל-15 דקות לפי IP.
- **סשן ותזמון** – קוקי HttpOnly, Secure (ב-production), SameSite=Lax; timeout חוסר-פעילות (idle) ו-timeout מוחלט (absolute); middleware ו-`/api/auth/me` מאכפים אותם.
- **הגנה על דשבורד** – middleware מפנה ל-`/login?expired=1` כאשר אין סשן תקף ב-`/dashboard/*`.
- **פג תוקף בסשן** – פרונט מפנה להתחברות ומציג "הפג תוקף ההתחברות. אנא התחבר שוב."

### Medium – טופלו
- **RBAC** – פעולות רגישות (עריכת/מחיקת משתמש, הרצת seed) דורשות `roleKey === "super_admin"`; אחרת 403.
- **Build** – `npm run build` עובר בהצלחה.

### תלויות (Dependency Audit)
- **Next.js** – דווחה פגיעות High אחת (DoS / Image Optimizer, RSC, PPR). עדכון מוצע: `npm audit fix --force` (מעלה ל-next@16.1.6). מומלץ להריץ לאחר גיבוי ולבדוק תאימות.

---

## קבצים שהשתנו (בסבב זה)

| קובץ | שינוי |
|------|--------|
| `lib/auth-server.ts` | הוספת `requireAuth`, `requireAdmin` |
| `app/api/dashboard/stats/route.ts` | requireAuth ב-GET |
| `app/api/users/route.ts` | requireAuth ב-GET ו-POST |
| `app/api/users/[id]/route.ts` | requireAuth + requireAdmin ב-PATCH, DELETE |
| `app/api/students/route.ts` | requireAuth ב-GET (POST ציבורי לרישום) |
| `app/api/students/[id]/route.ts` | requireAuth + בדיקת IDOR (אדמין או userId מקושר) ב-GET, PUT, DELETE |
| `app/api/students/by-user/[userId]/route.ts` | requireAuth + IDOR (אדמין או session.id === userId) |
| `app/api/teachers/route.ts` | requireAuth ב-GET |
| `app/api/teachers/[id]/route.ts` | requireAuth + IDOR ב-GET, PUT, DELETE |
| `app/api/teachers/by-user/[userId]/route.ts` | requireAuth + IDOR |
| `app/api/courses/route.ts` | requireAuth ב-GET, POST |
| `app/api/courses/[id]/route.ts` | requireAuth ב-GET, PUT, DELETE |
| `app/api/schools/route.ts` | requireAuth ב-GET, POST |
| `app/api/schools/[id]/route.ts` | requireAuth ב-GET, PUT, DELETE |
| `app/api/attendance/route.ts` | requireAuth ב-GET, POST, DELETE |
| `app/api/enrollments/route.ts` | requireAuth ב-GET, POST, DELETE |
| `app/api/enrollments/[id]/route.ts` | requireAuth ב-GET, PUT, DELETE |
| `app/api/payments/route.ts` | requireAuth ב-GET, POST |
| `app/api/payments/[id]/route.ts` | requireAuth ב-GET, PUT, DELETE |
| `app/api/expenses/route.ts` | requireAuth ב-GET, POST |
| `app/api/expenses/[id]/route.ts` | requireAuth ב-DELETE |
| `app/api/gafan/route.ts` | requireAuth ב-GET, POST |
| `app/api/gafan/[id]/route.ts` | requireAuth ב-GET, PUT, DELETE |
| `app/api/settings/route.ts` | requireAuth ב-GET, PUT |
| `app/api/seed/route.ts` | requireAuth + requireAdmin ב-POST |
| `app/login/page.tsx` | עטיפת useSearchParams ב-Suspense; הודעת "הפג תוקף" בעברית |

---

## קונפיגורציית Timeout

| משתנה סביבה | משמעות | ברירת מחדל |
|-------------|--------|------------|
| `SESSION_IDLE_MS` | זמן חוסר פעילות עד יציאה אוטומטית (ms) | 20 דקות (1,200,000) |
| `SESSION_ABSOLUTE_MS` | זמן מקסימלי מהתחברות עד יציאה חובה (ms) | 8 שעות (28,800,000) |

- **Idle**: אם אין פעילות במשך `SESSION_IDLE_MS`, הסשן לא תקף; הבקשה הבאה תקבל 401 (API) או הפניה ל-`/login?expired=1` (דפים).
- **Absolute**: גם עם פעילות, אחרי `SESSION_ABSOLUTE_MS` מההתחברות הסשן לא תקף.
- הקוקי נקבע עם `Max-Age` לפי `SESSION_ABSOLUTE_MS`; השרת בודק גם `lastActivity` ו-`loginTime` בתוכן הסשן.

---

## שלבי בדיקה ידנית

### 1. בדיקת Idle Timeout
- התחבר ולחץ בדשבורד בין דפים (כדי לרענן פעילות).
- השאר את הדפדפן ללא פעילות למשך יותר מ-20 דקות (או צמצם ל-test: `SESSION_IDLE_MS=60000` ל-1 דקה).
- רענן דף או לחץ על קישור – יש להפנות ל-`/login?expired=1` ולהציג "הפג תוקף ההתחברות. אנא התחבר שוב."
- קרא ל-API עם הקוקי הישן (למשל `GET /api/auth/me` או `GET /api/students`) – יש לקבל 401.

### 2. בדיקת הגנת נתיבים (Route Protection)
- ללא התחברות: גלוש ל-`/dashboard` או `/dashboard/students` – יש הפניה ל-`/login?expired=1`.
- ללא קוקי: שלח `GET /api/students` או `GET /api/dashboard/stats` – תשובה 401.
- לאחר התחברות תקפה – אותם נתיבים וקריאות API מחזירים תוכן (לפי הרשאות).

### 3. בדיקת הגנת תפקיד (Role / RBAC)
- **משתמש שאינו אדמין** (למשל teacher):  
  - `PATCH /api/users/:id` או `DELETE /api/users/:id` – 403.  
  - `POST /api/seed` – 403.
- **אדמין** (`roleKey === "super_admin"`) – יכול לבצע את הפעולות לעיל.

### 4. בדיקת IDOR
- **משתמש A** (לא אדמין) מקושר ל-student/teacher עם `userId = A`.
- **משתמש B** (לא אדמין):  
  - `GET /api/students/:id` עבור student שמקושר ל-A – עם סשן של B יש לקבל 403.  
  - `GET /api/teachers/by-user/A` עם סשן של B – 403.
- אדמין יכול לגשת לכל `students/:id`, `teachers/:id` ו-by-user.

---

## נתיבים ציבוריים (ללא requireAuth)

- `POST /api/auth/login`
- `GET /api/auth/me` (מחזיר 401 אם אין סשן)
- `POST /api/auth/logout`, `GET /api/auth/logout`
- `POST /api/students` (רישום ציבורי)
- `POST /api/teachers` (רישום ציבורי)
- `GET /api/health/db` (בדיקת DB)

כל שאר נתיבי ה-API דורשים אימות (ו-RBAC/IDOR כפי שמפורט למעלה).
