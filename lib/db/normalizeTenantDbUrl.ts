/**
 * Normalize a tenant_db_url so it always uses the correct Docker credentials.
 *
 * The Docker Postgres container uses:
 *   POSTGRES_USER=robotics
 *   POSTGRES_PASSWORD=robotics
 *
 * Any URL stored as postgresql://postgres@... will fail authentication.
 * This function corrects the credentials before any connection attempt.
 *
 * Examples:
 *   postgresql://postgres@localhost:5432/center1
 *   → postgresql://robotics:robotics@localhost:5432/center1
 *
 *   postgres://postgres@localhost/center1
 *   → postgresql://robotics:robotics@localhost/center1
 */
export function normalizeTenantDbUrl(url: string): string {
  if (!url) throw new Error("tenant_db_url missing")

  let normalized = url
    .replace("postgresql://postgres@", "postgresql://robotics:robotics@")
    .replace("postgres://postgres@", "postgresql://robotics:robotics@")

  // Also normalise bare postgres:// scheme to postgresql://
  if (normalized.startsWith("postgres://") && !normalized.startsWith("postgresql://")) {
    normalized = "postgresql://" + normalized.slice("postgres://".length)
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("TENANT DB:", normalized.replace(/:.*@/, ":***@"))
  }

  return normalized
}
