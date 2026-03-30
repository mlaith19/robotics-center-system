"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useT } from "@/lib/master-i18n"

interface Center {
  id: string; name: string; subdomain: string; status: string
  is_trial: boolean; plan_name: string | null; end_date: string | null; created_at: string
}

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-900 text-green-300",
    locked: "bg-red-900 text-red-300",
    inactive: "bg-gray-700 text-gray-300",
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status] ?? "bg-gray-800 text-gray-400"}`}>
      {status}
    </span>
  )
}

export default function CentersPage() {
  const { t } = useT()
  const [centers, setCenters] = useState<Center[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: "20" })
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    const res = await fetch(`/api/master/centers?${params}`)
    const data = await res.json()
    setCenters(data.data ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, q, status])

  useEffect(() => { load() }, [load])

  async function lockUnlock(id: string, action: "lock" | "unlock") {
    const res = await fetch(`/api/master/centers/${id}/${action}`, { method: "POST" })
    if (res.ok) {
      setToast(action === "lock" ? t("centers.locked") : t("centers.unlocked"))
      setTimeout(() => setToast(""), 3000)
      load()
    }
  }

  const pageCount = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 end-4 bg-indigo-700 text-white px-5 py-3 rounded-xl shadow-xl z-50 text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t("centers.title")}</h1>
        <Link href="/master/centers/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          {t("centers.new")}
        </Link>
      </div>

      <div className="flex gap-3">
        <input
          placeholder={t("centers.search")}
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
          className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm"
        >
          <option value="">{t("centers.statusAll")}</option>
          <option value="active">{t("centers.statusActive")}</option>
          <option value="locked">{t("centers.statusLocked")}</option>
          <option value="inactive">{t("centers.statusInactive")}</option>
        </select>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-start px-4 py-3">{t("centers.colName")}</th>
              <th className="text-start px-4 py-3">{t("centers.colSubdomain")}</th>
              <th className="text-start px-4 py-3">{t("centers.colStatus")}</th>
              <th className="text-start px-4 py-3">{t("centers.colPlan")}</th>
              <th className="text-start px-4 py-3">{t("centers.colExpires")}</th>
              <th className="text-start px-4 py-3">{t("centers.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">{t("loading")}</td></tr>}
            {!loading && centers.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-600">{t("centers.empty")}</td></tr>}
            {centers.map((c) => (
              <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-2.5">
                  <Link href={`/master/centers/${c.id}`} className="text-indigo-300 hover:underline font-medium">{c.name}</Link>
                </td>
                <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{c.subdomain}</td>
                <td className="px-4 py-2.5"><StatusChip status={c.status} /></td>
                <td className="px-4 py-2.5 text-gray-300">
                  {c.plan_name ?? t("na")} {c.is_trial && <span className="text-yellow-400 text-xs">{t("trial")}</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{c.end_date ?? t("na")}</td>
                <td className="px-4 py-2.5 flex gap-2">
                  {c.status === "active" ? (
                    <button onClick={() => lockUnlock(c.id, "lock")}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-800 px-2 py-0.5 rounded">
                      {t("centers.lock")}
                    </button>
                  ) : (
                    <button onClick={() => lockUnlock(c.id, "unlock")}
                      className="text-xs text-green-400 hover:text-green-300 border border-green-800 px-2 py-0.5 rounded">
                      {t("centers.unlock")}
                    </button>
                  )}
                  <Link href={`/master/centers/${c.id}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded">
                    {t("centers.detail")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${p === page ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
