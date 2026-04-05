type DbClient = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>
}

export const DEFAULT_PROFILE_IMAGE_PATH = "/api/og-logo"

export async function ensureProfileImageColumns(db: DbClient) {
  await db`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "profileImage" TEXT`
  await db`ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "profileImage" TEXT`
}

export function normalizeProfileImageInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const value = raw.trim()
  if (!value) return null
  // תמונות מהעלאה בצד הלקוח נשלחות כ-data URL — חייבים לשמור כמו שהן (לא לשבור עם "/" קידומת)
  if (value.startsWith("data:")) return value
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("/")) return value
  return `/${value}`
}

export function resolveProfileImageWithFallback(raw: unknown): string {
  return normalizeProfileImageInput(raw) || DEFAULT_PROFILE_IMAGE_PATH
}
