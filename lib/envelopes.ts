import type postgres from "postgres"

export async function ensureEnvelopeTables(db: ReturnType<typeof postgres>): Promise<void> {
  try {
    await db`
      CREATE TABLE IF NOT EXISTS "EnvelopeBudget" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "monthKey" TEXT NOT NULL,
        "targetAmount" NUMERIC NOT NULL DEFAULT 0,
        "rows" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
    await db`CREATE INDEX IF NOT EXISTS "EnvelopeBudget_monthKey_idx" ON "EnvelopeBudget"("monthKey")`
  } catch (e) {
    console.warn("[envelopes] ensure table:", e)
  }
}

export function normalizeEnvelopeRows(raw: unknown): Array<{
  date: string
  amount: number
  type: "income" | "expense"
  name: string
  notes: string
}> {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => {
      const x = (r ?? {}) as Record<string, unknown>
      const date = String(x.date ?? "")
      const amount = Number(x.amount ?? 0)
      const typeRaw = String(x.type ?? "expense").toLowerCase()
      const type = typeRaw === "income" ? "income" : "expense"
      const name = String(x.name ?? "")
      const notes = String(x.notes ?? "")
      return {
        date,
        amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
        type,
        name,
        notes,
      }
    })
    .filter((x) => x.date || x.amount > 0 || x.name || x.notes)
}
