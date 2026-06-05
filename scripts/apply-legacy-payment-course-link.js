const fs = require("fs")
const path = require("path")
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

async function main() {
  const sql = postgres(getDbUrl(), { prepare: false })
  try {
    const before = await sql`SELECT COUNT(*)::int AS c FROM "Payment" WHERE "courseId" IS NULL`
    const applySqlPath = path.join(process.cwd(), "scripts", "018_apply_legacy_payment_course_link.sql")
    const query = fs.readFileSync(applySqlPath, "utf8")
    await sql.unsafe(query)
    const after = await sql`SELECT COUNT(*)::int AS c FROM "Payment" WHERE "courseId" IS NULL`
    const linkedNow = Number(before[0].c || 0) - Number(after[0].c || 0)
    console.log(JSON.stringify({ beforeNullCourseId: before[0].c, afterNullCourseId: after[0].c, linkedNow }, null, 2))
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error("APPLY_FAILED")
  console.error(err?.message || err)
  process.exit(1)
})
