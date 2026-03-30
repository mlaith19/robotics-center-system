"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import React from "react"
import { MasterI18nProvider, useT, type Lang } from "@/lib/master-i18n"

interface MasterUser {
  id: string
  username: string
  email: string
  role: string
}

const LANG_CYCLE: Lang[] = ["he", "ar", "en"]
const LANG_LABELS: Record<Lang, string> = { he: "עב", ar: "ع", en: "EN" }

function LangToggle() {
  const { lang, setLang } = useT()
  function next() {
    const idx = LANG_CYCLE.indexOf(lang)
    setLang(LANG_CYCLE[(idx + 1) % LANG_CYCLE.length])
  }
  return (
    <button
      onClick={next}
      className="text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-2.5 py-1 rounded-lg transition font-semibold tracking-wide min-w-[2.5rem]"
      title="Switch language / החלף שפה / تغيير اللغة"
    >
      {LANG_LABELS[lang]}
    </button>
  )
}

type HealthStatus = "ok" | "error" | "unknown" | null

function MasterLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t, isRTL } = useT()
  const [user, setUser] = useState<MasterUser | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [dbStatus, setDbStatus] = useState<HealthStatus>(null)
  const [dockerStatus, setDockerStatus] = useState<HealthStatus>(null)
  const [showDbHelp, setShowDbHelp] = useState(false)

  const isLoginPage = pathname === "/master/login" || pathname.startsWith("/master/login")

  const navItems = [
    { href: "/master", label: t("nav.dashboard"), icon: "⊞" },
    { href: "/master/centers", label: t("nav.centers"), icon: "🏢" },
    { href: "/master/plans", label: t("nav.plans"), icon: "📋" },
    { href: "/master/licenses", label: t("nav.licenses"), icon: "🔑" },
    { href: "/master/audit", label: t("nav.audit"), icon: "📝" },
    { href: "/master/ops", label: t("nav.ops"), icon: "⚙️" },
  ]

  useEffect(() => {
    if (isLoginPage) return
    fetch("/api/master/auth/me")
      .then((r) => {
        if (!r.ok) { router.replace("/master/login"); return null }
        return r.json()
      })
      .then((data) => { if (data) setUser(data) })
      .catch(() => router.replace("/master/login"))
  }, [router, isLoginPage])

  useEffect(() => {
    if (isLoginPage) return
    fetch("/api/health/db")
      .then((r) => r.json())
      .then((d: { status?: string }) => setDbStatus(d.status === "ok" ? "ok" : "error"))
      .catch(() => setDbStatus("error"))
    fetch("/api/health/docker")
      .then((r) => r.json())
      .then((d: { status?: string }) => setDockerStatus(d.status === "running" ? "ok" : d.status === "unknown" ? "unknown" : "error"))
      .catch(() => setDockerStatus("unknown"))
  }, [isLoginPage])

  async function handleLogout() {
    await fetch("/api/master/auth/logout", { method: "POST" })
    router.replace("/master/login")
  }

  if (isLoginPage) return <>{children}</>

  // Sidebar direction helpers
  const sidebarSide = isRTL ? "right-0" : "left-0"
  const sidebarHidden = isRTL ? "translate-x-full" : "-translate-x-full"
  const sidebarBorder = isRTL ? "border-l" : "border-r"
  const hamburgerPos = isRTL ? "top-4 right-4" : "top-4 left-4"

  return (
    <div
      className="flex h-screen bg-gray-950 text-white overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ── Mobile hamburger button ─────────────────────── */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed ${hamburgerPos} z-50 md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition`}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* ── Mobile overlay ──────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 z-40 flex flex-col bg-gray-900 ${sidebarBorder} border-gray-800
          transition-all duration-300 ease-in-out
          ${sidebarSide}
          ${sidebarOpen ? "translate-x-0" : sidebarHidden}
          w-56
          md:relative md:translate-x-0
          ${desktopCollapsed ? "md:w-14" : "md:w-56"}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          {!desktopCollapsed && (
            <span className="text-xs font-bold text-indigo-400 tracking-widest uppercase hidden md:block">
              MASTER
            </span>
          )}
          <span className="text-xs font-bold text-indigo-400 tracking-widest uppercase md:hidden">
            MASTER
          </span>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setDesktopCollapsed(!desktopCollapsed)}
            className="text-gray-400 hover:text-white ml-auto hidden md:block"
            aria-label="Collapse sidebar"
          >
            {desktopCollapsed
              ? (isRTL ? "◀" : "▶")
              : (isRTL ? "▶" : "◀")}
          </button>

          {/* Mobile close button inside sidebar */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-white ml-auto md:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active =
              item.href === "/master"
                ? pathname === "/master"
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 transition text-sm ${
                  active
                    ? "bg-indigo-700 text-white font-semibold"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <span className={desktopCollapsed ? "md:hidden" : ""}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* ── Main area ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 bg-gray-900 border-b border-gray-800">
          {/* Left/right spacer on mobile to avoid overlap with hamburger */}
          <span className="text-sm font-semibold text-gray-300 ps-8 md:ps-0">
            {t("topbar.title")}
          </span>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
            {dbStatus !== null && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  dbStatus === "ok" ? "bg-green-900/60 text-green-300" : "bg-red-900/60 text-red-300"
                }`}
                title="מצב DB"
              >
                DB: {dbStatus === "ok" ? "connected" : "disconnected"}
              </span>
            )}
            {dockerStatus !== null && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  dockerStatus === "ok" ? "bg-green-900/60 text-green-300" : dockerStatus === "unknown" ? "bg-gray-700 text-gray-400" : "bg-red-900/60 text-red-300"
                }`}
                title="מצב Docker"
              >
                Docker: {dockerStatus === "ok" ? "running" : dockerStatus === "unknown" ? "unknown" : "error"}
              </span>
            )}
            <span className="hidden sm:inline-block bg-indigo-800 text-indigo-200 text-xs font-bold px-2.5 py-0.5 rounded-full tracking-widest">
              {t("topbar.badge")}
            </span>
            {user && (
              <span className="text-sm text-gray-400 hidden sm:inline">
                <span className="text-white font-medium">{user.username}</span>
                <span className="mx-1 text-xs text-indigo-400">({user.role})</span>
              </span>
            )}
            <LangToggle />
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-red-400 transition"
            >
              {t("topbar.logout")}
            </button>
          </div>
        </header>

        {dbStatus === "error" && (
          <div className="bg-red-950 border-b border-red-800 px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-red-200 text-sm font-medium">מסד הנתונים לא מחובר. הפעל Docker והרץ את המאסטר DB.</span>
            <button
              type="button"
              onClick={() => setShowDbHelp((v) => !v)}
              className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition"
            >
              {showDbHelp ? "סגור הוראות" : "הצג הוראות הפעלה (Docker Compose)"}
            </button>
            {showDbHelp && (
              <div className="w-full mt-2 p-3 bg-gray-900 rounded-lg text-xs text-gray-300 font-mono space-y-1">
                <p>1. הרץ: docker compose up -d (או docker-compose)</p>
                <p>2. וודא ש-DATABASE_URL מצביע ל-PostgreSQL (למשל localhost:5432/robotics)</p>
                <p>3. הרץ מיגרציות מאסטר אם נדרש: npx prisma migrate deploy (או לפי התיעוד)</p>
              </div>
            )}
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <MasterI18nProvider>
      <MasterLayoutInner>{children}</MasterLayoutInner>
    </MasterI18nProvider>
  )
}
