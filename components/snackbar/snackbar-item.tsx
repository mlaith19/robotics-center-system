"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { dismissNotify } from "@/lib/notify/store"
import type { NotifyItem } from "@/lib/notify/types"

const typeStyles = {
  success: "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300",
  error: "border-destructive/50 bg-destructive/10 text-destructive",
  warning: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  info: "border-primary/50 bg-primary/10 text-primary",
}

export function SnackbarItem({
  item,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  item: NotifyItem
  message: string
  actionLabel?: string
  onAction?: () => void
  onDismiss: () => void
}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (item.duration <= 0) return
    timeoutRef.current = setTimeout(() => {
      onDismiss()
    }, item.duration)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [item.duration, item.id, onDismiss])

  const handleAction = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    item.onAction?.()
    onAction?.()
    onDismiss()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 shadow-lg min-w-[280px] max-w-[420px]",
        typeStyles[item.type]
      )}
    >
      <p className="flex-1 text-sm font-medium">{message}</p>
      <div className="flex shrink-0 items-center gap-1">
        {actionLabel != null && actionLabel !== "" && (
          <button
            type="button"
            onClick={handleAction}
            className="rounded px-2 py-1 text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="rounded p-1 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
