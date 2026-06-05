# Database setup – local and Hostinger

## Local setup (Docker PostgreSQL)

### 1. Environment

Copy the example env and set the connection string for local. **Use `.env`** (Prisma CLI and the app both read it; Next.js also loads `.env.local` if present):

```bash
cp .env.example .env
```

Edit `.env` and set (or leave as-is for defaults):

```env
DATABASE_URL=postgres://robotics:robotics@localhost:5432/robotics
```

### 2. Start local database

```bash
npm run db:up
```

This runs `docker compose up -d` and starts PostgreSQL in a container with a named volume.

### 3. Run migrations

```bash
npm run db:generate
npm run db:migrate
```

### 4. (Optional) Seed permissions and roles

With the app running (`npm run dev`), seed the database:

```bash
curl -X POST http://localhost:3000/api/seed
```

Or run the app, then in another terminal: `npm run db:seed` (see package.json for the exact command).

### 5. Run the app

```bash
npm run dev
```

DB health check: **GET** `http://localhost:3000/api/health/db` → `{"status":"ok","database":"connected"}` when the DB is reachable.

---

## Switching to Hostinger (production) – ENV only

No code changes. Only configuration:

### 1. Get connection details from Hostinger

In Hostinger: **Databases** → your PostgreSQL database → connection string or host / port / database / user / password.

### 2. Set `DATABASE_URL` in production

Either a single URL:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

Or separate vars (if your host supports them and the app is configured to build the URL from them):

```env
DB_HOST=your-db-host.hostingersite.com
DB_PORT=5432
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASS=your_db_password
```

The app uses `DATABASE_URL` if set; otherwise it builds the URL from `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.

### 3. Run migrations on the server

On the VPS or in your deploy pipeline, with `DATABASE_URL` (or `DB_*`) set for Hostinger:

```bash
npm run db:generate
npm run db:migrate
```

### 4. Start the app

```bash
npm run build
npm start
```

Or set `PORT` if needed, e.g. `PORT=3000 npm start`.

---

## Scripts reference

| Command         | Description                          |
|----------------|-------------------------------------|
| `npm run db:up` | Start local PostgreSQL (Docker)     |
| `npm run db:down` | Stop local PostgreSQL            |
| `npm run db:generate` | Generate Prisma Client        |
| `npm run db:migrate` | Apply migrations to database   |
| `npm run db:seed` | Print instruction to call POST /api/seed |

---

## Production readiness

- **PORT**: Next.js binds to `process.env.PORT` (default 3000). Set `PORT` on the host when needed.
- **CORS**: API routes are same-origin by default. If you add a separate frontend domain, configure CORS in Next.js (no `*` in production).
- **Secrets**: Never commit `.env` or `.env.local` (they are in `.gitignore`). Use env vars only for `DATABASE_URL` / `DB_*` and other secrets.
- **Errors**: Production logging in `lib/db` does not log full stack traces to avoid leaking credentials.

---

## Troubleshooting

- **Connection refused**: Ensure the DB is running (`npm run db:up`) and `DATABASE_URL` (or `DB_*`) matches host, port, user, and database.
- **SSL**: For Hostinger/remote DBs, add `?sslmode=require` to `DATABASE_URL` if required.
- **Health check**: `GET /api/health/db` returns 503 when the DB is unreachable and 200 with `{"status":"ok","database":"connected"}` when it is reachable.
