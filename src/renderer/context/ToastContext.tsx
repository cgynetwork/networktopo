import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  message: string
  type: ToastType
  exiting?: boolean
}

export interface ToastContextValue {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType) => void
  removeToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 250)
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++nextId
      setToasts(prev => [...prev.slice(-4), { id, message, type }]) // max 5 visible
      setTimeout(() => removeToast(id), 3500)
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
