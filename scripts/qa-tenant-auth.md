# בדיקות חובה — Tenant Auth & Permissions

## 1. Create user במרכז A, login, whoami

```powershell
# התחברות למרכז (subdomain או localhost עם DEFAULT_DEV_CENTER)
$base = "http://center1.localhost:3000"   # או http://localhost:3000 אם DEFAULT_DEV_CENTER=center1

# Login
$login = Invoke-RestMethod -Uri "$base/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"teacher1","password":"yourpassword"}'
# צפוי: ok=true, permissions מערך, centerId, centerSlug

# Whoami (עם cookie מהלוגין)
Invoke-RestMethod -Uri "$base/api/_debug/whoami" -Method GET
# צפוי: tenant.ok=true, session עם first20Permissions
```

## 2. אותו user ממרכז B → 401/400

```powershell
# לוגין ממרכז אחר (מרכז B) עם אותו username
Invoke-RestMethod -Uri "http://center2.localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"teacher1","password":"yourpassword"}'
# צפוי: 401 INVALID_CREDENTIALS (user לא נמצא ב-DB של מרכז B) או 400 TENANT_NOT_RESOLVED
```

## 3. שמירת הרשאות דרך UI

- ערוך משתמש → סמן הרשאות → שמור.
- רענן דף → פתח שוב את אותו משתמש → אותם צ'קים מסומנים.
- GET /api/users/:id מחזיר permissions; המודל נטען מחדש בפתיחת עריכה.

## 4. Debug

```powershell
# סיבות כישלון auth
Invoke-RestMethod -Uri "http://localhost:3000/api/_debug/auth" -Method GET
# מחזיר: host, subdomain, tenant { ok, centerId?, reason? }, cookieNames, auth { ok, failureReason, permsCount }
```

## Error keys יציבים

- `TENANT_NOT_RESOLVED` (400) — אין subdomain או מרכז לא נמצא
- `INVALID_CREDENTIALS` (401) — user_not_found / invalid_password / no_password
- `USER_INACTIVE` (403)
- `FORBIDDEN` (403) — need: "permission.key"
