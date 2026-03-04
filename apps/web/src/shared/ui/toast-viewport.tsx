import { useEffect } from 'react'

import { useToastStore, type ToastItem } from './toast-store'

const TOAST_TIMEOUT_MS = 3200

function variantClasses(variant: ToastItem['variant']) {
  if (variant === 'success') {
    return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
  }

  if (variant === 'error') {
    return 'border-rose-500/40 bg-rose-500/15 text-rose-100'
  }

  return 'border-cyan-500/40 bg-cyan-500/15 text-cyan-100'
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const remove = useToastStore((state) => state.remove)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      remove(toast.id)
    }, TOAST_TIMEOUT_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [remove, toast.id])

  return (
    <div
      className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm shadow-lg shadow-slate-950/30 ${variantClasses(toast.variant)}`}
      role="status"
      aria-live="polite"
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => remove(toast.id)}
        className="rounded border border-current/40 px-1.5 py-0.5 text-xs opacity-80 hover:opacity-100"
        aria-label="Dismiss toast"
      >
        x
      </button>
    </div>
  )
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
