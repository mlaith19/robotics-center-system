"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/master-i18n"

interface Plan { id: string; name: string; monthly_price: number; features: string[]; created_at: string }

export default function PlansPage() {
  const { t } = useT()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState("")

  useEffect(() => {
    fetch("/api/master/plans").then((r) => r.json()).then(setPlans).finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${t("plans.delete")} "${name}"?`)) return
    const res = await fetch(`/api/master/plans/${id}`, { method: "DELETE" })
    const data = await res.json()
    setToast(res.ok ? t("plans.deleted") : (data.error || t("common.error")))
    if (res.ok) setPlans((prev) => prev.filter((p) => p.id !== id))
    setTimeout(() => setToast(""), 3500)
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 end-4 bg-indigo-700 text-white px-5 py-3 rounded-xl shadow-xl z-50 text-sm">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t("plans.title")}</h1>
        <Link href="/master/plans/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          {t("plans.new")}
        </Link>
      </div>
      {loading && <p className="text-gray-400">{t("loading")}</p>}
      <div className="grid gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">{plan.name}</h2>
              <p className="text-indigo-400 font-semibold text-sm mt-0.5">
                ${Number(plan.monthly_price ?? 0).toFixed(2)} {t("plans.perMonth")}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(plan.features ?? []).map((f) => (
                  <span key={f} className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-full">{f}</span>
                ))}
                {plan.features?.length === 0 && <span className="text-gray-600 text-xs">{t("plans.noFeatures")}</span>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href={`/master/plans/${plan.id}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800 px-3 py-1 rounded-lg">
                {t("plans.edit")}
              </Link>
              <button onClick={() => handleDelete(plan.id, plan.name)}
                className="text-xs text-red-400 hover:text-red-300 border border-red-800 px-3 py-1 rounded-lg">
                {t("plans.delete")}
              </button>
            </div>
          </div>
        ))}
        {!loading && plans.length === 0 && (
          <p className="text-gray-600 text-center py-8">{t("plans.empty")}</p>
        )}
      </div>
    </div>
  )
}
