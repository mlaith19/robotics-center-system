"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const DAY_HE: Record<number, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
}

function labelForSessionDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return ymd
  const w = DAY_HE[dt.getDay()] || ""
  return `${d.toString().padStart(2, "0")}.${m.toString().padStart(2, "0")}.${y} (${w})`
}

export function PerSessionPriceList(props: {
  sessionDates: string[]
  values: Record<string, string>
  onChange: (next: Record<string, string>) => void
  defaultPrice: string
  defaultPriceLabel: string
}) {
  const { sessionDates, values, onChange, defaultPrice, defaultPriceLabel } = props

  function setOne(date: string, raw: string) {
    onChange({ ...values, [date]: raw })
  }

  function applyDefaultToAll() {
    const next: Record<string, string> = { ...values }
    for (const d of sessionDates) {
      next[d] = defaultPrice
    }
    onChange(next)
  }

  if (sessionDates.length === 0) return null

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-white/80 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center sm:justify-between">
        <Label className="text-right text-sm font-medium">מחיר לכל מפגש</Label>
        <Button type="button" variant="outline" size="sm" className="shrink-0 bg-transparent" onClick={applyDefaultToAll}>
          החל מחיר ברירת מחדל על כל המפגשים
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {defaultPriceLabel}
      </p>
      <div className="max-h-[min(360px,50vh)] space-y-2 overflow-y-auto pe-1">
        {sessionDates.map((d) => (
          <div
            key={d}
            className="flex flex-col gap-1 rounded-md border border-emerald-100/90 bg-emerald-50/40 p-2 sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-3 dark:border-emerald-900/50 dark:bg-emerald-950/30"
          >
            <span className="min-w-0 shrink text-right text-sm font-medium">{labelForSessionDate(d)}</span>
            <div className="flex items-center gap-2 sm:w-40">
              <Input
                type="number"
                min={0}
                step="0.01"
                className="text-right"
                dir="rtl"
                value={values[d] ?? ""}
                onChange={(e) => setOne(d, e.target.value)}
                placeholder={defaultPrice || "0"}
              />
              <span className="text-muted-foreground text-sm shrink-0">₪</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
