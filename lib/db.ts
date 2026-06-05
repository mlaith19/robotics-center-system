import postgres from "postgres"

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (url && url.trim().length > 0) return url.trim()
  const host = process.env.DB_HOST || "localhost"
  const port = process.env.DB_PORT || "5432"
  const name = process.env.DB_NAME || "robotics"
  const user = process.env.DB_USER || "robotics"
  const pass = process.env.DB_PASS || "robotics"
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${encodeURIComponent(name)}`
}

let _sql: ReturnType<typeof postgres> | null = null

function getSql(): ReturnType<typeof postgres> {
  if (!_sql) {
    _sql = postgres(getDatabaseUrl(), {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    })
  }
  return _sql
}

const sqlClient = () => getSql()
export const sql = new Proxy(sqlClient as unknown as ReturnType<typeof postgres>, {
  apply(_target, _thisArg, args: unknown[]) {
    return (getSql() as (...a: unknown[]) => unknown)(...args)
  },
  get(_, prop) {
    return (getSql() as Record<string, unknown>)[prop as string]
  },
})

export async function checkDbConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getSql()`SELECT 1`
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/**
 * Wraps a promise with a hard deadline.
 * Rejects with `Error("timeout:<label>")` if the promise does not settle within `ms`.
 * The original promise keeps running in the background (can't cancel Node I/O),
 * but the caller receives the rejection immediately.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout>
  const guard = new Promise<never>((_, reject) => {
    tid = setTimeout(() => reject(new Error(`timeout:${label}`)), ms)
  })
  return Promise.race([promise, guard]).finally(() => clearTimeout(tid))
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("Too Many") || error.message.includes("rate limit") || error.message.includes("429")
  }
  return false
}

export function handleDbError(error: unknown, context: string) {
  if (process.env.NODE_ENV === "production") {
    console.error(`${context} error:`, error instanceof Error ? error.name + ": " + error.message : "Unknown error")
  } else {
    console.error(`${context} error:`, error)
  }
  if (isRateLimitError(error)) {
    return Response.json(
      { error: "יותר מדי בקשות, אנא המתן מספר שניות ונסה שוב" },
      { status: 429 }
    )
  }
  return Response.json(
    { error: "שגיאה בשרת" },
    { status: 500 }
  )
}
