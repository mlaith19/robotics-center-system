# תוכנית QA מלאה — Robotics Center System
> לפני כל עלייה לProduction. עבור דף-דף. שמור את המסמך הזה פתוח תוך כדי בדיקה.

---

## PHASE 0 — תנאי פתיחה (Gate — חייבים לעבור לפני הכל)

```bash
# 0.1 — הפעל DB
npm run db:up
# ודא שני DBים:
# robotics (master), center1 (tenant)

# 0.2 — הפעל dev
DEFAULT_DEV_CENTER=center1 npm run dev

# 0.3 — seed לטננט
node scripts/seed-demo-tenant.js center1 --clear --i-know-this-is-dev

# 0.4 — Gate checks
npm run build                       # חייב לעבור ללא שגיאות
node scripts/self-check/run-all.js  # חייב לעבור
node scripts/qa-check.js            # חייב לעבור
```

### ✅ Gate checklist
- [ ] `npm run build` — אין TypeScript / ESLint errors קריטיים
- [ ] `run-all.js` — כל phases עוברים
- [ ] `qa-check.js` — כל endpoints מחזירים 200
- [ ] DB: קיים `robotics` + `center1`
- [ ] Tenant seed: נטען, אין שגיאות בטרמינל
- [ ] כניסה ל-`/login` מצליחה
- [ ] אין "בודק הרשאות" תקוע לאדמין

---

## PHASE 1 — Tenant: Login & Shell

### דפים
| דף | URL | סטטוס |
|---|---|---|
| Home / redirect | `/` | [ ] |
| Login | `/login` | [ ] |
| Change password | `/login/change-password` | [ ] |

### בדיקות חובה — כל דף
- [ ] אין שגיאות בקונסול (F12 → Console)
- [ ] אין spinner אינסופי (מקסימום 3 שניות)
- [ ] הודעות שגיאה ברורות (toast / alert) בניסיון כניסה שגוי
- [ ] RTL תקין: טקסט + inputs מיושרים לימין
- [ ] לחיצה על "כניסה" ללא פרטים: validation מופיע

### מובייל — חובה לכל 3 ברזולוציות
| ברזולוציה | `/login` | `/login/change-password` |
|---|---|---|
| 360×800 | [ ] | [ ] |
| 390×844 (iPhone) | [ ] | [ ] |
| 768×1024 (iPad) | [ ] | [ ] |

- [ ] אין גלילה אופקית
- [ ] Input fields לא נחתכים
- [ ] כפתור "כניסה" נגיש (min-height 44px)
- [ ] המבורגר מופיע ב-mobile

### כניסות לבדיקה
```
Admin:   admin / [הסיסמה שהוגדרה בסיד]
Student: student1 / [password מהסיד]
Teacher: teacher1 / [password מהסיד]
```

---

## PHASE 2 — Tenant: Dashboard (לוח בקרה)

### דפים
| דף | URL | סטטוס |
|---|---|---|
| Dashboard | `/dashboard` | [ ] |

### בדיקות
- [ ] נטען תוך פחות מ-2 שניות
- [ ] כל widgets מציגים מספר תקין (לא NaN / undefined)
- [ ] API calls: בדוק Network tab — כולם 200 (לא 403/500)
- [ ] אין re-render בלופ (Component renders counter)
- [ ] אין console errors

### מובייל
- [ ] Cards נערמים כ-1 עמודה ב-360px
- [ ] גרפים לא חורגים מהמסך
- [ ] תפריט המבורגר פותח ומציג ניווט תקין

---

## PHASE 3 — Tenant: Students (CRUD מלא)

### דפים
| דף | URL | סטטוס |
|---|---|---|
| רשימה | `/dashboard/students` | [ ] |
| יצירה | `/dashboard/students/new` | [ ] |
| פרטים | `/dashboard/students/[id]` | [ ] |
| עריכה | `/dashboard/students/[id]/edit` | [ ] |

### בדיקות CRUD
- [ ] **List**: נטען, מציג תלמידים מהסיד
- [ ] **Search**: חיפוש לפי שם עובד
- [ ] **Create**: יצירת תלמיד חדש — נשמר ומופיע ברשימה
- [ ] **View**: כניסה לדף תלמיד — כל הפרטים מוצגים
- [ ] **Edit**: שינוי שם/פרטים — נשמר, toast "נשמר בהצלחה"
- [ ] **Delete**: מחיקה + confirm dialog + toast + נעלם מרשימה

### בדיקות קצה
- [ ] שם בעברית: "יוסי כהן" — נשמר ומוצג נכון
- [ ] שם בערבית: "محمد علي" — נשמר ומוצג נכון (RTL)
- [ ] שם באנגלית: "John Smith" — נשמר ומוצג נכון (LTR)
- [ ] שדה ריק: validation error מופיע

### מובייל
- [ ] **360px**: רשימת תלמידים usable (cards או scroll-x מבוקר)
- [ ] **טופס יצירה**: label מעל input, לא חתוך
- [ ] **כפתורי CRUD**: min-height 44px לפחות
- [ ] **פרטי תלמיד**: tabs נגישים בנייד

---

## PHASE 4 — Tenant: Teachers (CRUD מלא)

### דפים
| דף | URL | סטטוס |
|---|---|---|
| רשימה | `/dashboard/teachers` | [ ] |
| יצירה | `/dashboard/teachers/new` | [ ] |
| פרטים | `/dashboard/teachers/[id]` | [ ] |
| עריכה | `/dashboard/teachers/[id]/edit` | [ ] |

### בדיקות CRUD + קצה
- [ ] List + Search
- [ ] Create מורה חדש
- [ ] View — פרטים, קורסים משויכים
- [ ] Edit + Save
- [ ] Delete + Confirm

### Login כמורה
- [ ] כניסה כמורה: רואה רק דפים מורשים
- [ ] לא רואה Students / Users / Settings

### מובייל
- [ ] זהה ל-Phase 3

---

## PHASE 5 — Tenant: Courses + Enrollments

### דפים
| דף | URL | סטטוס |
|---|---|---|
| רשימה | `/dashboard/courses` | [ ] |
| יצירה | `/dashboard/courses/new` | [ ] |
| פרטים | `/dashboard/courses/[id]` | [ ] |
| עריכה | `/dashboard/courses/[id]/edit` | [ ] |

### בדיקות
- [ ] יצירת קורס + שיוך קטגוריה (אם קיים)
- [ ] שיוך מורה לקורס
- [ ] הרשמת תלמיד לקורס (enrollment)
- [ ] הסרת תלמיד מקורס
- [ ] **קצה**: קורס ללא מורה — לא קורס
- [ ] **קצה**: קורס ללא תלמידים — מוצג "0 תלמידים" תקין

### מובייל
- [ ] טופס יצירת קורס — 100% usable
- [ ] Tabs/sections בדף קורס לא נשברים
- [ ] רשימת תלמידים בקורס — scroll-x או cards

---

## PHASE 6 — Tenant: Schools

### דפים
| דף | URL | סטטוס |
|---|---|---|
| רשימה | `/dashboard/schools` | [ ] |
| יצירה | `/dashboard/schools/new` | [ ] |
| פרטים | `/dashboard/schools/[id]` | [ ] |
| עריכה | `/dashboard/schools/[id]/edit` | [ ] |

### בדיקות
- [ ] CRUD מלא
- [ ] קשרים: תלמידים / קורסים לפי בית ספר (אם קיים)

### מובייל
- [ ] טבלה → cards או responsive table

---

## PHASE 7 — Tenant: GAFAN (תוכניות גפ"ן)

### דפים
| דף | URL | סטטוס |
|---|---|---|
| רשימה | `/dashboard/gafan` | [ ] |
| יצירה | `/dashboard/gafan/new` | [ ] |
| פרטים | `/dashboard/gafan/[id]` | [ ] |
| עריכה | `/dashboard/gafan/[id]/edit` | [ ] |

### בדיקות
- [ ] CRUD מלא
- [ ] שדות תקציב/ניצול מוצגים נכון (מספרים, לא NaN)
- [ ] **קצה**: ערך 0 — מוצג "0" לא ריק
- [ ] **קצה**: ערך גדול (1,000,000) — לא חורג מהעיצוב

### מובייל
- [ ] ערכים כספיים לא נחתכים

---

## PHASE 8 — Tenant: Payments / Cashier

### דפים
| דף | URL | סטטוס |
|---|---|---|
| קופה | `/dashboard/cashier` | [ ] |

### בדיקות
- [ ] הוספת תשלום לתלמיד
- [ ] צפייה בהיסטוריית תשלומים
- [ ] ולידציה: סכום שלילי → error
- [ ] ולידציה: תאריך לא תקין → error
- [ ] דוחות חוב/זיכוי (אם קיים)

### מובייל
- [ ] כפתור "הוסף תשלום" נגיש
- [ ] טבלת תשלומים קריאה (scroll-x)

---

## PHASE 9 — Tenant: Attendance (נוכחות)

### דפים
| דף | URL | סטטוס |
|---|---|---|
| נוכחות | `/dashboard/attendance` | [ ] |

### בדיקות
- [ ] סימון נוכחות לתלמיד/קורס
- [ ] סינון לפי תאריך (אם קיים)
- [ ] סינון לפי קורס (אם קיים)
- [ ] שמירה ורענון — הסימון נשמר

### מובייל
- [ ] Checkboxes / tap targets לפחות 44×44px
- [ ] רשימת תלמידים scroll תקין

---

## PHASE 10 — Tenant: Registration (רישום)

### דפים
| דף | URL | סטטוס |
|---|---|---|
| רישום | `/dashboard/registration` | [ ] |

### בדיקות
- [ ] יצירת רישום חדש
- [ ] **קצה**: תלמיד כפול — שגיאה ברורה
- [ ] **קצה**: שדות חסרים — validation
- [ ] הצלחה: toast "נרשם בהצלחה"

### מובייל
- [ ] טופס רישום קריא ונוח

---

## PHASE 11 — Tenant: Schedule (לוח זמנים)

### דפים
| דף | URL | סטטוס |
|---|---|---|
| לוח זמנים | `/dashboard/schedule` | [ ] |

### בדיקות
- [ ] תצוגת לוח זמנים נטענת
- [ ] יצירת/עריכת שיעור (אם קיים)
- [ ] פילטרים לפי קורס/מורה (אם קיים)
- [ ] אין crash ב-view ריק (ללא שיעורים)

### מובייל
- [ ] Calendar/Agenda view לא נשבר
- [ ] ב-360px: תצוגת "agenda" רצויה על "weekly grid"

---

## PHASE 12 — Tenant: Reports (דוחות)

### דפים
| דף | URL | סטטוס |
|---|---|---|
| ראשי | `/dashboard/reports` | [ ] |
| תלמידים | `/dashboard/reports/students` | [ ] |
| מורים | `/dashboard/reports/teachers` | [ ] |
| קורסים | `/dashboard/reports/courses` | [ ] |
| הכנסות | `/dashboard/reports/finance/revenue` | [ ] |
| חובות | `/dashboard/reports/finance/debts` | [ ] |
| בתי ספר | `/dashboard/reports/schools/summary` | [ ] |
| גפ"ן | `/dashboard/reports/gefen/utilization` | [ ] |

### בדיקות — כל דוח
- [ ] נטען ללא שגיאות
- [ ] פילטרים עובדים (תאריך / קטגוריה)
- [ ] סכומים: sanity check (לא 0 אחרי seed)
- [ ] Export CSV/PDF — לא קורס (אם קיים)

### מובייל
- [ ] כל טבלת דוח: scroll-x מבוקר או cards
- [ ] פילטרים בראש הדף — לא נחתכים
- [ ] אין overflow-x

---

## PHASE 13 — Tenant: Users (ניהול משתמשים)

### דפים
| דף | URL | סטטוס |
|---|---|---|
| משתמשים | `/dashboard/users` | [ ] |

### בדיקות
- [ ] רשימת משתמשים נטענת
- [ ] יצירת משתמש חדש (אם קיים)
- [ ] שינוי תפקיד
- [ ] Reset password flow
- [ ] הגבלת הרשאה: User רגיל לא רואה דף זה

### מובייל
- [ ] טבלה/cards תקינים

---

## PHASE 14 — Tenant: Settings (הגדרות)

### דפים
| דף | URL | סטטוס |
|---|---|---|
| הגדרות | `/dashboard/settings` | [ ] |

### בדיקות
- [ ] הגדרות נטענות
- [ ] שינוי שם מרכז + שמירה → מתעדכן ב-sidebar
- [ ] בחירת שפה (he/ar/en) → UI מתחלף
- [ ] Logo/תמונה upload (אם קיים)

### מובייל
- [ ] Sections לא נשברים
- [ ] כפתורי שמירה נגישים

---

## PHASE 15 — Master Portal

### דפים
| דף | URL | סטטוס |
|---|---|---|
| Login | `/master/login` | [ ] |
| Dashboard | `/master` | [ ] |
| Centers | `/master/centers` | [ ] |
| New center | `/master/centers/new` | [ ] |
| Center detail | `/master/centers/[id]` | [ ] |
| Plans | `/master/plans` | [ ] |
| Licenses | `/master/licenses` | [ ] |
| Audit | `/master/audit` | [ ] |
| Ops | `/master/ops` | [ ] |

### אבטחה (חובה)
- [ ] גישה ל-`/master` ללא session → redirect `/master/login`
- [ ] גישה ל-`/api/master/centers` ללא session → `401`
- [ ] Tenant user (admin) → `/master` → `403` או redirect

### Master Login
```
Username: owner
Password: Master@12345
```

### בדיקות CRUD
- [ ] יצירת מרכז חדש (autoCreate)
- [ ] Lock / Unlock מרכז → הודעת toast
- [ ] יצירת תוכנית + features
- [ ] יצירת license key — raw key מוצג פעם אחת
- [ ] ביטול license
- [ ] Audit logs נרשמים אחרי כל פעולה

### שפות (Master)
- [ ] עברית (ברירת מחדל) — RTL תקין
- [ ] ערבית — RTL תקין
- [ ] אנגלית — LTR תקין
- [ ] מעבר שפה: כפתור מחזורי עב→ع→EN→עב

### מובייל
| דף | 360px | 390px | 768px |
|---|---|---|---|
| `/master/login` | [ ] | [ ] | [ ] |
| `/master` | [ ] | [ ] | [ ] |
| `/master/centers` | [ ] | [ ] | [ ] |
| `/master/plans` | [ ] | [ ] | [ ] |
| `/master/audit` | [ ] | [ ] | [ ] |

- [ ] המבורגר מופיע ב-mobile
- [ ] Sidebar נפתח/נסגר
- [ ] Overlay שחור סוגר את ה-sidebar בלחיצה
- [ ] טבלאות: scroll-x מבוקר

---

## PHASE 16 — Production Rehearsal

```bash
# בנה
npm run build

# הרץ בproduction mode
npm start
# (או: NODE_ENV=production PORT=9030 npm start)

# בדוק health endpoints
curl http://localhost:9030/api/health
curl http://localhost:9030/api/health/db
curl http://localhost:9030/api/health/ready
```

### Health Endpoints
| Endpoint | קוד צפוי | בדיקה |
|---|---|---|
| `/api/health` | `200 {"status":"ok"}` | [ ] |
| `/api/health/db` | `200 {"status":"ok","db":"connected"}` | [ ] |
| `/api/health/ready` | `200 {"ready":true}` | [ ] |

### 5 דפים אקראיים בטננט
- [ ] `/dashboard` → 200, no console errors
- [ ] `/dashboard/students` → 200, data loads
- [ ] `/dashboard/courses` → 200, data loads
- [ ] `/dashboard/cashier` → 200, no errors
- [ ] `/master` → 200 (עם session) / redirect (ללא)

### Mobile Final Checklist (כל דף שעבר QA)
- [ ] אין `overflow-x` לא מכוון
- [ ] כפתורי פעולה: min-height 44px
- [ ] Inputs: label מעל input בנייד
- [ ] טבלאות: `overflow-x-auto` עם wrapper
- [ ] Dialogs/Modals: לא חורגים מהמסך
- [ ] Font size לא מתחת ל-14px בנייד

---

## Mobile Audit Matrix (מילוי סופי)

| קטגוריה | דף | overflow-x | tap 44px | label→input | table OK | modal OK |
|---|---|---|---|---|---|---|
| Auth | `/login` | [ ] | [ ] | [ ] | — | — |
| Dashboard | `/dashboard` | [ ] | [ ] | — | [ ] | — |
| Students | `/dashboard/students` | [ ] | [ ] | [ ] | [ ] | [ ] |
| Students | `/dashboard/students/new` | [ ] | [ ] | [ ] | — | — |
| Teachers | `/dashboard/teachers` | [ ] | [ ] | [ ] | [ ] | [ ] |
| Courses | `/dashboard/courses` | [ ] | [ ] | [ ] | [ ] | [ ] |
| Cashier | `/dashboard/cashier` | [ ] | [ ] | [ ] | [ ] | — |
| Attendance | `/dashboard/attendance` | [ ] | [ ] | — | [ ] | — |
| Reports | `/dashboard/reports/finance/revenue` | [ ] | [ ] | — | [ ] | — |
| Master | `/master/centers` | [ ] | [ ] | [ ] | [ ] | [ ] |
| Master | `/master/audit` | [ ] | [ ] | — | [ ] | — |

---

## איך לעבוד עם זה בפועל

### עבור כל Phase, ב-Cursor תכתוב:
```
WAR MODE — QA Phase [X] — [שם הדף/פיצ'ר]
שגיאה שמצאת: [תיאור מדויק + screenshot/console output]
```

### דוגמאות לפרומפטים:
```
WAR MODE — QA Phase 3 — Students table breaks on mobile 360px, overflow-x visible
```
```
WAR MODE — QA Phase 8 — Cashier: adding payment returns 500, console: "column amount not found"
```
```
WAR MODE — QA Phase 15 — Master audit table overflows on 390px iPhone
```

### כלל ברזל:
> **אל תמשיך ל-Phase הבא לפני שה-Gate של ה-Phase הנוכחי עבר.**

---

## סטטוס כולל

| Phase | שם | סטטוס |
|---|---|---|
| 0 | Gate / Environment | ⏳ |
| 1 | Login & Shell | ⏳ |
| 2 | Dashboard | ⏳ |
| 3 | Students | ⏳ |
| 4 | Teachers | ⏳ |
| 5 | Courses | ⏳ |
| 6 | Schools | ⏳ |
| 7 | GAFAN | ⏳ |
| 8 | Cashier | ⏳ |
| 9 | Attendance | ⏳ |
| 10 | Registration | ⏳ |
| 11 | Schedule | ⏳ |
| 12 | Reports | ⏳ |
| 13 | Users | ⏳ |
| 14 | Settings | ⏳ |
| 15 | Master Portal | ⏳ |
| 16 | Production Rehearsal | ⏳ |

> Legend: ⏳ = ממתין | 🔄 = בתהליך | ✅ = עבר | ❌ = נכשל (יש bug)
