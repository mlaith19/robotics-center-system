"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useT } from "@/lib/master-i18n"

type Plan = { id: string; name: string; monthly_price?: number | null }

export default function NewCenterPage() {
  const router = useRouter()
  const { t } = useT()
  const [form, setForm] = useState({
    name: "", subdomain: "", adminEmail: "", tempPassword: "",
    tenantDbMode: "autoCreate" as "autoCreate" | "existingUrl",
    tenantDbUrl: "", planId: "",
  })
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ centerId: string; adminUsername: string; tenantDbUrl: string } | null>(null)

  useEffect(() => {
    fetch("/api/master/plans")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        const list: Plan[] = Array.isArray(data) ? data : (data.plans ?? [])
        setPlans(list)
        if (list.length === 1) setForm((p) => ({ ...p, planId: list[0].id }))
      })
      .catch(() => {})
  }, [])

  function set(key: string, value: string) { setForm((p) => ({ ...p, [key]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true)
    try {
      const res = await fetch("/api/master/centers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || t("common.error")); return }
      setResult(data)
    } catch { setError(t("login.networkError")) }
    finally { setLoading(false) }
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 text-green-300">
          <h2 className="text-lg font-bold mb-3 text-green-200">{t("newCenter.successTitle")}</h2>
          <p className="text-sm"><strong>{t("newCenter.successId")}:</strong> {result.centerId}</p>
          <p className="text-sm"><strong>{t("newCenter.successAdmin")}:</strong> {result.adminUsername}</p>
          <p className="text-sm break-all"><strong>{t("newCenter.successDb")}:</strong> {result.tenantDbUrl.replace(/:.*@/, ":***@")}</p>
          <p className="text-xs text-green-500 mt-2">{t("newCenter.successNote")}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push(`/master/centers/${result.centerId}`)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-500">
            {t("newCenter.successView")}
          </button>
          <button onClick={() => router.push("/master/centers")}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700">
            {t("newCenter.successBack")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("newCenter.title")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-900 rounded-xl border border-gray-800 p-6">
        <Field label={t("newCenter.name")} value={form.name} onChange={(v) => set("name", v)} required />
        <Field label={t("newCenter.subdomain")} value={form.subdomain} onChange={(v) => set("subdomain", v.toLowerCase())} required placeholder="e.g. acme-robotics" />
        <Field label={t("newCenter.adminEmail")} type="email" value={form.adminEmail} onChange={(v) => set("adminEmail", v)} required />
        <Field label={t("newCenter.tempPwd")} type="password" value={form.tempPassword} onChange={(v) => set("tempPassword", v)} required />

        {/* Plan selector — dropdown from DB, not free text */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">
            {t("newCenter.planId")}
            <span className="text-gray-600 font-normal ms-1">(אופציונלי — ברירת מחדל: ראשונה ברשימה)</span>
          </label>
          <select
            value={form.planId}
            onChange={(e) => set("planId", e.target.value)}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— ברירת מחדל (ראשונה ברשימה) —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.monthly_price != null ? ` · ₪${Number(p.monthly_price).toFixed(0)}/חודש` : ""}
              </option>
            ))}
          </select>
          {plans.length === 0 && (
            <p className="text-xs text-yellow-500 mt-1">⚠ לא נמצאו תוכניות — המרכז ייצר ללא מנוי פעיל</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">{t("newCenter.dbMode")}</label>
          <select value={form.tenantDbMode} onChange={(e) => set("tenantDbMode", e.target.value)}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm">
            <option value="autoCreate">{t("newCenter.autoCreate")}</option>
            <option value="existingUrl">{t("newCenter.existingUrl")}</option>
          </select>
        </div>
        {form.tenantDbMode === "existingUrl" && (
          <Field label={t("newCenter.dbUrl")} value={form.tenantDbUrl} onChange={(v) => set("tenantDbUrl", v)} required placeholder="postgresql://user:pass@host:5432/dbname" />
        )}
        {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm">{error}</div>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition">
            {loading ? t("newCenter.submitting") : t("newCenter.submit")}
          </button>
          <button type="button" onClick={() => router.push("/master/centers")}
            className="px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm">
            {t("newCenter.cancel")}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, type = "text", required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        required={required} placeholder={placeholder}
        className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
  )
}
