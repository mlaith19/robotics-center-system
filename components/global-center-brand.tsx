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
    <div className="sticky top-0 z-30 w-full border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-fit flex-col items-center px-4 py-2">
        <img
          src={brand.logo || "/api/og-logo"}
          alt={brand.center_name}
          className="h-14 w-14 rounded-full object-contain bg-white p-1 border"
        />
        <span className="mt-1 max-w-[70vw] truncate text-sm font-semibold text-foreground">{brand.center_name}</span>
      </div>
    </div>
  )
}
