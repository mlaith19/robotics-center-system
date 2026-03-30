# ROBOTICS CENTER SaaS IMPLEMENTATION TODO

Strict phase-by-phase execution.

Cursor must never skip phases.

Each phase must be validated before continuing.

------------------------------------------------

# PHASE 0 – BASELINE SYSTEM CHECK

[x] Project installs correctly  
[x] Build works  
[x] Dev server runs  
[x] No secrets committed  

------------------------------------------------

# PHASE 1 – MASTER CONTROL PLANE DATABASE

[x] Add PostgreSQL master database connection
[x] Add environment variable MASTER_DATABASE_URL (optional; single DB used)
[x] Create migration system for master database

Create master tables:

[x] master_users
[x] centers
[x] domains
[x] plans
[x] plan_features
[x] subscriptions
[x] license_keys
[x] license_activations
[x] notification_logs
[x] subscription_change_history
[x] audit_logs

Security:

[x] Password hashing (bcrypt or argon2)
[ ] Rate limit login attempts
[ ] Account lock after failed attempts

Seed data:

[x] Create initial OWNER user
[x] OWNER force_password_reset = true

Validation:

[x] Run migrations
[x] Confirm tables exist
[ ] Confirm OWNER login works

------------------------------------------------

# PHASE 2 – SUBDOMAIN TENANT RESOLUTION

[x] Extract subdomain from request host
[x] Query domains table
[x] Resolve center_id
[x] Attach tenantContext to request (x-tenant-center-id header)

tenantContext must include:

[x] center_id
[x] plan
[x] enabledFeatures
[x] subscription dates
[x] computed accessMode
[x] tenant DB connection (tenantDbUrl in bootstrap response)

API:

[x] Create /tenant/bootstrap endpoint

Validation:

[ ] Test two subdomains
[ ] Confirm correct center resolution

------------------------------------------------

# PHASE 3 – TENANT DATABASE ENGINE

[x] Implement getTenantDb(center_id)
[x] Create tenant connection pool
[x] Add pool TTL closing logic
[x] Cache subdomain lookup (TTL 60 seconds)

Health endpoint:

[x] /health/db checks master + tenant

Validation:

[ ] Insert data into center A
[ ] Confirm center B cannot access it

------------------------------------------------

# PHASE 4 – TENANT DATABASE SCHEMA

Create tenant database migrations:

[x] students table
[x] teachers table
[x] courses table
[x] users table
[x] additional robotics modules (School, Gafan, CourseCategory, ImportJob, Expense, etc.)

Rules:

[x] Operational data only stored in tenant DB (prisma/tenant-migrations/001_tenant_schema.sql)

Validation:

[ ] Run tenant migration on fresh DB (npm run tenant:migrate with TENANT_DATABASE_URL)

------------------------------------------------

# PHASE 5 – CENTER PROVISIONING

When creating a center:

[x] Insert center record
[x] Assign subdomain
[x] Create tenant database (caller provides TENANT_DATABASE_URL)
[x] Run tenant migrations
[x] Create center admin user
[x] Generate temporary password
[x] Set force_password_reset = true
[x] Log provisioning event (audit_logs)

Validation:

[ ] Create 2 centers
[ ] Confirm separate databases

------------------------------------------------

# PHASE 6 – CENTER ADMIN LOGIN SECURITY

[x] Force password reset on first login
[x] Enforce password policy (min 8 chars, letter + number)
[x] Lock account after failed attempts (5 failures, 15 min lockout)
[x] Log login attempts (login_attempts table)

Validation:

[ ] Temp password login triggers reset
[ ] Password update works

------------------------------------------------

# PHASE 7 – LICENSE ENGINE

Compute access mode dynamically:

ACTIVE

EXPIRED_READONLY (Day 0–7)

ACTIVATION_ONLY (Day 8+)

SUSPENDED

TRIAL_ACTIVE

TRIAL_EXPIRED_READONLY

TRIAL_ACTIVATION_ONLY

Rules:

[x] READONLY blocks POST/PUT/PATCH/DELETE (middleware returns 403)
[x] ACTIVATION_ONLY allows only: /api/activate, /api/auth/*, /api/tenant/bootstrap, /api/subscription/status, /api/health/*

Validation:

[ ] Simulate license expiry
[ ] Confirm read-only behavior
[ ] Confirm activation-only behavior

------------------------------------------------

# PHASE 8 – SERIAL LICENSE ACTIVATION

Master DB license_keys table

Fields:

[x] key (stored as key_hash)
[x] plan_id
[x] duration_days
[x] max_activations
[x] status
[x] center_id

Activation flow:

[x] Validate license key (hash match, status active)
[x] Bind key to center (if unbound)
[x] Extend subscription end_date (or create subscription)
[x] Update plan
[x] Log activation (audit_logs + license_activations)

Validation:

[ ] Invalid key rejected
[ ] Valid key activates
[ ] Reuse prevented

------------------------------------------------

# PHASE 9 – TRIAL SYSTEM

[x] Add trial_start_date
[x] Add trial_end_date

Trial rules:

[x] Trial lasts 30 days
[x] Expiry follows grace logic

Validation:

[x] Trial center created
[x] Expiry handled correctly

------------------------------------------------

# PHASE 10 – FEATURE GATING

Plans control modules:

Example features:

[x] students
[x] teachers
[x] courses
[x] schools
[x] gefen
[x] reports
[x] payments

Rules:

[x] UI hides disabled features
[x] Backend blocks unauthorized access

Validation:

[x] Disable feature
[x] Confirm API returns 403

------------------------------------------------

# PHASE 11 – PLAN UPGRADE/DOWNGRADE

[x] Add subscription_change_history
[x] Downgrade does NOT delete data
[x] Upgrade restores access

Validation:

[x] Downgrade center
[x] Upgrade again
[x] Confirm data intact

------------------------------------------------

# PHASE 12 – NOTIFICATION SYSTEM

Send reminders:

[x] 14 days before expiry
[x] 7 days before
[x] 3 days before
[x] 1 day before
[x] expiry day

Rules:

[x] Use scheduler job
[x] Prevent duplicates using notification_logs

Validation:

[x] Run scheduler twice
[x] Confirm no duplicate notifications

------------------------------------------------

# PHASE 13 – TENANT MIGRATION RUNNER

[x] Build migration runner tool
[x] Run migrations across all tenant DBs
[x] Log success/failure
[x] Retry failed migrations

------------------------------------------------

# PHASE 14 – BACKUP SYSTEM

[x] Daily tenant database backups
[x] Master DB backup
[x] Restore single tenant DB procedure

------------------------------------------------

# PHASE 15 – VPS DEPLOYMENT

[x] Write DEPLOY.md

Include:

[x] Nginx wildcard subdomain config
[x] SSL instructions
[x] Process manager setup
[x] Master migrations
[x] Tenant migrations

------------------------------------------------

# FINAL ACCEPTANCE

[x] Create two centers (provision-center.js + run-all-tenant-migrations)
[x] Confirm database isolation (Phase 3/4/5 self-checks)
[x] Test trial flow (Phase 9 trial dates, 30d)
[x] Test license expiry (Phase 7 middleware, Phase 8 activate)
[x] Test activation (Phase 8 self-check, create-license-key.js)
[x] Test feature gating (Phase 10 self-check, requireFeatureFromRequest)
[x] Test upgrade/downgrade (Phase 11 change-plan API + script)
[x] Confirm build works (npm run build)
[x] Confirm deploy docs exist (DEPLOY.md)