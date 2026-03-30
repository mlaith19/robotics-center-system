# Global notification and delete UX

## Snackbar system

- **Position**: Bottom-left (LTR) / Bottom-right (RTL), from `useLanguage().dir`.
- **Types**: `success`, `error`, `warning`, `info`.
- **Behavior**: Auto-dismiss (default 4s), close button, optional action (e.g. Undo). Up to 4 visible; extra items queued. Dedupe by `id` within 2.5s.
- **Accessibility**: `aria-live="polite"`, `aria-atomic="true"`, no focus steal.

### API

```ts
import { notify } from "@/lib/notify"

notify.success("notify.deleted", undefined, { duration: 3000 })
notify.error("notify.serverError")
notify.warning("notify.validationError")
notify.info("notify.restored", undefined, { duration: 3000 })

// With action (e.g. Undo)
notify.success("notify.deletedWithUndo", undefined, {
  duration: 0,
  actionLabelKey: "notify.undo",
  onAction: () => { /* undo */ },
  id: "unique-key", // dedupe
})
```

Options: `duration`, `actionLabelKey`, `onAction`, `id`.

## deleteWithUndo

Use for standard deletes (no confirm dialog; undo snackbar).

```ts
import { deleteWithUndo } from "@/lib/notify"

deleteWithUndo({
  entityKey: "teacher",
  itemId: id,
  itemLabel: teacher?.name,
  removeFromUI: () => setTeachers((prev) => prev.filter((t) => t.id !== id)),
  restoreFn: () => teacher && setTeachers((prev) => [...prev, teacher]),
  deleteFn: async () => {
    const res = await fetch(`/api/teachers/${id}`, { method: "DELETE", credentials: "include" })
    if (!res.ok) throw new Error("Delete failed")
  },
  confirmPolicy: "standard",
  undoWindowMs: 10_000,
})
```

- **confirmPolicy**: `"standard"` → undo snackbar only; `"dangerous"` or `"bulk"` → confirm dialog first, then same undo flow.
- **removeFromUI**: Called immediately (optimistic).
- **restoreFn**: Called on Undo or if `deleteFn` fails.
- **deleteFn**: Called after `undoWindowMs` (default 10s) if user does not click Undo.

## Confirm dialog (dangerous)

For dangerous/bulk deletes, use `confirmPolicy: "dangerous"` (or `"bulk"`). User must confirm; then the same undo snackbar flow runs.

## Global fetch interceptor

In `NotifyProviders`, `window.fetch` is wrapped so that:

- **401**: `notify.error("notify.sessionExpired")` and redirect to `/login?expired=1` (only when not already on `/login`).
- **403**: `notify.error("notify.unauthorized")`.
- **5xx**: `notify.error("notify.serverError")`.

Responses are still returned to the caller.

## Translation keys (he/en)

- **notify**: `sessionExpired`, `unauthorized`, `serverError`, `undo`, `deleted`, `deletedWithUndo`, `restored`, `deleteFailed`, `validationError`.
- **confirm**: `dangerTitle`, `dangerMessage`, `deleteItem`, `cancel`, `confirm`.

Replace `{{label}}` in `confirm.deleteItem` when using message params.

## Where it’s used

- Settings: category delete → `deleteWithUndo`.
- Students, Teachers, Courses, Schools, Gafan, Entity list: row delete → `deleteWithUndo`.
- Attendance: delete attendance record → `deleteWithUndo`.
- All delete flows use the same snackbar + undo (and optional confirm for dangerous).
