"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useT } from "@/lib/master-i18n"

interface Center {
  id: string; name: string; subdomain: string; status: string
  tenant_db_url: string; admin_username: string | null
  created_at: string; updated_at: string
  domains: string[]; plan_id: string | null; plan_name: string | null
  is_trial: boolean; start_date: string | null; end_date: string | null
}

type Tab = "overview" | "license" | "admin" | "users" | "ops" | "audit"

const LICENSE_MONTHS = [
  { value: 1,  label: "חודש אחד" },
  { value: 3,  label: "3 חודשים" },
  { value: 6,  label: "6 חודשים" },
  { value: 9,  label: "9 חודשים" },
  { value: 12, label: "שנה (12 חודשים)" },
]

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="fixed top-4 end-4 bg-indigo-700 text-white px-5 py-3 rounded-xl shadow-xl z-50 text-sm">
      {message}
    </div>
  )
}

export default function CenterDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useT()
  const [center, setCenter] = useState<Center | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("overview")
  const [toast, setToast] = useState("")
  const [opsRunning, setOpsRunning] = useState(false)
  const [tempPassword, setTempPassword] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  // License
  const [licenseMonths, setLicenseMonths] = useState(12)
  const [licensePlanId, setLicensePlanId] = useState("")
  const [licenseLoading, setLicenseLoading] = useState(false)
  const [plans, setPlans] = useState<{ id: string; name: string; monthly_price?: number | null }[]>([])

  useEffect(() => {
    fetch("/api/master/plans")
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (data.plans ?? [])
        setPlans(list)
        if (list.length > 0) setLicensePlanId(list[0].id)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/master/centers/${id}`)
    if (!res.ok) { router.replace("/master/centers"); return }
    setCenter(await res.json()); setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function doAction(url: string, method = "POST", body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }

  async function handleLockUnlock(action: "lock" | "unlock") {
    await doAction(`/api/master/centers/${id}/${action}`)
    setToast(action === "lock" ? t("centers.locked") : t("centers.unlocked"))
    load()
  }

  async function handleRunMigrations() {
    setOpsRunning(true)
    const data = await doAction(`/api/master/centers/${id}/run-tenant-migrations`)
    setOpsRunning(false)
    setToast(data.ok ? t("center.migrateOk") : `${t("common.error")}: ${data.error}`)
  }

  async function handleBackup() {
    setOpsRunning(true)
    const data = await doAction(`/api/master/centers/${id}/backup`)
    setOpsRunning(false)
    setToast(data.ok ? t("center.backupOk") : `${t("common.error")}: ${data.error}`)
  }

  async function handleAssignLicense() {
    setLicenseLoading(true)
    const res = await fetch(`/api/master/centers/${id}/assign-license`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: licensePlanId, months: licenseMonths }),
    })
    const data = await res.json()
    setLicenseLoading(false)
    if (data.ok) { setToast(`רישיון ל-${licenseMonths} חודשים הוקצה בהצלחה`); load() }
    else setToast(`שגיאה: ${data.error}`)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/master/centers/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (data.ok) {
      router.replace("/master/centers")
    } else {
      setDeleting(false)
      setShowDeleteModal(false)
      setToast(`שגיאה: ${data.error}`)
    }
  }

  async function handleResetPassword() {
    const data = await doAction(`/api/master/centers/${id}/reset-admin-password`)
    if (data.tempPassword) { setTempPassword(data.tempPassword); setToast(t("center.resetTitle")) }
    else setToast(`${t("common.error")}: ${data.error}`)
  }

  if (loading) return <p className="text-gray-400">{t("loading")}</p>
  if (!center) return null

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("center.tabOverview") },
    { id: "license", label: "רישיון" },
    { id: "admin", label: t("center.tabAdmin") },
    { id: "users", label: "👥 משתמשים" },
    { id: "ops", label: t("center.tabOps") },
    { id: "audit", label: t("center.tabAudit") },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      {toast && <Toast message={toast} onClose={() => setToast("")} />}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-red-400">מחיקת מרכז — פעולה בלתי הפיכה</h2>
            <p className="text-sm text-gray-400">
              המרכז <span className="text-white font-semibold">{center.name}</span> ימחק לצמיתות יחד עם כל הדומיינים, המנויים וההגדרות שלו.
              <br /><br />
              <span className="text-yellow-400">⚠ בסיס הנתונים של הטנאנט לא יימחק אוטומטית.</span>
            </p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                כדי לאשר, הקלד את שם ה-subdomain: <span className="text-white font-mono">{center.subdomain}</span>
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={center.subdomain}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== center.subdomain || deleting}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition"
              >
                {deleting ? "מוחק..." : "מחק לצמיתות"}
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText("") }}
                disabled={deleting}
                className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{center.name}</h1>
          <p className="text-gray-400 text-sm font-mono">{center.subdomain}</p>
        </div>
        <div className="flex gap-2">
          {center.status === "active" ? (
            <button onClick={() => handleLockUnlock("lock")}
              className="text-sm bg-red-900 hover:bg-red-800 text-red-200 px-4 py-2 rounded-lg">
              {t("center.lockBtn")}
            </button>
          ) : (
            <button onClick={() => handleLockUnlock("unlock")}
              className="text-sm bg-green-900 hover:bg-green-800 text-green-200 px-4 py-2 rounded-lg">
              {t("center.unlockBtn")}
            </button>
          )}
          <button
            onClick={() => { setShowDeleteModal(true); setDeleteConfirmText("") }}
            className="text-sm bg-gray-800 hover:bg-red-950 border border-gray-700 hover:border-red-800 text-gray-400 hover:text-red-400 px-4 py-2 rounded-lg transition"
            title="מחק מרכז"
          >
            🗑 מחק
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-800">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-4 py-2.5 text-sm font-medium transition ${
              tab === tb.id ? "border-b-2 border-indigo-500 text-indigo-300" : "text-gray-500 hover:text-gray-300"
            }`}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label={t("center.status")}>
            <span className={`text-sm font-semibold ${center.status === "active" ? "text-green-400" : "text-red-400"}`}>
              {center.status}
            </span>
          </InfoRow>
          <InfoRow label={t("center.plan")}>
            {center.plan_name ?? t("na")} {center.is_trial && <span className="text-yellow-400 text-xs">{t("trial")}</span>}
          </InfoRow>
          <InfoRow label={t("center.subscription")}>{center.start_date ? `${center.start_date} → ${center.end_date}` : t("na")}</InfoRow>
          <InfoRow label={t("center.domains")}>{(center.domains ?? []).join(", ") || t("na")}</InfoRow>
          <InfoRow label={t("center.created")}>{new Date(center.created_at).toLocaleString()}</InfoRow>
          <InfoRow label={t("center.updated")}>{new Date(center.updated_at).toLocaleString()}</InfoRow>
        </div>
      )}

      {tab === "license" && (
        <div className="space-y-4">
          {/* Current subscription status */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">רישיון נוכחי</h3>
            {center.plan_name && center.start_date ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500 mb-0.5">תוכנית</p>
                  <p className="text-sm text-white font-semibold">{center.plan_name}
                    {center.is_trial && <span className="ms-2 text-xs text-yellow-400 font-normal">(ניסיון)</span>}
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500 mb-0.5">תוקף</p>
                  <p className="text-sm text-white font-mono">{center.start_date} → {center.end_date}</p>
                </div>
                <div className="bg-gray-800 rounded-lg px-4 py-3 col-span-2">
                  <p className="text-xs text-gray-500 mb-0.5">סטטוס</p>
                  {(() => {
                    const end = center.end_date ? new Date(center.end_date) : null
                    const now = new Date()
                    if (!end) return <p className="text-sm text-gray-400">לא מוגדר</p>
                    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    if (daysLeft < 0) return <p className="text-sm text-red-400 font-semibold">פג תוקף לפני {Math.abs(daysLeft)} ימים</p>
                    if (daysLeft <= 30) return <p className="text-sm text-yellow-400 font-semibold">פג תוקף בעוד {daysLeft} ימים ⚠</p>
                    return <p className="text-sm text-green-400 font-semibold">פעיל — נותרו {daysLeft} ימים</p>
                  })()}
                </div>
              </div>
            ) : (
              <div className="bg-red-950/40 border border-red-800 rounded-lg px-4 py-3">
                <p className="text-sm text-red-400">אין רישיון פעיל — המרכז במצב הפעלה בלבד</p>
              </div>
            )}
          </div>

          {/* Assign new license */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300">הקצה רישיון חדש</h3>
            <p className="text-xs text-gray-500">הרישיון החדש מתחיל מהיום ומחליף את הרישיון הנוכחי.</p>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">תוכנית</label>
              <select
                value={licensePlanId}
                onChange={e => setLicensePlanId(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {plans.length === 0 && <option value="">אין תוכניות — צור תוכנית קודם</option>}
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.monthly_price != null ? ` · ₪${Number(p.monthly_price).toFixed(0)}/חודש` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2">תקופה</label>
              <div className="grid grid-cols-5 gap-2">
                {LICENSE_MONTHS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLicenseMonths(opt.value)}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition ${
                      licenseMonths === opt.value
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-indigo-700 hover:text-white"
                    }`}
                  >
                    {opt.value === 12 ? "שנה" : `${opt.value}מ׳`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                נבחר: {LICENSE_MONTHS.find(o => o.value === licenseMonths)?.label} ·{" "}
                תוקף עד: {(() => {
                  const d = new Date(); d.setMonth(d.getMonth() + licenseMonths)
                  return d.toLocaleDateString("he-IL")
                })()}
              </p>
            </div>

            <button
              onClick={handleAssignLicense}
              disabled={licenseLoading || !licensePlanId || plans.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg text-sm transition"
            >
              {licenseLoading ? "מקצה..." : `הקצה רישיון ל-${LICENSE_MONTHS.find(o => o.value === licenseMonths)?.label}`}
            </button>
          </div>
        </div>
      )}

      {tab === "admin" && (
        <div className="space-y-4">

          {/* Admin credentials card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">פרטי כניסה למרכז</h3>
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">שם משתמש (Admin)</p>
                  <p className="font-mono text-white text-sm">
                    {center.admin_username ?? <span className="text-gray-600 italic">לא ידוע</span>}
                  </p>
                </div>
                {center.admin_username && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(center.admin_username!); setToast("שם משתמש הועתק") }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0"
                  >
                    העתק
                  </button>
                )}
              </div>
              <div className="bg-gray-800 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">כתובת כניסה (Dev)</p>
                <p className="font-mono text-indigo-300 text-sm break-all">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/login?center=${encodeURIComponent(center.subdomain)}`
                    : `http://localhost:3000/login?center=${encodeURIComponent(center.subdomain)}`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  בלוקל חובה <code className="text-gray-400">?center=</code> כדי לבחור את המרכז — אחרת נטען ברירת המחדל מ־DEFAULT_DEV_CENTER.
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Subdomain (פרודקשן)</p>
                <p className="font-mono text-gray-300 text-sm">
                  {center.subdomain}.{process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com"}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              הסיסמה אינה מאוחסנת. לאיפוס השתמש בכפתור למטה.
            </p>
          </div>

          {/* Reset password */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300">{t("center.resetTitle")}</h3>
            <p className="text-xs text-gray-500">{t("center.resetDesc")}</p>
            <button onClick={handleResetPassword}
              className="bg-yellow-800 hover:bg-yellow-700 text-yellow-200 text-sm px-4 py-2 rounded-lg">
              {t("center.resetBtn")}
            </button>
            {tempPassword && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-3 text-sm text-yellow-200">
                <p className="font-semibold">{t("center.tempPwdTitle")}</p>
                <p className="font-mono text-lg mt-1">{tempPassword}</p>
                <p className="text-xs text-yellow-600 mt-2">שמור את הסיסמה — היא לא תוצג שוב</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "ops" && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300">{t("center.opsTitle")}</h3>
            <div className="flex gap-3">
              <button onClick={handleRunMigrations} disabled={opsRunning}
                className="bg-indigo-800 hover:bg-indigo-700 disabled:opacity-50 text-indigo-200 text-sm px-4 py-2 rounded-lg">
                {opsRunning ? t("center.running") : t("center.migrateBtn")}
              </button>
              <button onClick={handleBackup} disabled={opsRunning}
                className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm px-4 py-2 rounded-lg">
                {opsRunning ? t("center.running") : t("center.backupBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "users" && <UsersTab centerId={id} />}

      {tab === "audit" && <AuditTab centerId={id} noAuditText={t("center.noAudit")} colAction={t("audit.colAction")} colUser={t("audit.colUser")} colTime={t("audit.colTime")} na={t("na")} />}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-white">{children}</p>
    </div>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

interface TenantUser {
  id: string
  username: string
  name: string | null
  email: string | null
  role: string | null
  role_name: string | null
  role_key: string | null
  status: string
  force_password_reset: boolean | null
  locked_until: string | null
  createdAt: string
}

const ROLE_OPTIONS = [
  { value: "center_admin", label: "מנהל מרכז" },
  { value: "admin",        label: "אדמין" },
  { value: "teacher",      label: "מורה" },
  { value: "secretary",    label: "מזכירה" },
  { value: "coordinator",  label: "רכז" },
  { value: "student",      label: "תלמיד" },
]

function roleBadge(role: string | null) {
  const r = (role ?? "").toLowerCase()
  const colors: Record<string, string> = {
    center_admin: "bg-indigo-900 text-indigo-300 border-indigo-700",
    admin:        "bg-indigo-900 text-indigo-300 border-indigo-700",
    teacher:      "bg-blue-900 text-blue-300 border-blue-700",
    student:      "bg-green-900 text-green-300 border-green-700",
    secretary:    "bg-purple-900 text-purple-300 border-purple-700",
    coordinator:  "bg-teal-900 text-teal-300 border-teal-700",
    user:         "bg-red-900 text-red-300 border-red-700",
  }
  const label = ROLE_OPTIONS.find(o => o.value === r)?.label ?? role ?? "—"
  const cls   = colors[r] ?? "bg-gray-800 text-gray-400 border-gray-700"
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}

function UsersTab({ centerId }: { centerId: string }) {
  const [users,   setUsers]   = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")
  const [saving,  setSaving]  = useState<string | null>(null) // userId being saved
  const [editRole, setEditRole] = useState<Record<string, string>>({})
  const [saved,   setSaved]   = useState<string | null>(null) // userId just saved

  useEffect(() => {
    setLoading(true)
    fetch(`/api/master/centers/${centerId}/users`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        const list: TenantUser[] = d.users ?? []
        setUsers(list)
        // Init edit state with current roles
        const init: Record<string, string> = {}
        list.forEach(u => { init[u.id] = u.role ?? "user" })
        setEditRole(init)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [centerId])

  async function saveRole(userId: string) {
    const newRole = editRole[userId]
    setSaving(userId)
    const res  = await fetch(`/api/master/centers/${centerId}/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    })
    const data = await res.json()
    setSaving(null)
    if (data.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setSaved(userId)
      setTimeout(() => setSaved(null), 2000)
    } else {
      alert(`שגיאה: ${data.error}`)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
      <svg className="animate-spin h-5 w-5 me-2 text-indigo-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      טוען משתמשים...
    </div>
  )

  if (error) return (
    <div className="bg-red-950/40 border border-red-800 rounded-xl p-5 text-sm text-red-400">
      ❌ {error}
      {error.includes("connect") && (
        <p className="text-xs mt-2 text-red-600">ודא ש-Docker פועל ובסיס הנתונים של המרכז נגיש.</p>
      )}
    </div>
  )

  if (users.length === 0) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
      אין משתמשים ב-DB של המרכז הזה.
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{users.length} משתמשים ב-DB של המרכז</p>
        <p className="text-xs text-gray-600">ניתן לשנות תפקיד ישירות מכאן</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="text-start px-4 py-3">שם משתמש</th>
              <th className="text-start px-4 py-3">שם מלא</th>
              <th className="text-start px-4 py-3">אימייל</th>
              <th className="text-start px-4 py-3">תפקיד נוכחי</th>
              <th className="text-start px-4 py-3">שינוי תפקיד</th>
              <th className="text-start px-4 py-3">סטטוס</th>
              <th className="text-start px-4 py-3">נוצר</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isAdmin = ["center_admin", "admin"].includes((u.role ?? "").toLowerCase())
              const isBadRole = !u.role || u.role === "user"
              const isDirty = (editRole[u.id] ?? u.role) !== u.role
              return (
                <tr key={u.id} className={`border-b border-gray-800 hover:bg-gray-800/40 transition ${isBadRole ? "bg-red-950/20" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isAdmin ? "bg-indigo-500" : "bg-gray-600"}`} />
                      <span className="font-mono text-white text-xs">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{u.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {roleBadge(u.role)}
                      {isBadRole && (
                        <span className="text-xs text-red-400" title="תפקיד זה לא מורשה לגשת לדשבורד">⚠</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={editRole[u.id] ?? u.role ?? "user"}
                        onChange={e => setEditRole(prev => ({ ...prev, [u.id]: e.target.value }))}
                        className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {ROLE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {isDirty && (
                        <button
                          onClick={() => saveRole(u.id)}
                          disabled={saving === u.id}
                          className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
                        >
                          {saving === u.id ? "שומר..." : "שמור"}
                        </button>
                      )}
                      {saved === u.id && (
                        <span className="text-xs text-green-400">✓ נשמר</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${u.status === "active" ? "text-green-400" : "text-gray-500"}`}>
                      {u.status === "active" ? "פעיל" : u.status}
                    </span>
                    {u.force_password_reset && (
                      <span className="block text-xs text-yellow-500">⚡ שינוי סיסמה נדרש</span>
                    )}
                    {u.locked_until && new Date(u.locked_until) > new Date() && (
                      <span className="block text-xs text-red-400">🔒 נעול</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("he-IL") : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {users.some(u => !u.role || u.role === "user") && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl px-4 py-3 text-xs text-red-400">
          ⚠ משתמשים עם תפקיד <strong>user</strong> לא יוכלו לגשת לדשבורד (403).
          שנה את תפקידם ל-<strong>center_admin</strong> ובקש מהם להתחבר מחדש.
        </div>
      )}
    </div>
  )
}

// ── Audit Tab ──────────────────────────────────────────────────────────────────

function AuditTab({ centerId, noAuditText, colAction, colUser, colTime, na }: {
  centerId: string; noAuditText: string; colAction: string; colUser: string; colTime: string; na: string
}) {
  const [logs, setLogs] = useState<{ id: string; action: string; created_at: string; master_username: string | null; details: { centerId?: string } | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/master/audit?pageSize=100&centerId=${encodeURIComponent(centerId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setLogs([]); return }
        setLogs(Array.isArray(d.data) ? d.data : [])
      })
      .catch((e) => { setError(e.message); setLogs([]) })
      .finally(() => setLoading(false))
  }, [centerId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
        <span className="animate-pulse">טוען יומן ביקורת...</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-800 rounded-xl p-5 text-sm text-red-400">
        שגיאה בטעינת יומן: {error}
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="text-start px-4 py-3">{colAction}</th>
            <th className="text-start px-4 py-3">{colUser}</th>
            <th className="text-start px-4 py-3">{colTime}</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                <p className="font-medium">{noAuditText}</p>
                <p className="text-xs mt-2 text-gray-600">פעולות כמו איפוס סיסמה, נעילה, הקצאת רישיון או גיבוי יופיעו כאן.</p>
              </td>
            </tr>
          )}
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-800">
              <td className="px-4 py-2.5 font-mono text-indigo-300 text-xs">{log.action}</td>
              <td className="px-4 py-2.5 text-gray-400">{log.master_username ?? na}</td>
              <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(log.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
