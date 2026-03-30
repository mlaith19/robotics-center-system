"use client"

import { useEffect, useState, useRef } from "react"

interface CenterSettings {
  center_name: string
  logo: string
}

const CACHE_KEY = "center-settings-cache"
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes - longer cache to reduce API calls

interface CachedSettings {
  data: CenterSettings
  cachedAt: number
}

const DEFAULT_SETTINGS: CenterSettings = {
  center_name: "מרכז רובוטיקה",
  logo: ""
}

export function useSettings() {
  const [settings, setSettings] = useState<CenterSettings>(() => {
    // Initialize from cache if available
    if (typeof window === 'undefined') return DEFAULT_SETTINGS
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CachedSettings
        if (parsed.cachedAt && Date.now() - parsed.cachedAt < CACHE_DURATION) {
          return parsed.data
        }
      }
    } catch (e) {}
    return DEFAULT_SETTINGS
  })
  const [loading, setLoading] = useState(() => settings === DEFAULT_SETTINGS)
  const fetchStartedRef = useRef(false)

  useEffect(() => {
    // Already have cached settings that are not defaults
    if (settings !== DEFAULT_SETTINGS && settings.center_name !== DEFAULT_SETTINGS.center_name) {
      setLoading(false)
      return
    }
    
    // Prevent multiple fetch attempts
    if (fetchStartedRef.current) return
    fetchStartedRef.current = true

    fetch("/api/settings", { credentials: "include" })
      .then((res) => {
        if (res.status === 429) {
          console.warn("[v0] Rate limited on settings fetch")
          return null
        }
        return res.ok ? res.json() : null
      })
      .then((data) => {
        const settingsData: CenterSettings = data ? {
          center_name: data.center_name || DEFAULT_SETTINGS.center_name,
          logo: data.logo || ""
        } : DEFAULT_SETTINGS
        
        setSettings(settingsData)
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          data: settingsData,
          cachedAt: Date.now()
        }))
        setLoading(false)
      })
      .catch((error) => {
        console.error("[v0] Error fetching settings:", error)
        setLoading(false)
      })
  }, [settings])

  return { settings, loading }
}

// Clear settings cache
export function clearSettingsCache() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch (e) {}
}
