import { useToast, type ToastType } from '../../context/ToastContext'

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

const BG_COLORS: Record<ToastType, string> = {
  success: 'border-green-400/40',
  error: 'border-red-400/40',
  warning: 'border-amber-400/40',
  info: 'border-blue-400/40',
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto
            flex items-center gap-2 px-4 py-2.5 rounded-lg border
            bg-surface shadow-lg
            text-xs text-text-primary
            transition-all duration-250
            ${BG_COLORS[toast.type]}
            ${toast.exiting ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'}
          `}
        >
          <span className="text-sm flex-shrink-0">{ICONS[toast.type]}</span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
