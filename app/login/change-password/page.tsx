"use client"

import type React from "react"
import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, Loader2, AlertCircle } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import { LanguageSelector } from "@/components/language-selector"

function ChangePasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, dir } = useLanguage()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const center = (searchParams.get("center") ?? "").trim()
    const meUrl = center
      ? `/api/auth/me?center=${encodeURIComponent(center)}`
      : "/api/auth/me"
    fetch(meUrl, { credentials: "include" })
      .then((r) => {
        if (!r.ok) router.replace("/login")
      })
      .catch(() => router.replace("/login"))
  }, [router, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (newPassword !== confirmPassword) {
      setError(dir === "rtl" ? "הסיסמאות לא תואמות" : "Passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      setError(dir === "rtl" ? "סיסמה חייבת להכיל לפחות 8 תווים" : "Password must be at least 8 characters")
      return
    }
    setIsLoading(true)
    try {
      const center = (searchParams.get("center") ?? "").trim()
      const changePasswordUrl = center
        ? `/api/auth/change-password?center=${encodeURIComponent(center)}`
        : "/api/auth/change-password"
      const res = await fetch(changePasswordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || (dir === "rtl" ? "שגיאה בעדכון סיסמה" : "Failed to update password"))
        setIsLoading(false)
        return
      }
      router.push(center ? `/dashboard?center=${encodeURIComponent(center)}` : "/dashboard")
    } catch {
      setError(dir === "rtl" ? "שגיאה בשרת" : "Server error")
      setIsLoading(false)
    }
  }

  const isRtl = dir === "rtl"
  const iconSide = isRtl ? "right" : "left"

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
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{t("login.changePasswordTitle")}</h1>
          <p className="text-gray-600">{t("login.changePasswordDescription")}</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl text-center">{t("login.changePasswordTitle")}</CardTitle>
            <CardDescription className="text-center">{t("login.changePasswordDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="current">{t("login.currentPassword")}</Label>
                <div className="relative">
                  <Lock className={`absolute top-3 h-5 w-5 text-gray-400 ${isRtl ? "right-3" : "left-3"}`} />
                  <Input
                    id="current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={isRtl ? "pr-10 h-11" : "pl-10 h-11"}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new">{t("login.newPassword")}</Label>
                <Input
                  id="new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11"
                  required
                  minLength={8}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">{t("login.confirmPassword")}</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11"
                  required
                  minLength={8}
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className={`h-5 w-5 animate-spin ${isRtl ? "ml-2" : "mr-2"}`} />
                    {dir === "rtl" ? "מעדכן..." : "Updating..."}
                  </>
                ) : (
                  t("login.submitChange")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={null}>
      <ChangePasswordContent />
    </Suspense>
  )
}
