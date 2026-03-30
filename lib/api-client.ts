"use client"

import { notify } from "@/lib/notify"

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: "include" })
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      const p = window.location.pathname
      let reqPath = ""
      if (typeof input === "string") reqPath = input.split("?")[0]
      else if (input instanceof URL) reqPath = input.pathname
      else if (input instanceof Request) {
        try {
          reqPath = new URL(input.url).pathname
        } catch {
          reqPath = input.url.split("?")[0]
        }
      }
      const masterApi = reqPath.startsWith("/api/master/")
      if (!p.startsWith("/master") && !masterApi) {
        notify.error("notify.sessionExpired")
        window.location.href = "/login?expired=1"
      }
    }
    return res
  }
  if (res.status === 403) {
    notify.error("notify.unauthorized")
    return res
  }
  if (res.status >= 500) {
    notify.error("notify.serverError")
    return res
  }
  return res
}
