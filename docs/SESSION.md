# Session Management — Tenant Auth

## Timeouts

| Type | Default | Env var |
|------|---------|---------|
| **Idle timeout** | 1 hour | `SESSION_IDLE_MS` |
| **Absolute timeout** | 8 hours | `SESSION_ABSOLUTE_MS` |
| **Master idle** | 8 hours | `MASTER_SESSION_IDLE_MS` |

### Idle timeout
The session expires if no API call is made for `SESSION_IDLE_MS` milliseconds.
Every successful API response **refreshes** `lastActivity` by returning a new `Set-Cookie: tenant-session=…` header.

### Absolute timeout
The session is always invalidated after `SESSION_ABSOLUTE_MS` from the original `loginTime`, regardless of activity.

---

## Why users get 401 after a while

Old system: session cookie was set **once at login** and never updated.
After `SESSION_IDLE_MS` the server rejected it → 401.

Fix: two complementary mechanisms:

### 1. Middleware-level auto-refresh (global)
`middleware.ts` calls `refreshTenantCookieHeader(req)` on every `/api/*` request (except `/api/auth/*` and `/api/master/*`).
If the session is valid, a new `Set-Cookie` with updated `lastActivity` is appended to the response.
This covers **all** tenant API routes with zero per-route code.

### 2. `withTenantAuth` wrapper (per-route)
`lib/api-auth.ts` exports `withTenantAuth(req, handler)`.
It calls `requireAuth(req)` → on success refreshes the session and appends `Set-Cookie` to the handler's response.
This is the explicit wrapper used in key route files.

Both mechanisms produce the same result; the middleware is the safety net for routes that were not yet converted.

---

## Cookie names

| Cookie | Purpose |
|--------|---------|
| `tenant-session` | Tenant dashboard users |
| `master-session` | Master portal (OWNER/MASTER_ADMIN) |
| `robotics-session` | **Legacy** — actively purged on every auth operation |

Both cookies use: `Path=/; HttpOnly; SameSite=Lax` (+ `Secure` in production).

---

## Dev-only debug endpoints

All endpoints return `404` in production.

### `GET /api/_debug/ping`
Liveness check. Returns `{ ok, time, env }`.

### `GET /api/_debug/auth`
Returns exactly what `/api/students` sees:
```json
{
  "now": "2026-03-01T…",
  "cookies": { "names": ["tenant-session"], "hasTenantSession": true, … },
  "auth": { "ok": false, "failureReason": "idle_timeout", "hint": "Log in again…" },
  "user": null
}
```

**`failureReason` values:**

| Reason | Cause |
|--------|-------|
| `missing_cookie` | No `tenant-session` cookie at all |
| `parse_error` | Cookie exists but cannot be decoded |
| `no_id` | Session payload has no `id` field |
| `no_timestamps` | Session payload missing `loginTime` |
| `idle_timeout` | `lastActivity` too old |
| `absolute_timeout` | `loginTime` too old |
| `ok` | Session valid |

### `GET /api/_debug/cookies`
Returns all cookie names + safe previews (never full values).

### `POST /api/_debug/login-as-seed-admin?centerId=<uuid>`
Finds the first active admin user in the tenant DB and sets a `tenant-session` cookie.
Use this for QA scripts to authenticate without real credentials.

---

## Self-check script

```powershell
# Run with dev server running
node scripts/self-check/phase5-session-refresh.js

# With explicit center
node scripts/self-check/phase5-session-refresh.js --center-id <uuid>

# With pre-baked cookie (from browser DevTools)
$env:TENANT_COOKIE="tenant-session=<value>"; node scripts/self-check/phase5-session-refresh.js
```

---

## Using `withTenantAuth` in a new route

```typescript
import { withTenantAuth } from "@/lib/api-auth"

// Simple route (no params)
export const GET = (req: Request) =>
  withTenantAuth(req, async (_req, session) => {
    return Response.json({ hello: session.username })
  })

// Dynamic route (with params — params captured via closure)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withTenantAuth(req, async (_req, session) => {
    const { id } = await params
    // session.id, session.role, session.roleKey available here
    return Response.json({ id })
  })
}
```
