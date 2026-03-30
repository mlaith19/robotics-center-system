"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/master-i18n"

interface Stats { total: number; active: number; trial: number; locked: number }
interface AuditLog { id: string; action: string; master_username: string | null; created_at: string }

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-xl border ${color} p-5`}>
      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  )
}

export default function MasterDashboard() {
  const { t } = useT()
  const [stats, setStats] = useState<Stats | null>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/master/audit?pageSize=10").then((r) => r.json()),
    ]).then(([auditData]) => {
      setLogs(auditData.data ?? [])
    })
    fetch("/api/master/centers?pageSize=500").then((r) => r.json()).then((all) => {
      const rows = all.data ?? []
      setStats({
        total: all.total ?? rows.length,
        active: rows.filter((c: { status: string }) => c.status === "active").length,
        trial: rows.filter((c: { is_trial: boolean }) => c.is_trial).length,
        locked: rows.filter((c: { status: string }) => c.status === "locked").length,
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400">{t("loading")}</p>

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">{t("dash.title")}</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t("dash.total")} value={stats?.total ?? 0} color="border-gray-700" />
        <StatCard label={t("dash.active")} value={stats?.active ?? 0} color="border-green-800" />
        <StatCard label={t("dash.trial")} value={stats?.trial ?? 0} color="border-yellow-800" />
        <StatCard label={t("dash.locked")} value={stats?.locked ?? 0} color="border-red-900" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">{t("dash.recentAudit")}</h2>
          <Link href="/master/audit" className="text-indigo-400 text-sm hover:underline">{t("dash.viewAll")}</Link>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-start px-4 py-3">{t("audit.colAction")}</th>
                <th className="text-start px-4 py-3">{t("audit.colUser")}</th>
                <th className="text-start px-4 py-3">{t("audit.colTime")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-600">{t("dash.noAudit")}</td></tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-2.5 font-mono text-indigo-300">{log.action}</td>
                  <td className="px-4 py-2.5 text-gray-300">{log.master_username ?? t("na")}</td>
                  <td className="px-4 py-2.5 text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
