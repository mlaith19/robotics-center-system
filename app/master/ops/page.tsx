"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useT } from "@/lib/master-i18n"

interface OpsRun {
  id: string
  type: string
  status: string
  started_at: string
  finished_at: string | null
  details: Record<string, unknown> | null
}

interface CenterMigStatus {
  centerId: string
  name: string
  subdomain: string
  migratedVersion: number
  appVersion: number
  needsMigration: boolean
}

interface MigrationStatus {
  appVersion: number
  needsMigrationCount: number
  changelog: Record<string, string>
  centers: CenterMigStatus[]
}

interface CenterOption {
  id: string
  name: string
  subdomain: string
}

interface MigrateResultItem {
  centerId: string
  centerName?: string
  status: string
  durationMs: number
  errorMessage?: string
  errorStack?: string
  appliedMigrations?: string[]
}

interface MigrateRunState {
  runId: string
  startedAt: string
  status: string
  totalCenters: number
  results: MigrateResultItem[]
  summary?: Record<string, unknown>
}

const POLL_INTERVAL_MS = 2000

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "bg-green-900 text-green-300",
    failed: "bg-red-900 text-red-300",
    running: "bg-yellow-900 text-yellow-300",
    skipped: "bg-gray-700 text-gray-400",
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status] ?? "bg-gray-700 text-gray-400"}`}>
      {status}
    </span>
  )
}

function MigrationBanner({
  migStatus,
  onRunAll,
}: {
  migStatus: MigrationStatus
  onRunAll: () => void
}) {
  if (migStatus.needsMigrationCount === 0) {
    return (
      <div className="bg-green-950 border border-green-800 rounded-xl px-5 py-3 flex items-center gap-3">
        <span className="text-green-400 text-lg">✓</span>
        <div>
          <p className="text-sm font-semibold text-green-300">
            כל המרכזים מעודכנים (v{migStatus.appVersion})
          </p>
          <p className="text-xs text-green-700 mt-0.5">{migStatus.changelog[migStatus.appVersion]}</p>
        </div>
      </div>
    )
  }

  const behind = migStatus.centers.filter((c) => c.needsMigration)
  return (
    <div className="bg-yellow-950 border-2 border-yellow-600 rounded-xl p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-yellow-400 text-2xl mt-0.5">⚠</span>
        <div className="flex-1">
          <p className="text-base font-bold text-yellow-300">
            נדרשת מיגרציה — {migStatus.needsMigrationCount} מרכז{migStatus.needsMigrationCount > 1 ? "ים" : ""} מאחורים
          </p>
          <p className="text-xs text-yellow-600 mt-0.5">
            גרסת אפליקציה: v{migStatus.appVersion} — {migStatus.changelog[migStatus.appVersion] ?? "ראה lib/schema-version.ts"}
          </p>
        </div>
        <button
          onClick={onRunAll}
          className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg text-sm transition shrink-0"
        >
          הרץ מיגרציות לכל הדיירים
        </button>
      </div>
      <div className="space-y-1">
        {behind.map((c) => (
          <div key={c.centerId} className="bg-yellow-900/40 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs">
            <span className="text-yellow-200 font-medium">{c.name} ({c.subdomain})</span>
            <span className="text-yellow-600">v{c.migratedVersion} → v{c.appVersion}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OpsPage() {
  const { t } = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlCenterId = searchParams.get("centerId") ?? ""

  const [runs, setRuns] = useState<OpsRun[]>([])
  const [loading, setLoading] = useState(true)
  const [migStatus, setMigStatus] = useState<MigrationStatus | null>(null)
  const [runningBackup, setRunningBackup] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  // New migrate UI
  const [centers, setCenters] = useState<CenterOption[]>([])
  const [mode, setMode] = useState<"all" | "one" | "selected" | "failed_only">("all")
  const [selectedCenterId, setSelectedCenterId] = useState("")
  const [selectedCenterIds, setSelectedCenterIds] = useState<Set<string>>(new Set())
  const [dryRun, setDryRun] = useState(false)
  const [migrateRun, setMigrateRun] = useState<MigrateRunState | null>(null)
  const [pollingRunId, setPollingRunId] = useState<string | null>(null)
  const [resultFilter, setResultFilter] = useState<"all" | "success" | "failed">("all")
  const [lastFailures, setLastFailures] = useState<MigrateResultItem[]>([])
  const [expandError, setExpandError] = useState<string | null>(null)

  const loadStatus = useCallback(() => {
    return fetch("/api/master/ops/status")
      .then((r) => r.json())
      .then(setRuns)
      .finally(() => setLoading(false))
  }, [])

  const loadMigrationStatus = useCallback(() => {
    return fetch("/api/master/ops/migration-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MigrationStatus | null) => { if (data) setMigStatus(data) })
      .catch(() => null)
  }, [])

  const loadCenters = useCallback(() => {
    fetch("/api/master/centers?pageSize=500")
      .then((r) => r.json())
      .then((d: { data?: { id: string; name: string; subdomain: string }[] }) => {
        const list = Array.isArray(d.data) ? d.data : []
        setCenters(list)
        if (urlCenterId && !selectedCenterId) setSelectedCenterId(urlCenterId)
      })
      .catch(() => {})
  }, [urlCenterId, selectedCenterId])

  const loadLastFailures = useCallback(() => {
    fetch("/api/master/ops/migrate/last")
      .then((r) => r.json())
      .then((d: { failures?: MigrateResultItem[] }) => setLastFailures(d.failures ?? []))
      .catch(() => setLastFailures([]))
  }, [])

  useEffect(() => {
    loadStatus()
    loadMigrationStatus()
    loadCenters()
    loadLastFailures()
  }, [loadStatus, loadMigrationStatus, loadCenters, loadLastFailures])

  useEffect(() => {
    if (urlCenterId && mode === "one") setSelectedCenterId(urlCenterId)
  }, [urlCenterId, mode])

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }, [])

  const runMigrate = useCallback(async () => {
    type Body = { mode: string; dryRun: boolean; centerId?: string; centerIds?: string[] }
    const body: Body = { mode, dryRun }
    if (mode === "one") {
      if (!selectedCenterId) { showToast("בחר מרכז", "error"); return }
      body.centerId = selectedCenterId
    }
    if (mode === "selected") {
      const ids = Array.from(selectedCenterIds)
      if (ids.length === 0) { showToast("בחר לפחות מרכז אחד", "error"); return }
      body.centerIds = ids
    }
    const res = await fetch("/api/master/ops/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showToast(err.error ?? "שגיאה בהרצת מיגרציה", "error")
      return
    }
    const data = await res.json()
    setMigrateRun({
      runId: data.runId,
      startedAt: data.startedAt,
      status: "running",
      totalCenters: data.totalCenters,
      results: [],
    })
    setPollingRunId(data.runId)
    showToast(`הרצה התחילה — ${data.totalCenters} מרכזים`, "success")
  }, [mode, dryRun, selectedCenterId, selectedCenterIds, showToast])

  useEffect(() => {
    if (!pollingRunId) return
    const t = setInterval(async () => {
      const res = await fetch(`/api/master/ops/migrate?runId=${encodeURIComponent(pollingRunId)}`)
      if (!res.ok) return
      const data = await res.json()
      setMigrateRun({
        runId: data.runId,
        startedAt: data.startedAt,
        status: data.status,
        totalCenters: data.totalCenters,
        results: data.results ?? [],
        summary: data.summary,
      })
      if (data.status === "completed" || data.status === "partial") {
        setPollingRunId(null)
        loadStatus()
        loadMigrationStatus()
        loadLastFailures()
        const failed = (data.results ?? []).filter((r: MigrateResultItem) => r.status === "failed").length
        if (failed > 0) {
          showToast(`${failed} מרכזים נכשלו — ראה טבלה`, "error")
        } else {
          showToast("כל המיגרציות הושלמו בהצלחה", "success")
        }
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [pollingRunId, loadStatus, loadMigrationStatus, loadLastFailures, showToast])

  const runMigrateAll = useCallback(() => {
    setMode("all")
    setMigrateRun(null)
    setTimeout(() => runMigrate(), 0)
  }, [runMigrate])

  const runBackupAll = useCallback(async () => {
    if (!confirm(t("ops.backup") + "?")) return
    setRunningBackup(true)
    const res = await fetch("/api/master/ops/backup-all-tenants", { method: "POST" })
    const data = await res.json()
    setRunningBackup(false)
    setResult(data)
    showToast(data.status === "success" ? `✓ ${t("ops.backup")}` : `✗ ${data.failed ?? 0} failed`, data.status === "success" ? "success" : "error")
    loadStatus()
  }, [t, showToast, loadStatus])

  const setCenterInUrl = useCallback(
    (centerId: string) => {
      const u = new URL(window.location.href)
      if (centerId) u.searchParams.set("centerId", centerId)
      else u.searchParams.delete("centerId")
      router.replace(u.pathname + u.search)
    },
    [router]
  )

  const toggleSelectedCenter = useCallback((id: string) => {
    setSelectedCenterIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const copyError = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    showToast("הועתק ללוח", "success")
  }, [showToast])

  const currentRunResults = migrateRun?.results ?? []
  const filteredResults =
    resultFilter === "all"
      ? currentRunResults
      : resultFilter === "failed"
        ? currentRunResults.filter((r) => r.status === "failed")
        : currentRunResults.filter((r) => r.status === "success")
  const failedCount = currentRunResults.filter((r) => r.status === "failed").length
  const selectedCenter = centers.find((c) => c.id === selectedCenterId || c.id === urlCenterId)

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 end-4 z-50 px-5 py-3 rounded-xl shadow-xl text-sm ${
            toast.type === "error" ? "bg-red-800 text-white" : "bg-green-800 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Center ID chip + failures banner */}
      <div className="flex flex-wrap items-center gap-2">
        {(urlCenterId || selectedCenter) && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-900/60 text-indigo-200 text-xs font-medium px-3 py-1">
            <span>Center:</span>
            <span className="font-mono">{urlCenterId || selectedCenterId}</span>
            {selectedCenter && <span className="text-indigo-400">({selectedCenter.name})</span>}
          </span>
        )}
        {lastFailures.length > 0 && (
          <div className="flex-1 min-w-0 rounded-xl bg-red-950 border border-red-800 px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-red-200 text-sm font-medium">
              יש מרכזים שנכשלו בריצה האחרונה — לחץ להרצה חוזרת רק לנכשלים
            </span>
            <button
              type="button"
              onClick={async () => {
                const res = await fetch("/api/master/ops/migrate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mode: "failed_only", dryRun: false }),
                })
                if (!res.ok) { showToast("שגיאה בהרצה", "error"); return }
                const data = await res.json()
                setMigrateRun({ runId: data.runId, startedAt: data.startedAt, status: "running", totalCenters: data.totalCenters, results: [] })
                setPollingRunId(data.runId)
                showToast(`מריץ רק נכשלים — ${data.totalCenters} מרכזים`, "success")
              }}
              className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition shrink-0"
            >
              הרץ רק נכשלים
            </button>
          </div>
        )}
      </div>

      <h1 className="text-2xl font-bold text-white">{t("ops.title")}</h1>

      {migStatus && (
        <MigrationBanner migStatus={migStatus} onRunAll={runMigrateAll} />
      )}

      {/* New migrate section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">מיגרציות לפי מרכז</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">מצב</span>
            <select
              value={mode}
              onChange={(e) => {
                const v = e.target.value as typeof mode
                setMode(v)
                if (v === "one" && urlCenterId) setSelectedCenterId(urlCenterId)
                if (v !== "one") setCenterInUrl("")
              }}
              className="bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">כל המרכזים</option>
              <option value="one">מרכז אחד</option>
              <option value="selected">בחירה מרובה</option>
              <option value="failed_only">רק נכשלים (מריצה אחרונה)</option>
            </select>
          </label>
          {mode === "one" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">מרכז</span>
              <select
                value={selectedCenterId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedCenterId(id)
                  setCenterInUrl(id)
                }}
                className="bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm min-w-[200px]"
              >
                <option value="">— בחר —</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.subdomain})
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "selected" && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">מרכזים</span>
              <select
                multiple
                value={Array.from(selectedCenterIds)}
                onChange={(e) => {
                  const ids = Array.from(e.target.selectedOptions, (o) => o.value)
                  setSelectedCenterIds(new Set(ids))
                }}
                className="bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm min-h-[80px] min-w-[220px]"
              >
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.subdomain})
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">נבחרו: {selectedCenterIds.size}</span>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded border-gray-600"
            />
            <span className="text-sm text-gray-300">Dry Run (לא מריץ SQL)</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={runMigrate}
              disabled={!!pollingRunId || runningBackup}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition"
            >
              {pollingRunId ? "מריץ…" : "הרץ מיגרציות"}
            </button>
            {mode === "all" && (
              <button
                onClick={runMigrateAll}
                disabled={!!pollingRunId || runningBackup}
                className="bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-black font-semibold px-5 py-2 rounded-lg text-sm transition"
              >
                הרץ לכל הדיירים
              </button>
            )}
            <button
              onClick={runBackupAll}
              disabled={!!pollingRunId || runningBackup}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 font-semibold px-5 py-2 rounded-lg text-sm transition"
            >
              {runningBackup ? t("ops.backupRunning") : t("ops.backup")}
            </button>
          </div>
        </div>

        {migrateRun && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{
                      width: migrateRun.status === "running"
                        ? `${Math.min(100, (currentRunResults.length / migrateRun.totalCenters) * 100)}%`
                        : "100%",
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {migrateRun.status === "running"
                    ? `מריץ… ${currentRunResults.length} / ${migrateRun.totalCenters}`
                    : `הושלם — ${currentRunResults.length} מרכזים`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResultFilter("all")}
                  className={`text-xs px-2 py-1 rounded ${resultFilter === "all" ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-400"}`}
                >
                  הכל
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter("success")}
                  className={`text-xs px-2 py-1 rounded ${resultFilter === "success" ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-400"}`}
                >
                  הצלחות
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter("failed")}
                  className={`text-xs px-2 py-1 rounded ${resultFilter === "failed" ? "bg-red-800 text-red-200" : "bg-gray-800 text-gray-400"}`}
                >
                  נכשלים ({failedCount})
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="py-2 pr-2">מרכז (ID)</th>
                    <th className="py-2 pr-2">שם</th>
                    <th className="py-2 pr-2">סטטוס</th>
                    <th className="py-2 pr-2">משך (ms)</th>
                    <th className="py-2 pr-2">שגיאה</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r) => (
                    <tr key={r.centerId} className="border-b border-gray-800">
                      <td className="py-1.5 pr-2 font-mono text-xs">{r.centerId.slice(0, 8)}…</td>
                      <td className="py-1.5 pr-2 text-gray-300">{r.centerName ?? "—"}</td>
                      <td className="py-1.5 pr-2">
                        <StatusChip status={r.status} />
                      </td>
                      <td className="py-1.5 pr-2 text-gray-400">{r.durationMs}</td>
                      <td className="py-1.5 pr-2">
                        {r.status === "failed" && r.errorMessage && (
                          <div className="flex items-start gap-1">
                            <button
                              type="button"
                              onClick={() => copyError(r.errorMessage!)}
                              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-1.5 py-0.5 rounded shrink-0"
                            >
                              העתק שגיאה
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandError(expandError === r.centerId ? null : r.centerId)}
                              className="text-xs text-yellow-400 shrink-0"
                            >
                              {expandError === r.centerId ? "סגור" : "הרחב"}
                            </button>
                            <span className="text-red-300 text-xs truncate max-w-[200px] block" title={r.errorMessage}>
                              {r.errorMessage}
                            </span>
                            {expandError === r.centerId && (
                              <pre className="mt-1 p-2 bg-gray-950 rounded text-xs text-red-200 whitespace-pre-wrap break-all">
                                {r.errorMessage}
                                {r.errorStack && `\n${r.errorStack}`}
                              </pre>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {result && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">{t("ops.resultTitle")} (Backup)</h3>
          <pre className="text-xs text-gray-400 overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">{t("ops.runsTitle")}</h2>
        {loading && <p className="text-gray-500">{t("loading")}</p>}
        <div className="grid gap-3">
          {runs.map((run) => (
            <div
              key={run.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-white">{run.type}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(run.started_at).toLocaleString()}
                  {run.finished_at && ` → ${new Date(run.finished_at).toLocaleString()}`}
                </p>
              </div>
              <StatusChip status={run.status} />
            </div>
          ))}
          {!loading && runs.length === 0 && <p className="text-gray-600">{t("ops.empty")}</p>}
        </div>
      </div>
    </div>
  )
}
