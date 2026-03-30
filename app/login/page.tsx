"use client"

import type React from "react"
import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LogIn, User, Lock, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import { LanguageSelector } from "@/components/language-selector"

const SESSION_EXPIRED_MSG = "הפג תוקף ההתחברות. אנא התחבר שוב."
const REMEMBER_KEY = "tenant_remembered_username"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, dir } = useLanguage()
  const [username, setUsername] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchParams.get("expired") === "1") {
      setSessionExpired(true)
      setError(SESSION_EXPIRED_MSG)
    }
    if (searchParams.get("reason") === "tenant_mismatch") {
      setError("ההתחברות שייכת למרכז אחר. התחבר מחדש למרכז זה.")
    }
    const savedUser = localStorage.getItem(REMEMBER_KEY)
    if (savedUser) {
      setUsername(savedUser)
      setRememberMe(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (!showPassword) return
    const t = setTimeout(() => setShowPassword(false), 10_000)
    return () => clearTimeout(t)
  }, [showPassword])

  const clearPasswordField = () => {
    if (passwordRef.current) {
      passwordRef.current.value = ""
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    const passwordInput = passwordRef.current
    const password = passwordInput?.value ?? ""

    try {
      const center = (searchParams.get("center") ?? "").trim()
      const loginUrl = center
        ? `/api/auth/login?center=${encodeURIComponent(center)}`
        : "/api/auth/login"
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        setError(
          (data.message && typeof data.message === "string" ? data.message : null) ||
            data.error ||
            t("login.errorInvalid")
        )
        setIsLoading(false)
        clearPasswordField()
        return
      }

      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, username)
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }

      setUsername("")
      if (data.requiresPasswordReset) {
        const center = (searchParams.get("center") ?? "").trim()
        const changePath = center
          ? `/login/change-password?center=${encodeURIComponent(center)}`
          : "/login/change-password"
        router.replace(changePath)
        router.refresh()
        return
      }
      if (data.roleKey === "super_admin" || data.role === "סופר אדמין") {
        router.replace("/dashboard/users")
      } else {
        router.replace("/dashboard")
      }
      router.refresh()
    } catch (err) {
      setError(t("login.errorServer"))
      clearPasswordField()
      setIsLoading(false)
    } finally {
      clearPasswordField()
    }
  }

  const isRtl = dir === "rtl"

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4"
      dir={dir}
    >
      <div className="absolute top-4 end-4">
        <LanguageSelector />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{t("login.title")}</h1>
          <p className="text-gray-600">{t("login.subtitle")}</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl text-center">{t("login.cardTitle")}</CardTitle>
            <CardDescription className="text-center">{t("login.cardDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5" autoComplete="off">
              {(error || sessionExpired) && (
                <Alert
                  variant={sessionExpired ? "default" : "destructive"}
                  className={
                    sessionExpired ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
                  }
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {sessionExpired ? SESSION_EXPIRED_MSG : error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-base">
                  {t("login.username")}
                </Label>
                <div className="relative">
                  <User
                    className={`absolute top-3 h-5 w-5 text-gray-400 ${isRtl ? "right-3" : "left-3"}`}
                  />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("login.usernamePlaceholder")}
                    className={isRtl ? "pr-10 h-11" : "pl-10 h-11"}
                    required
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base">
                  {t("login.password")}
                </Label>
                <div className="relative">
                  <Lock
                    className={`absolute top-3 h-5 w-5 text-gray-400 ${isRtl ? "right-3" : "left-3"}`}
                  />
                  <Input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("login.passwordPlaceholder")}
                    className={isRtl ? "pr-10 ps-10 h-11" : "pl-10 pe-10 h-11"}
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    inputMode="text"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    onBlur={() => setShowPassword(false)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                    onClick={() => setShowPassword((v) => !v)}
                    className={`absolute top-3 h-5 w-5 text-gray-400 hover:text-gray-600 ${isRtl ? "left-3" : "right-3"}`}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-gray-600 cursor-pointer select-none"
                >
                  {t("login.rememberMe") || "זכור אותי"}
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className={`h-5 w-5 animate-spin ${isRtl ? "ml-2" : "mr-2"}`} />
                    {t("login.loading")}
                  </>
                ) : (
                  <>
                    <LogIn className={isRtl ? "ml-2" : "mr-2 h-5 w-5"} />
                    {t("login.submit")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
