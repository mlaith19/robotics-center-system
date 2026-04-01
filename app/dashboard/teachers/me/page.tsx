"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useCurrentUser } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"

export default function TeacherMePage() {
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [status, setStatus] = useState<"loading" | "found" | "not_found">("loading")
  const { dir } = useLanguage()

  useEffect(() => {
    if (!currentUser?.id) return
    fetch(`/api/teachers/by-user/${currentUser.id}`, { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json()
        if (res.status === 404) {
          setStatus("not_found")
          return null
        }
        setStatus("not_found")
        return null
      })
      .then((data) => {
        if (data?.id) {
          setStatus("found")
          router.replace(`/dashboard/teachers/${data.id}`)
        }
      })
      .catch(() => setStatus("not_found"))
  }, [currentUser?.id, router])

  if (status === "not_found") {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 p-3 sm:p-6" dir={dir}>
        <p className="text-muted-foreground text-center">לא נמצא פרופיל מורה משויך למשתמש זה.</p>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="text-sm font-medium text-primary hover:underline"
        >
          חזרה לדף הבית
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[300px] items-center justify-center p-3 sm:p-6" dir={dir}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className={dir === "rtl" ? "mr-2" : "ml-2"}>טוען פרופיל...</span>
    </div>
  )
}
