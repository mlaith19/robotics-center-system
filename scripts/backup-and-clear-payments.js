const postgres = require("postgres")

function getDbUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) return process.env.DATABASE_URL.trim()
  const host = process.env.DB_HOST || "localhost"
  const port = process.env.DB_PORT || "5432"
  const name = process.env.DB_NAME || "robotics"
  const user = process.env.DB_USER || "robotics"
  const pass = process.env.DB_PASS || "robotics"
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${encodeURIComponent(name)}`
}

function backupTableName() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, "0")
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `Payment_backup_${ts}`
}

async function main() {
  const sql = postgres(getDbUrl(), { prepare: false })
  const tableName = backupTableName()
  try {
    const beforeRows = await sql`SELECT COUNT(*)::int AS c FROM "Payment"`
    const beforeCount = Number(beforeRows[0]?.c || 0)

    await sql.unsafe(`CREATE TABLE "${tableName}" AS TABLE "Payment"`)
    await sql`DELETE FROM "Payment"`

    const afterRows = await sql`SELECT COUNT(*)::int AS c FROM "Payment"`
    const backupRows = await sql.unsafe(`SELECT COUNT(*)::int AS c FROM "${tableName}"`)
    const afterCount = Number(afterRows[0]?.c || 0)
    const backupCount = Number(backupRows[0]?.c || 0)

    console.log(
      JSON.stringify(
        {
          backupTable: tableName,
          beforeCount,
          backupCount,
          afterCount,
          deletedCount: beforeCount - afterCount,
        },
        null,
        2,
      ),
    )
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error("BACKUP_CLEAR_PAYMENTS_FAILED")
  console.error(err?.message || err)
  process.exit(1)
})
