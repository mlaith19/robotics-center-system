"use client"

import { useState, useEffect } from "react"

/** ברירת מחדל לסרגל — כשאין מנוי / רשימה ריקה מהשרת */
const DEFAULT_SIDEBAR_FEATURES = [
  "students",
  "teachers",
  "courses",
  "schools",
  "gafan",
  "reports",
  "payments",
] as const

/**
 * תוכניות ישנות / seed חלקי ב־plan_features לעיתים מחזירות רק חלק מהמפתחות.
 * אם יש ליבת הוראה (קורסים/תלמידים/מורים), נחשב שבתי ספר וגפ"ן שייכים לאותה רמה — אחרת נעלמים מהסרגל בטעות.
 */
function mergePlanFeaturesForNav(raw: string[]): string[] {
  if (raw.length === 0) return [...DEFAULT_SIDEBAR_FEATURES]
  const set = new Set(raw)
  const hasTeachingCore =
    set.has("courses") || set.has("students") || set.has("teachers")
  if (hasTeachingCore) {
    set.add("schools")
    set.add("gafan")
  }
  return [...set]
}

/**
 * Fetches enabled features for the current tenant from /api/subscription/status.
 * When no tenant or empty list, returns full default so nav is not restricted.
 */
export function useEnabledFeatures(): { features: string[]; loading: boolean } {
  const [features, setFeatures] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/subscription/status", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { enabledFeatures: [] }))
      .then((data) => {
        const list = Array.isArray(data.enabledFeatures) ? data.enabledFeatures : []
        setFeatures(mergePlanFeaturesForNav(list))
      })
      .catch(() => setFeatures([...DEFAULT_SIDEBAR_FEATURES]))
      .finally(() => setLoading(false))
  }, [])

  return { features, loading }
}
