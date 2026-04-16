import type { Sql } from "postgres"

export async function ensureCourseBillingPlanColumns(db: Sql): Promise<void> {
  await db.unsafe(`
    ALTER TABLE "Course"
    ADD COLUMN IF NOT EXISTS "billingPlan" text
  `)
  await db.unsafe(`
    ALTER TABLE "Course"
    ADD COLUMN IF NOT EXISTS "billingPlanSummerPrice" numeric
  `)
  await db.unsafe(`
    ALTER TABLE "Course"
    ADD COLUMN IF NOT EXISTS "billingPlanDiscountedPrice" numeric
  `)
  await db.unsafe(`
    ALTER TABLE "Course"
    ADD COLUMN IF NOT EXISTS "billingPlanPerSessionPrice" numeric
  `)
}
