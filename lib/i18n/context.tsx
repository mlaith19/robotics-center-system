"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { translations, type Locale } from "./translations"

const STORAGE_KEY = "app-lang"

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "he"
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
  if (stored === "he" || stored === "ar" || stored === "en") return stored
  return "he"
}

function getDir(locale: Locale): "rtl" | "ltr" {
  return locale === "en" ? "ltr" : "rtl"
}

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".")
  let current: unknown = obj
  for (const p of parts) {
    if (current == null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[p]
  }
  return typeof current === "string" ? current : undefined
}

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
  dir: "rtl" | "ltr"
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("he")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setLocaleState(getStoredLocale())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.lang = locale === "ar" ? "ar" : locale === "en" ? "en" : "he"
    document.documentElement.dir = getDir(locale)
  }, [locale, mounted])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newLocale)
    }
  }, [])

  const t = useCallback(
    (key: string): string => {
      const value = getNested(translations[locale] as Record<string, unknown>, key)
      return value ?? key
    },
    [locale]
  )

  const dir = getDir(locale)

  const value: LanguageContextValue = {
    locale,
    setLocale,
    t,
    dir,
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider")
  return ctx
}

export function useTranslation() {
  const { t, locale, dir } = useLanguage()
  return { t, locale, dir }
}
