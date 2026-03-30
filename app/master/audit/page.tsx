"use client"

import { useEffect, useState, useCallback, Fragment } from "react"
import { useT } from "@/lib/master-i18n"

interface Log {
  id: string; action: string; details: Record<string, unknown> | null
  created_at: string; master_username: string | null
}

const ACTION_OPTIONS = [
  "master_login", "center_provisioned", "center_updated", "center_locked", "center_unlocked",
  "center_admin_password_reset", "center_migrations_run", "center_backup",
  "plan_created", "plan_updated", "plan_deleted",
  "license_created", "license_revoked", "license_reassigned",
  "ops_migrate_all", "ops_backup_all",
]

export default function AuditPage() {
  const { t } = useT()
  const [logs, setLogs] = useState<Log[]>([])
  const [total, setTotal] = useState(0)
  const [action, setAction] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: "50" })
    if (action) params.set("action", action)
    const res = await fetch(`/api/master/audit?${params}`)
    const data = await res.json()
    setLogs(data.data ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, action])

  useEffect(() => { load() }, [load])

  const pageCount = Math.ceil(total / 50)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("audit.title")}</h1>

      <div className="flex gap-3">
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm">
          <option value="">{t("audit.allActions")}</option>
          {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-gray-500 text-sm self-center">{total} {t("audit.entries")}</span>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-start px-4 py-3">{t("audit.colAction")}</th>
              <th className="text-start px-4 py-3">{t("audit.colUser")}</th>
              <th className="text-start px-4 py-3">{t("audit.colTime")}</th>
              <th className="text-start px-4 py-3">{t("audit.colDetails")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">{t("loading")}</td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-600">{t("audit.empty")}</td></tr>}
            {logs.map((log) => (
              <Fragment key={log.id}>
                <tr className="border-b border-gray-800 hover:bg-gray-800/30 cursor-pointer"
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                  <td className="px-4 py-2.5 font-mono text-indigo-300 text-xs">{log.action}</td>
                  <td className="px-4 py-2.5 text-gray-300">{log.master_username ?? t("na")}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{log.details ? t("audit.expand") : t("na")}</td>
                </tr>
                {expanded === log.id && log.details && (
                  <tr className="border-b border-gray-800 bg-gray-950">
                    <td colSpan={4} className="px-6 py-3">
                      <pre className="text-xs text-gray-400 overflow-auto max-h-40">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(pageCount, 10) }, (_, i) => i + 1).map((p) => (
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
