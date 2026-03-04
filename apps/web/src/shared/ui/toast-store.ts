import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export type ToastItem = {
  id: string
  message: string
  variant: ToastVariant
}

type ToastState = {
  toasts: ToastItem[]
  push: (input: { message: string; variant?: ToastVariant }) => string
  remove: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (input) => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id,
          message: input.message,
          variant: input.variant ?? 'info',
        },
      ],
    }))
    return id
  },
  remove: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}))

export function useToast() {
  const push = useToastStore((state) => state.push)

  return {
    show: (message: string, variant: ToastVariant = 'info') => push({ message, variant }),
    success: (message: string) => push({ message, variant: 'success' }),
    error: (message: string) => push({ message, variant: 'error' }),
    info: (message: string) => push({ message, variant: 'info' }),
  }
}
