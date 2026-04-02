/**
 * APP_SCHEMA_VERSION — Bump this integer whenever you add or change:
 *   - SQL files in prisma/tenant-migrations/
 *   - Seed data that affects auth / critical tables
 *   - New required columns in tenant DB
 *
 * The system compares this value against each center's last-migrated version
 * and shows a warning in the Ops page and server logs.
 *
 * HOW TO BUMP:
 *  1. Add your SQL file to prisma/tenant-migrations/
 *  2. Increment APP_SCHEMA_VERSION below
 *  3. Add an entry to SCHEMA_CHANGELOG
 *
 * Current migration files:
 *  001_tenant_schema.sql  → v1
 *  002_add_locked_until.sql (applied inline via IF NOT EXISTS) → v2
 */

export const APP_SCHEMA_VERSION = 8

export const SCHEMA_CHANGELOG: Record<number, string> = {
  1: "Initial schema: User, Role, Permission, Student, Course, Payment, Attendance, login_attempts",
  2: "Added locked_until to User; login_attempts table; admin_username to centers",
  3: "002_alter_center_settings.sql — ADD COLUMN IF NOT EXISTS for all center_settings fields (backward compat for pre-existing tables)",
  4: "004_tax_id_center_settings.sql — ע\"ס / ח\"פ (tax_id) ב-center_settings",
  5: "005_created_by_user_enrollment.sql — createdByUserId ב-Enrollment, Payment, Attendance, Expense",
  6: "006_camp_kaytana.sql — קבוצות/חדרים/משבצות/ימי קייטנה, שיבוצים ושם שיעור; Enrollment.campGroupId",
  7: "007_camp_classroom_model.sql — campGroupLabel (א-ת), שיבוץ רב-קבוצות ורב-מורים, camp_classrooms_count",
  8: "008_camp_break_slots.sql — משבצות הפסקה בטבלת קייטנה (isBreak, breakTitle)",
}
