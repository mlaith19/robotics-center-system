"use client"

import { useSyncExternalStore } from "react"
import { useLanguage } from "@/lib/i18n/context"
import { getConfirmState, subscribeConfirm, closeConfirm } from "@/lib/notify/store"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function getServerSnapshot() {
  return null
}

export function ConfirmProvider() {
  const { t, dir } = useLanguage()
  const pending = useSyncExternalStore(subscribeConfirm, getConfirmState, getServerSnapshot)

  if (!pending) return null

  const message = (() => {
    let msg = t(pending.messageKey)
    if (pending.messageParams) {
      Object.entries(pending.messageParams).forEach(([k, v]) => {
        msg = msg.replace(new RegExp(`{{${k}}}`, "g"), v)
      })
    }
    return msg
  })()

  return (
    <AlertDialog open={true} onOpenChange={(open) => !open && pending.onCancel()}>
      <AlertDialogContent dir={dir}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(pending.titleKey)}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={pending.onCancel}>{t("confirm.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={pending.onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("confirm.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
