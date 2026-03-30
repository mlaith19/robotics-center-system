"use client"

import type { NotifyItem, NotifyType, NotifyOptions, PendingConfirm } from "./types"

const MAX_VISIBLE = 4
const DEDUPE_MS = 2500
const DEFAULT_DURATION = 4000

const items: NotifyItem[] = []
/** Cached slice for useSyncExternalStore - same reference until items change */
let cachedVisible: NotifyItem[] = []
let cachedQueueCount = 0
const listeners: Array<() => void> = []
let confirmState: PendingConfirm | null = null
const confirmListeners: Array<(c: PendingConfirm | null) => void> = []

function updateCache() {
  cachedVisible = items.slice(-MAX_VISIBLE)
  cachedQueueCount = Math.max(0, items.length - MAX_VISIBLE)
}

function emit() {
  updateCache()
  listeners.forEach((l) => l())
}

function emitConfirm() {
  confirmListeners.forEach((l) => l(confirmState))
}

export function getNotifyState(): NotifyItem[] {
  return cachedVisible
}

export function getNotifyQueueCount(): number {
  return cachedQueueCount
}

export function subscribeNotify(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    const i = listeners.indexOf(listener)
    if (i >= 0) listeners.splice(i, 1)
  }
}

export function addNotify(
  type: NotifyType,
  key: string,
  params?: Record<string, string | number>,
  options: NotifyOptions = {}
): string {
  const id = options.id ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const now = Date.now()
  if (options.id) {
    const existing = items.find((x) => x.id === options.id)
    if (existing && now - existing.createdAt < DEDUPE_MS) {
      existing.key = key
      existing.params = params
      existing.type = type
      existing.duration = options.duration ?? DEFAULT_DURATION
      existing.actionLabelKey = options.actionLabelKey
      existing.onAction = options.onAction
      existing.createdAt = now
      emit()
      return id
    }
  }
  const item: NotifyItem = {
    id,
    key,
    params,
    type,
    duration: options.duration ?? DEFAULT_DURATION,
    actionLabelKey: options.actionLabelKey,
    onAction: options.onAction,
    createdAt: now,
  }
  items.push(item)
  emit()
  return id
}

export function dismissNotify(id: string): void {
  const i = items.findIndex((x) => x.id === id)
  if (i >= 0) {
    items.splice(i, 1)
    emit()
  }
}

export function getConfirmState(): PendingConfirm | null {
  return confirmState
}

export function subscribeConfirm(listener: (c: PendingConfirm | null) => void): () => void {
  confirmListeners.push(listener)
  return () => {
    const i = confirmListeners.indexOf(listener)
    if (i >= 0) confirmListeners.splice(i, 1)
  }
}

export function showConfirm(pending: PendingConfirm): void {
  confirmState = pending
  emitConfirm()
}

export function closeConfirm(): void {
  confirmState = null
  emitConfirm()
}

export { DEFAULT_DURATION, MAX_VISIBLE }
