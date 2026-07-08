import type { ReactNode } from 'react'
import { t } from '../../i18n'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Optional third action — shows as a danger-styled button between cancel and confirm */
  discardLabel?: string
  onDiscard?: () => void
  variant?: 'danger' | 'warning' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = t('common.confirm'),
  cancelLabel = t('common.cancel'),
  discardLabel,
  onDiscard,
  variant = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  const icon = variant === 'danger' ? '⚠️' : variant === 'warning' ? '⚠️' : 'ℹ️'
  const bgClass =
    variant === 'danger'
      ? 'bg-danger-bg'
      : variant === 'warning'
        ? 'bg-amber-bg'
        : 'bg-select-bg'
  const confirmClass =
    variant === 'danger'
      ? 'bg-danger text-white hover:opacity-90'
      : variant === 'warning'
        ? 'bg-select-border text-white hover:opacity-90'
        : 'bg-select-border text-white hover:opacity-90'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div className="relative bg-surface rounded-xl shadow-2xl border border-border p-6 w-[400px] max-w-[90vw]">
        <div className="flex items-start gap-3 mb-5">
          <div className={`w-10 h-10 rounded-full ${bgClass} flex items-center justify-center flex-shrink-0 text-xl`}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              {title}
            </h3>
            <div className="text-xs text-text-secondary leading-relaxed">
              {message}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-surface border border-border hover:bg-hover-bg transition-colors text-text-primary"
          >
            {cancelLabel}
          </button>
          {discardLabel && onDiscard && (
            <button
              onClick={onDiscard}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-surface border border-danger text-danger hover:bg-danger-bg transition-colors"
            >
              {discardLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-opacity ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
