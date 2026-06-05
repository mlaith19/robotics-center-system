/**
 * lib/api-logger.ts
 *
 * Minimal structured logger for API routes (dev-only).
 * Never logs cookie values — only names.
 */

export function logApi(route: string, msg: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "production") {
    const ts   = new Date().toISOString()
    const base = `[API ${route}] ${msg}`
    if (meta && Object.keys(meta).length > 0) {
      console.log(`${ts} ${base}`, meta)
    } else {
      console.log(`${ts} ${base}`)
    }
  }
}

export function logApiError(route: string, err: unknown): void {
  if (process.env.NODE_ENV !== "production") {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[API ${route}] ERROR ${msg}`)
  }
}
