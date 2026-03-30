"use client"

import { useSyncExternalStore, useCallback } from "react"
import { useLanguage } from "@/lib/i18n/context"
import {
  getNotifyState,
  getNotifyQueueCount,
  subscribeNotify,
  dismissNotify,
} from "@/lib/notify/store"
import type { NotifyItem } from "@/lib/notify/types"
import { SnackbarItem } from "./snackbar-item"

const EMPTY_ITEMS: NotifyItem[] = []
function getNotifyServerSnapshot() {
  return EMPTY_ITEMS
}

const ZERO = 0
function getQueueServerSnapshot() {
  return ZERO
}

export function SnackbarProvider() {
  const { t, dir } = useLanguage()
  const items = useSyncExternalStore(subscribeNotify, getNotifyState, getNotifyServerSnapshot)
  const queueCount = useSyncExternalStore(
    subscribeNotify,
    getNotifyQueueCount,
    getQueueServerSnapshot
  )

  const handleDismiss = useCallback((id: string) => {
    dismissNotify(id)
  }, [])

  const isRtl = dir === "rtl"

  return (
    <div
      className="fixed z-[100] flex flex-col gap-2 p-4 pointer-events-none"
      style={{
        bottom: 16,
        ...(isRtl ? { right: 16 } : { left: 16 }),
      }}
    >
      <div className="flex flex-col gap-2 pointer-events-auto">
        {items.map((item) => (
          <SnackbarItem
            key={item.id}
            item={item}
            message={t(item.key)}
            actionLabel={item.actionLabelKey ? t(item.actionLabelKey) : undefined}
            onAction={item.onAction}
            onDismiss={() => handleDismiss(item.id)}
          />
        ))}
        {queueCount > 0 && (
          <p className="text-xs text-muted-foreground px-2">
            +{queueCount}
          </p>
        )}
      </div>
    </div>
  )
}
