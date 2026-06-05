/**
 * Session cookie encoding — base64url (RFC 4648 §5) + HMAC-SHA256 signature.
 *
 * Cookie format (when SESSION_SECRET is set):
 *   base64url(payload) + "." + base64url(hmac-sha256(base64url(payload), secret))
 *
 * WHY base64url instead of encodeURIComponent:
 *   - encodeURIComponent produces %XX sequences that Next.js Edge Runtime
 *     may or may not pre-decode before passing to req.cookies.get().
 *     This creates an ambiguity in parsers that leads to silent failures.
 *   - base64url uses only A-Za-z0-9-_ characters, all of which are safe
 *     cookie value characters (RFC 6265) and never decoded by any middleware.
 *   - Handles multi-byte Unicode (Hebrew/Arabic usernames) correctly via
 *     TextEncoder/TextDecoder available in both Edge Runtime and Node.js.
 *
 * Uses Web Crypto API (crypto.subtle) — available in both Edge Runtime and Node 18+.
 * SESSION_SECRET env var MUST be set in production; in dev unsigned sessions are
 * accepted as a fallback so existing dev sessions are not immediately invalidated.
 */

/** Encode any string (including non-ASCII) to base64url. */
export function encodeSession(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Decode a base64url string back to the original string. */
export function decodeBase64url(raw: string): string {
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(raw.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/**
 * Parse a cookie value (string from req.cookies.get()) into a JSON object.
 * Does NOT verify HMAC — use verifyAndDecodeSession for authenticated parsing.
 * This is kept for internal use by verifyAndDecodeSession and legacy fallback.
 *
 * Tries three formats in order:
 *   1. base64url-encoded JSON   (new format)
 *   2. Raw JSON string          (Next.js may pre-decode encodeURIComponent)
 *   3. percent-encoded JSON     (old format fallback)
 *
 * Returns null on any failure — caller should treat as invalid session.
 */
export function parseSessionCookieValue(raw: string): Record<string, unknown> | null {
  if (!raw) return null

  // 1. base64url → JSON
  try {
    const decoded = decodeBase64url(raw)
    const parsed = JSON.parse(decoded)
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch { /* fall through */ }

  // 2. Raw JSON (Next.js Edge may return already-decoded value)
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch { /* fall through */ }

  // 3. percent-encoded JSON (legacy encodeURIComponent format)
  try {
    const decoded = decodeURIComponent(raw)
    const parsed = JSON.parse(decoded)
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch { /* fall through */ }

  return null
}

// ── HMAC-SHA256 signing ────────────────────────────────────────────────────────

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

function toBase64url(bytes: ArrayBuffer): string {
  let binary = ""
  new Uint8Array(bytes).forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64url(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(b64.length / 4) * 4, "="
  )
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Encode and sign a session JSON string.
 * Output format: base64url(payload).base64url(hmac)
 * If SESSION_SECRET is not set: throws in production, returns unsigned in dev.
 */
export async function signAndEncodeSession(value: string): Promise<string> {
  const secret = (process.env.SESSION_SECRET ?? "").trim()
  const encoded = encodeSession(value)

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[SESSION] SESSION_SECRET must be set in production")
    }
    // Dev: return unsigned (no dot-separated signature)
    return encoded
  }

  const key = await importHmacKey(secret)
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded))
  const sig = toBase64url(sigBytes)
  return `${encoded}.${sig}`
}

/**
 * Verify HMAC signature and decode session cookie value.
 * Returns parsed object or null on any failure (bad sig, malformed, expired handled by caller).
 *
 * In production without SESSION_SECRET: rejects all sessions (returns null).
 * In dev without SESSION_SECRET: falls back to unsigned parsing (backward compat).
 * In dev with SESSION_SECRET: requires valid signature (same as production).
 */
export async function verifyAndDecodeSession(raw: string): Promise<Record<string, unknown> | null> {
  if (!raw) return null

  const secret = (process.env.SESSION_SECRET ?? "").trim()

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[SESSION] SESSION_SECRET not set in production — all sessions rejected")
      return null
    }
    // Dev fallback: accept unsigned session
    return parseSessionCookieValue(raw)
  }

  // Signed format: payload.signature
  const dotIdx = raw.lastIndexOf(".")
  if (dotIdx === -1) {
    // No signature present
    if (process.env.NODE_ENV === "production") return null
    // Dev: allow legacy unsigned sessions (e.g. sessions from before signing was added)
    return parseSessionCookieValue(raw)
  }

  const payloadPart = raw.slice(0, dotIdx)
  const sigPart     = raw.slice(dotIdx + 1)

  try {
    const key      = await importHmacKey(secret)
    const sigBytes = fromBase64url(sigPart)
    const valid    = await crypto.subtle.verify(
      "HMAC", key, sigBytes, new TextEncoder().encode(payloadPart)
    )
    if (!valid) return null
  } catch {
    return null
  }

  return parseSessionCookieValue(payloadPart)
}
