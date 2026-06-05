"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useT } from "@/lib/master-i18n"

const KNOWN_FEATURES = [
  "students", "teachers", "courses", "attendance", "payments",
  "reports", "notifications", "import_export", "advanced_analytics", "multi_branch",
]

export default function NewPlanPage() {
  const router = useRouter()
  const { t } = useT()
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [features, setFeatures] = useState<string[]>([])
  const [customFeature, setCustomFeature] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function toggleFeature(f: string) {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])
  }

  function addCustomFeature() {
    const key = customFeature.trim().toLowerCase().replace(/\s+/g, "_")
    if (key && !features.includes(key)) setFeatures((prev) => [...prev, key])
    setCustomFeature("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true)
    try {
      const res = await fetch("/api/master/plans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, monthly_price: Number(price) || 0, features }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || t("common.error")); return }
      router.push("/master/plans")
    } catch { setError(t("login.networkError")) }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("newPlan.title")}</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">{t("newPlan.name")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">{t("newPlan.price")}</label>
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2">{t("newPlan.features")}</label>
          <div className="flex flex-wrap gap-2">
            {KNOWN_FEATURES.map((f) => (
              <button key={f} type="button" onClick={() => toggleFeature(f)}
                className={`text-xs px-3 py-1 rounded-full border transition ${
                  features.includes(f) ? "bg-indigo-700 border-indigo-500 text-white" : "border-gray-700 text-gray-400 hover:border-gray-500"
                }`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input value={customFeature} onChange={(e) => setCustomFeature(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomFeature() } }}
              placeholder={t("newPlan.customKey")}
              className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-1.5 border border-gray-700 text-xs" />
            <button type="button" onClick={addCustomFeature}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg">
              {t("newPlan.addCustom")}
            </button>
          </div>
        </div>
        {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm">{error}</div>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm">
            {loading ? t("newPlan.submitting") : t("newPlan.submit")}
          </button>
          <button type="button" onClick={() => router.push("/master/plans")}
            className="px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm">
            {t("newPlan.cancel")}
          </button>
        </div>
      </form>
    </div>
  )
}
