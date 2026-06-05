"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useT, type Lang } from "@/lib/master-i18n"

const LANG_CYCLE: Lang[] = ["he", "ar", "en"]
const LANG_LABELS: Record<Lang, string> = { he: "עב", ar: "ع", en: "EN" }
const REMEMBER_KEY = "master_remembered_username"

export default function MasterLoginPage() {
  const router = useRouter()
  const { t, lang, setLang, isRTL } = useT()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) { setUsername(saved); setRememberMe(true) }
  }, [])

  function cycleLang() {
    const idx = LANG_CYCLE.indexOf(lang)
    setLang(LANG_CYCLE[(idx + 1) % LANG_CYCLE.length])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/master/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      })

      let data: { error?: string } = {}
      try { data = await res.json() } catch {}

      if (!res.ok) {
        setError(data.error || t("login.networkError"))
        return
      }
      if (rememberMe) { localStorage.setItem(REMEMBER_KEY, username) }
      else { localStorage.removeItem(REMEMBER_KEY) }
      // Full page navigation ensures the new session cookie is sent with the first request
      window.location.replace("/master")
    } catch {
      setError(t("login.networkError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950" dir={isRTL ? "rtl" : "ltr"}>
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">

        {/* Language toggle */}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={cycleLang}
            className="text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-2.5 py-1 rounded-lg font-semibold min-w-[2.5rem] transition"
            title="Switch language"
          >
            {LANG_LABELS[lang]}
          </button>
        </div>

        <div className="text-center mb-8">
          <span className="inline-block bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-3 tracking-widest uppercase">
            {t("login.badge")}
          </span>
          <h1 className="text-2xl font-bold text-white">{t("login.title")}</h1>
          <p className="text-gray-400 text-sm mt-1">{t("login.subtitle")}</p>
        </div>

        {/* Error banner — shown prominently above the form */}
        {error && (
          <div className="mb-4 flex items-start gap-2 bg-red-950 border border-red-600 text-red-300 rounded-xl px-4 py-3 text-sm">
            <span className="text-red-400 text-base mt-0.5">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              {t("login.username")}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              {t("login.password")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 pe-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className={`absolute top-2.5 text-gray-500 hover:text-gray-300 ${isRTL ? "left-3" : "right-3"}`}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="master-remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 accent-indigo-500 cursor-pointer"
            />
            <label htmlFor="master-remember" className="text-xs text-gray-400 cursor-pointer select-none">
              זכור שם משתמש
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  )
}
