"use client"

import { useEffect, useState, useCallback } from "react"
import { useT } from "@/lib/master-i18n"

interface License {
  id: string; status: string; duration_days: number; max_activations: number
  created_at: string; center_id: string | null; center_name: string | null
  plan_id: string; plan_name: string
}
interface LicenseDetail extends License {
  center_subdomain?: string | null
}
interface Plan { id: string; name: string }
interface Center { id: string; name: string; subdomain: string }

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-900 text-green-300",
    revoked: "bg-red-900 text-red-300",
    expired: "bg-gray-700 text-gray-400",
  }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status] ?? "bg-gray-800 text-gray-400"}`}>{status}</span>
}

export default function LicensesPage() {
  const { t } = useT()
  const [licenses, setLicenses] = useState<License[]>([])
  const [total, setTotal] = useState(0)
  const [plans, setPlans] = useState<Plan[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ planId: "", durationDays: "365", maxActivations: "1" })
  const [newKey, setNewKey] = useState("")
  const [creating, setCreating] = useState(false)

  const [detailLicense, setDetailLicense] = useState<LicenseDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ center_id: "" as string | null, duration_days: "", max_activations: "" })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: "20" })
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    const res = await fetch(`/api/master/licenses?${params}`)
    const data = await res.json()
    setLicenses(data.data ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, q, status])

  useEffect(() => { load() }, [load])
  useEffect(() => { fetch("/api/master/plans").then((r) => r.json()).then(setPlans) }, [])
  useEffect(() => {
    fetch("/api/master/centers")
      .then((r) => r.ok ? r.json() : {})
      .then((data: { data?: { id: string; name: string; subdomain: string }[] }) => setCenters(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setCenters([]))
  }, [])

  async function openView(lk: License) {
    setDetailLicense(null)
    setEditMode(false)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/master/licenses/${lk.id}`)
      const data = await res.json()
      if (res.ok) setDetailLicense(data)
      else setToast(data.error || t("common.error"))
    } finally {
      setDetailLoading(false)
    }
  }

  function openEdit(lk: License) {
    setDetailLicense(null)
    setEditMode(true)
    setEditForm({
      center_id: lk.center_id || "",
      duration_days: String(lk.duration_days),
      max_activations: String(lk.max_activations),
    })
    setDetailLoading(true)
    fetch(`/api/master/licenses/${lk.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setDetailLicense(data)
          setEditForm({
            center_id: data.center_id || "",
            duration_days: String(data.duration_days),
            max_activations: String(data.max_activations),
          })
        }
      })
      .finally(() => setDetailLoading(false))
  }

  function closeDetail() {
    setDetailLicense(null)
    setEditMode(false)
  }

  async function saveEdit() {
    if (!detailLicense) return
    setSaving(true)
    try {
      const res = await fetch(`/api/master/licenses/${detailLicense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          center_id: editForm.center_id || null,
          duration_days: parseInt(editForm.duration_days, 10),
          max_activations: parseInt(editForm.max_activations, 10),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setToast(t("common.saved") ?? "נשמר בהצלחה")
        closeDetail()
        load()
      } else {
        setToast(data.error || t("common.error"))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm(t("licenses.revoke") + "?")) return
    const res = await fetch(`/api/master/licenses/${id}/revoke`, { method: "POST" })
    const data = await res.json()
    setToast(res.ok ? t("licenses.revoked") : (data.error || t("common.error")))
    setTimeout(() => setToast(""), 3500)
    load()
  }

  async function handleCreate() {
    if (!newForm.planId) return
    setCreating(true)
    const res = await fetch("/api/master/licenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: newForm.planId, durationDays: Number(newForm.durationDays), maxActivations: Number(newForm.maxActivations) }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setToast(data.error || t("common.error")); return }
    setNewKey(data.rawKey)
    load()
  }

  const pageCount = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 end-4 bg-indigo-700 text-white px-5 py-3 rounded-xl shadow-xl z-50 text-sm">{toast}</div>}

      {/* דיאלוג צפייה / עריכה */}
      {(detailLicense !== null || detailLoading) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => !detailLoading && !saving && closeDetail()}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editMode ? "עריכת רישיון" : "צפייה ברישיון"}</h2>
              <button type="button" onClick={closeDetail} disabled={detailLoading || saving}
                className="text-gray-400 hover:text-white text-xl leading-none disabled:opacity-50">×</button>
            </div>
            <div className="p-5 space-y-4">
              {detailLoading && (
                <div className="py-8 text-center text-gray-500 text-sm">טוען...</div>
              )}
              {!detailLoading && detailLicense && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-gray-500">מזהה</div>
                    <div className="font-mono text-gray-300 text-xs break-all">{detailLicense.id}</div>
                    <div className="text-gray-500">תוכנית</div>
                    <div className="text-gray-300">{detailLicense.plan_name}</div>
                    <div className="text-gray-500">סטטוס</div>
                    <div><StatusChip status={detailLicense.status} /></div>
                    <div className="text-gray-500">ימים</div>
                    <div className="text-gray-300">{detailLicense.duration_days}</div>
                    <div className="text-gray-500">מקס הפעלות</div>
                    <div className="text-gray-300">{detailLicense.max_activations}</div>
                    <div className="text-gray-500">מרכז</div>
                    <div className="text-gray-300">{detailLicense.center_name ?? (detailLicense.center_subdomain ? `(${detailLicense.center_subdomain})` : "— לא מוקצה")}</div>
                    <div className="text-gray-500">נוצר</div>
                    <div className="text-gray-300">{new Date(detailLicense.created_at).toLocaleString("he-IL")}</div>
                  </div>
                  {editMode && detailLicense.status === "active" && (
                    <div className="border-t border-gray-800 pt-4 space-y-3">
                      <label className="block text-xs font-semibold text-gray-400">מרכז</label>
                      <select value={editForm.center_id ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, center_id: e.target.value || null }))}
                        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm">
                        <option value="">— לא מוקצה</option>
                        {centers.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({c.subdomain})</option>
                        ))}
                      </select>
                      <label className="block text-xs font-semibold text-gray-400">ימי תוקף</label>
                      <input type="number" min={1} value={editForm.duration_days}
                        onChange={(e) => setEditForm((p) => ({ ...p, duration_days: e.target.value }))}
                        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm" />
                      <label className="block text-xs font-semibold text-gray-400">מקס הפעלות</label>
                      <input type="number" min={0} value={editForm.max_activations}
                        onChange={(e) => setEditForm((p) => ({ ...p, max_activations: e.target.value }))}
                        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm" />
                      <div className="flex gap-2 pt-2">
                        <button type="button" onClick={saveEdit} disabled={saving}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                          {saving ? "שומר..." : "שמור"}
                        </button>
                        <button type="button" onClick={() => setEditMode(false)}
                          className="px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm py-2 rounded-lg">
                          ביטול
                        </button>
                      </div>
                    </div>
                  )}
                  {!editMode && detailLicense.status === "active" && (
                    <button type="button" onClick={() => {
                      setEditForm({
                        center_id: detailLicense.center_id || "",
                        duration_days: String(detailLicense.duration_days),
                        max_activations: String(detailLicense.max_activations),
                      })
                      setEditMode(true)
                    }}
                      className="w-full mt-2 text-sm text-amber-400 hover:text-amber-300 border border-amber-700 py-2 rounded-lg">
                      עריכה
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t("licenses.title")}</h1>
        <button onClick={() => { setShowNew(!showNew); setNewKey("") }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          {t("licenses.new")}
        </button>
      </div>

      {showNew && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300">{t("licenses.createTitle")}</h2>
          <div className="flex gap-3 flex-wrap">
            <select value={newForm.planId} onChange={(e) => setNewForm((p) => ({ ...p, planId: e.target.value }))}
              className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm">
              <option value="">{t("licenses.selectPlan")}</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" min="1" value={newForm.durationDays}
              onChange={(e) => setNewForm((p) => ({ ...p, durationDays: e.target.value }))}
              placeholder={t("licenses.days")}
              className="w-24 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm" />
            <input type="number" min="1" value={newForm.maxActivations}
              onChange={(e) => setNewForm((p) => ({ ...p, maxActivations: e.target.value }))}
              placeholder={t("licenses.maxAct")}
              className="w-36 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm" />
            <button onClick={handleCreate} disabled={creating}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
              {creating ? t("licenses.generating") : t("licenses.generate")}
            </button>
          </div>
          {newKey && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-3 text-sm text-yellow-200">
              <p className="font-semibold mb-1">{t("licenses.rawKey")}</p>
              <p className="font-mono text-base break-all">{newKey}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <input placeholder={t("licenses.search")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
          className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 text-sm" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm">
          <option value="">{t("licenses.all")}</option>
          <option value="active">{t("centers.statusActive")}</option>
          <option value="revoked">{t("licenses.revoke")}</option>
        </select>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-start px-4 py-3">{t("licenses.colId")}</th>
              <th className="text-start px-4 py-3">{t("licenses.colPlan")}</th>
              <th className="text-start px-4 py-3">{t("licenses.colStatus")}</th>
              <th className="text-start px-4 py-3">{t("licenses.colDays")}</th>
              <th className="text-start px-4 py-3">{t("licenses.colCenter")}</th>
              <th className="text-start px-4 py-3">{t("licenses.colCreated")}</th>
              <th className="text-start px-4 py-3">{t("licenses.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">{t("loading")}</td></tr>}
            {!loading && licenses.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-600">{t("licenses.empty")}</td></tr>}
            {licenses.map((lk) => (
              <tr key={lk.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{lk.id.slice(0, 8)}…</td>
                <td className="px-4 py-2.5 text-gray-300">{lk.plan_name}</td>
                <td className="px-4 py-2.5"><StatusChip status={lk.status} /></td>
                <td className="px-4 py-2.5 text-gray-400">{lk.duration_days}d</td>
                <td className="px-4 py-2.5 text-gray-400">{lk.center_name ?? <span className="text-gray-600">{t("licenses.unassigned")}</span>}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(lk.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => openView(lk)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded">
                      צפייה
                    </button>
                    {lk.status === "active" && (
                      <>
                        <button type="button" onClick={() => openEdit(lk)}
                          className="text-xs text-amber-400 hover:text-amber-300 border border-amber-700 px-2 py-0.5 rounded">
                          עריכה
                        </button>
                        <button onClick={() => handleRevoke(lk.id)}
                          className="text-xs text-red-400 hover:text-red-300 border border-red-800 px-2 py-0.5 rounded">
                          {t("licenses.revoke")}
                        </button>
                      </>
                    )}
                  </div>
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
