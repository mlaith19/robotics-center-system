# Deployment Guide (Phase 15 – VPS)

## Prerequisites

- Node.js 18+
- PostgreSQL (for master and optionally separate tenant DBs)
- Nginx (for wildcard subdomain)

## Environment

- `DATABASE_URL` – main/master database (and default tenant when single-tenant)
- `MASTER_DATABASE_URL` – (optional) separate master DB; if unset, same as `DATABASE_URL`
- `BASE_DOMAIN` – base domain for subdomains (e.g. `example.com` or `localhost` for dev)
- `SESSION_IDLE_MS` – (optional) session idle timeout ms; default 15 min
- `SESSION_ABSOLUTE_MS` – (optional) absolute session timeout ms; default 8 h

## Master database

1. Run Prisma migrations (creates app + master tables):
   ```bash
   npm run db:migrate
   ```

2. Seed OWNER and default plan:
   ```bash
   node scripts/seed-master-owner.js
   node scripts/seed-default-plan.js
   ```

## Tenant database (per center)

For each new center:

1. Create a PostgreSQL database for the tenant.
2. Run tenant migrations:
   ```bash
   TENANT_DATABASE_URL=postgres://user:pass@host/tenant_db_name npm run tenant:migrate
   ```
3. Provision the center (creates center + domain, runs migrations if not done, creates admin user):
   ```bash
   CENTER_NAME="Center A" SUBDOMAIN=center-a TENANT_DATABASE_URL=postgres://... ADMIN_EMAIL=admin@center-a.local TEMP_PASSWORD=ChangeMe123! node scripts/provision-center.js
   ```

## Nginx (wildcard subdomain)

Example for `*.example.com`:

```nginx
server {
  listen 443 ssl;
  server_name *.example.com;
  ssl_certificate /path/to/fullchain.pem;
  ssl_certificate_key /path/to/privkey.pem;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Process manager (e.g. PM2)

```bash
npm run build
pm2 start npm --name "robotics-center" -- start
```

## SSL

Use Let’s Encrypt with wildcard DNS (e.g. `certbot` with DNS challenge) for `*.example.com`.

## Backup (Phase 14)

**Daily master DB backup:**

```bash
node scripts/backup-master-db.js [output_dir]
# Default output: ./backups/robotics_master_YYYY-MM-DD_HH-mm-ss.sql
```

**Daily tenant DB backups:**

```bash
node scripts/backup-tenant-dbs.js [output_dir]
# Default output: ./backups/tenants/<center_id>_YYYY-MM-DD_HH-mm-ss.sql
```

Schedule with cron (e.g. daily at 2:00):

```cron
0 2 * * * cd /path/to/app && node scripts/backup-master-db.js /var/backups/robotics
0 2 * * * cd /path/to/app && node scripts/backup-tenant-dbs.js /var/backups/robotics/tenants
```

**Restore a single tenant DB:**

1. Create a new empty database for the tenant (or drop/recreate the existing one).
2. Restore from the chosen backup file:
   ```bash
   psql -h HOST -p PORT -U USER -d TENANT_DB_NAME -f /path/to/backup_tenant_YYYY-MM-DD_HH-mm-ss.sql
   ```
3. Update `centers.tenant_db_url` in the master DB if the restore target is a new database URL.
4. Restart the app if needed.
