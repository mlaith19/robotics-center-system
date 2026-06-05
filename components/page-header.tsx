"use client"

import { useSettings } from "@/lib/use-settings"

interface PageHeaderProps {
  title: string
  description?: string
  showLogo?: boolean
  useCenterNameInDescription?: boolean
  centered?: boolean
}

export function PageHeader({ title, description, showLogo = false, useCenterNameInDescription = false, centered = false }: PageHeaderProps) {
  // Use cached settings hook to reduce API calls
  const { settings } = useSettings()

  // Build description with center name if needed
  const finalDescription = useCenterNameInDescription && settings.center_name
    ? `${description} ${settings.center_name}`
    : description

  return (
    <div className={`flex items-center gap-4 ${centered ? "justify-center w-full flex-col" : "justify-end"}`}>
      {showLogo && settings.logo && (
        <img 
          src={settings.logo || "/placeholder.svg"} 
          alt="לוגו" 
          className="h-16 w-16 object-contain rounded"
        />
      )}
      <div className={centered ? "text-center" : "text-right"}>
        <h1 className="text-3xl font-bold">{title}</h1>
        {finalDescription && (
          <p className="text-muted-foreground mt-1">{finalDescription}</p>
        )}
      </div>
    </div>
  )
}
