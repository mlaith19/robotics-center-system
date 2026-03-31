"use client"

import { useEffect, useState } from "react"

type BrandState = {
  center_name: string
  logo: string
}

const DEFAULT_BRAND: BrandState = {
  center_name: "מרכז רובוטיקה",
  logo: "/api/og-logo",
}

export function GlobalCenterBrand() {
  const [brand, setBrand] = useState<BrandState>(DEFAULT_BRAND)

  useEffect(() => {
    let cancelled = false
    fetch("/api/public-center-brand", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const center_name =
          typeof data.center_name === "string" && data.center_name.trim()
            ? data.center_name.trim()
            : DEFAULT_BRAND.center_name
        const logo = typeof data.logo === "string" && data.logo.trim() ? data.logo.trim() : DEFAULT_BRAND.logo
        setBrand({ center_name, logo })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="fixed top-3 left-1/2 z-40 -translate-x-1/2 pointer-events-none">
      <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background/95 px-3 py-1.5 shadow-sm backdrop-blur">
        <img
          src={brand.logo || "/api/og-logo"}
          alt={brand.center_name}
          className="h-7 w-7 rounded-full object-cover border"
        />
        <span className="max-w-[60vw] truncate text-sm font-semibold text-foreground">{brand.center_name}</span>
      </div>
    </div>
  )
}
