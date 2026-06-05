export type NotifyType = "success" | "error" | "warning" | "info"

export interface NotifyOptions {
  duration?: number
  actionLabelKey?: string
  onAction?: () => void
  id?: string
}

export interface NotifyItem {
  id: string
  key: string
  params?: Record<string, string | number>
  type: NotifyType
  duration: number
  actionLabelKey?: string
  onAction?: () => void
  createdAt: number
}

export type ConfirmPolicy = "standard" | "dangerous" | "bulk"

export interface DeleteWithUndoOptions<T = unknown> {
  entityKey: string
  itemId: string
  itemLabel?: string
  item?: T
  /** Optimistic: remove from UI immediately (called by deleteWithUndo) */
  removeFromUI?: () => void
  /** Restore to UI when user clicks Undo or when server delete fails */
  restoreFn?: () => void | Promise<void>
  /** Actually perform DELETE on server (called after undo window) */
  deleteFn: () => Promise<void>
  confirmPolicy?: ConfirmPolicy
  undoWindowMs?: number
}

export interface PendingConfirm {
  titleKey: string
  messageKey: string
  messageParams?: Record<string, string>
  onConfirm: () => void
  onCancel: () => void
}
