"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useT } from "@/lib/master-i18n"

const KNOWN_FEATURES = [
  "students", "teachers", "courses", "attendance", "payments",
  "reports", "notifications", "import_export", "advanced_analytics", "multi_branch",
]

export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useT()
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [features, setFeatures] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/master/plans/${id}`).then((r) => r.json()).then((data) => {
      setName(data.name)
      setPrice(String(Number(data.monthly_price ?? 0)))
      setFeatures(data.features ?? [])
    }).finally(() => setLoading(false))
  }, [id])

  function toggleFeature(f: string) {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSaving(true)
    const res = await fetch(`/api/master/plans/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, monthly_price: Number(price) || 0, features }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || t("common.error")); return }
    setToast(t("editPlan.saved"))
    setTimeout(() => setToast(""), 3000)
  }

  if (loading) return <p className="text-gray-400">{t("loading")}</p>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {toast && (
        <div className="fixed top-4 end-4 bg-green-700 text-white px-5 py-3 rounded-xl shadow-xl z-50 text-sm">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t("editPlan.title")}</h1>
        <button onClick={() => router.push("/master/plans")} className="text-sm text-gray-400 hover:text-white">
          {t("editPlan.back")}
        </button>
      </div>
      <form onSubmit={handleSave} className="space-y-5 bg-gray-900 border border-gray-800 rounded-xl p-6">
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
        </div>
        {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm">{error}</div>}
        <button type="submit" disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm">
          {saving ? t("editPlan.saving") : t("editPlan.save")}
        </button>
      </form>
    </div>
  )
}
