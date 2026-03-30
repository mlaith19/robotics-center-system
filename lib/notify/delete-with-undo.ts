"use client"

import { notify } from "./index"
import { showConfirm, closeConfirm } from "./store"
import type { DeleteWithUndoOptions, ConfirmPolicy } from "./types"

const DEFAULT_UNDO_MS = 10_000

export function deleteWithUndo<T = unknown>(options: DeleteWithUndoOptions<T>): void {
  const {
    entityKey: _entityKey,
    itemId,
    itemLabel,
    removeFromUI,
    restoreFn,
    deleteFn,
    confirmPolicy = "standard",
    undoWindowMs = DEFAULT_UNDO_MS,
  } = options

  const runDeleteFlow = () => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const cancel = () => {
      cancelled = true
      if (timeoutId != null) clearTimeout(timeoutId)
      timeoutId = null
    }

    removeFromUI?.()

    const finalize = () => {
      if (cancelled) return
      deleteFn()
        .then(() => {})
        .catch(() => {
          restoreFn?.()
          notify.error("notify.deleteFailed")
        })
    }

    timeoutId = setTimeout(finalize, undoWindowMs)

    notify.success("notify.deletedWithUndo", undefined, {
      id: `undo-${itemId}`,
      duration: 0,
      actionLabelKey: "notify.undo",
      onAction: () => {
        cancel()
        restoreFn?.()
        notify.info("notify.restored", undefined, { duration: 3000 })
      },
    })
  }

  if (confirmPolicy === "dangerous" || confirmPolicy === "bulk") {
    showConfirm({
      titleKey: "confirm.dangerTitle",
      messageKey: "confirm.dangerMessage",
      messageParams: itemLabel ? { label: itemLabel } : undefined,
      onConfirm: () => {
        closeConfirm()
        runDeleteFlow()
      },
      onCancel: () => closeConfirm(),
    })
  } else {
    runDeleteFlow()
  }
}

export function confirmDanger(options: {
  titleKey: string
  messageKey: string
  messageParams?: Record<string, string>
  onConfirm: () => void
  onCancel?: () => void
}): void {
  showConfirm({
    titleKey: options.titleKey,
    messageKey: options.messageKey,
    messageParams: options.messageParams,
    onConfirm: () => {
      closeConfirm()
      options.onConfirm()
    },
    onCancel: () => {
      closeConfirm()
      options.onCancel?.()
    },
  })
}
