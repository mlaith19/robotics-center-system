/**
 * Phase 6: Password policy enforcement.
 */

const MIN_LENGTH = 8
const MAX_LENGTH = 128

export interface PasswordPolicyResult {
  valid: boolean
  error?: string
}

/**
 * Enforce password policy: min 8 chars, at least one letter and one number.
 */
export function validatePassword(password: string): PasswordPolicyResult {
  if (typeof password !== "string") {
    return { valid: false, error: "סיסמה לא תקינה" }
  }
  const p = password.trim()
  if (p.length < MIN_LENGTH) {
    return { valid: false, error: `סיסמה חייבת להכיל לפחות ${MIN_LENGTH} תווים` }
  }
  if (p.length > MAX_LENGTH) {
    return { valid: false, error: `סיסמה עד ${MAX_LENGTH} תווים` }
  }
  if (!/[a-zA-Z]/.test(p)) {
    return { valid: false, error: "סיסמה חייבת להכיל לפחות אות אחת באנגלית" }
  }
  if (!/[0-9]/.test(p)) {
    return { valid: false, error: "סיסמה חייבת להכיל לפחות ספרה אחת" }
  }
  return { valid: true }
}
