"use client"

import { useEffect } from "react"
import { SnackbarProvider } from "@/components/snackbar/snackbar-provider"
import { ConfirmProvider } from "@/components/confirm/confirm-provider"
import { notify } from "@/lib/notify"

function requestLooksLikeMasterApi(input: RequestInfo | URL): boolean {
  try {
    let raw: string
    if (typeof input === "string") raw = input
    else if (input instanceof URL) raw = input.toString()
    else if (input instanceof Request) raw = input.url
    else raw = String(input)
    const path = raw.startsWith("http") ? new URL(raw).pathname : raw.split("?")[0]
    return path.startsWith("/api/master/")
  } catch {
    return false
  }
}

export function NotifyProviders() {
  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args)
      const path = typeof window !== "undefined" ? window.location.pathname : ""
      const onMasterUi = path.startsWith("/master")
      const masterApi = requestLooksLikeMasterApi(args[0] as RequestInfo | URL)
      // Tenant session expiry only — never hijack master login (401 = wrong password) or other master APIs
      if (
        res.status === 401 &&
        typeof window !== "undefined" &&
        !path.startsWith("/login") &&
        !onMasterUi &&
        !masterApi
      ) {
        notify.error("notify.sessionExpired")
        window.location.href = "/login?expired=1"
        return res
      }
      if (res.status === 403) {
        // Schedule page makes a few optional/background calls; avoid noisy false alerts
        // when the page itself is accessible and functioning.
        if (path.startsWith("/dashboard/schedule")) return res
        notify.error("notify.unauthorized")
        return res
      }
      if (res.status >= 500) {
        notify.error("notify.serverError")
        return res
      }
      return res
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return (
    <>
      <SnackbarProvider />
      <ConfirmProvider />
    </>
  )
}
