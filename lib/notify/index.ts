"use client"

import { addNotify } from "./store"
import type { NotifyType, NotifyOptions } from "./types"

function notifyFn(
  type: NotifyType,
  key: string,
  params?: Record<string, string | number>,
  options: NotifyOptions = {}
): string {
  return addNotify(type, key, params, options)
}

export const notify = {
  success: (key: string, params?: Record<string, string | number>, options?: NotifyOptions) =>
    notifyFn("success", key, params, options),
  error: (key: string, params?: Record<string, string | number>, options?: NotifyOptions) =>
    notifyFn("error", key, params, options),
  warning: (key: string, params?: Record<string, string | number>, options?: NotifyOptions) =>
    notifyFn("warning", key, params, options),
  info: (key: string, params?: Record<string, string | number>, options?: NotifyOptions) =>
    notifyFn("info", key, params, options),
}

export { dismissNotify, getNotifyState, getNotifyQueueCount, subscribeNotify } from "./store"
export { deleteWithUndo, confirmDanger } from "./delete-with-undo"
export type { NotifyItem, NotifyOptions, NotifyType, DeleteWithUndoOptions, ConfirmPolicy, PendingConfirm } from "./types"
