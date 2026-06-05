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

## What NOT to Do

- Do not add new dependencies without asking.
- Do not refactor working code while fixing a bug — fix only what is broken.
- Do not remove existing translations or i18n keys.
- Do not add `console.log` statements to production code.
- Do not create new MD/README files unless asked.
