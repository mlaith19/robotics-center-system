"use client"

import { useLanguage } from "@/lib/i18n/context"
import { type Locale } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ChevronDown, Languages } from "lucide-react"

const LOCALES: { value: Locale; labelKey: string; short: string }[] = [
  { value: "he", labelKey: "common.he", short: "עב" },
  { value: "ar", labelKey: "common.ar", short: "ع" },
  { value: "en", labelKey: "common.en", short: "EN" },
]

export function LanguageSelector({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage()
  const current = LOCALES.find((l) => l.value === locale) ?? LOCALES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 h-9 min-w-[4.5rem] justify-between border-input bg-muted/30 font-medium",
            className
          )}
          aria-label={t("common.language")}
        >
          <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{current.short}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {LOCALES.map(({ value, labelKey, short }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setLocale(value)}
            className={cn("flex items-center gap-2", locale === value && "bg-accent")}
          >
            <span className="font-medium w-7 text-left">{short}</span>
            {t(labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
