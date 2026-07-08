import { useEffect, useRef } from 'react'
import { t } from '../../i18n'

export interface PromptDialogProps {
  open: boolean
  title: string
  message?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  placeholder?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export default function PromptDialog({
  open,
  title,
  message,
  defaultValue = '',
  confirmLabel = t('common.confirm'),
  cancelLabel = t('common.cancel'),
  placeholder,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // Focus and select the input when dialog opens
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [open])

  if (!open) return null

  const handleConfirm = () => {
    const value = inputRef.current?.value || ''
    onConfirm(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div className="relative bg-surface rounded-xl shadow-2xl border border-border p-6 w-[400px] max-w-[90vw]">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-select-bg flex items-center justify-center flex-shrink-0 text-xl">
            ✏️
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              {title}
            </h3>
            {message && (
              <p className="text-xs text-text-secondary mb-3">{message}</p>
            )}
            <input
              ref={inputRef}
              type="text"
              defaultValue={defaultValue}
              placeholder={placeholder}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 text-sm bg-sidebar border border-border rounded-md text-text-primary placeholder:text-text-secondary outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-surface border border-border hover:bg-hover-bg transition-colors text-text-primary"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-select-border text-white hover:opacity-90 transition-opacity"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
