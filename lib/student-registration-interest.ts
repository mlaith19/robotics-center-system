import type { Sql } from "postgres"

/** תחום/קורס עניין כשהרישום אינו מקושר לקורס ספציפי בקישור */
export async function ensureStudentRegistrationInterestColumn(sql: Sql) {
  try {
    await sql`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "registrationInterest" TEXT`
  } catch (e) {
    console.warn("[student-registration-interest] ensure column:", e)
  }
}
