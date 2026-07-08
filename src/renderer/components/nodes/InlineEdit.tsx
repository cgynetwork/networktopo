import { useState, useCallback, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import i18next from '../../i18n'

interface InlineEditProps {
  label: string
  value: string
  nodeId: string
  dataKey: string
  placeholder?: string
  bold?: boolean
  className?: string
}

export default function InlineEdit({ label, value, placeholder, nodeId, dataKey, bold, className }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setNodes } = useReactFlow()

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = useCallback(() => {
    setEditing(false)
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, [dataKey]: editValue.trim() || undefined } }
        }
        return node
      })
    )
  }, [nodeId, dataKey, editValue, setNodes])

  const cancel = useCallback(() => {
    setEditValue(value)
    setEditing(false)
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commit()
      else if (e.key === 'Escape') cancel()
    },
    [commit, cancel],
  )

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`text-2xs bg-surface border border-select-border rounded px-1.5 py-0.5 outline-none min-w-0 ${bold ? 'font-semibold' : ''} ${className || ''}`}
        placeholder={placeholder}
      />
    )
  }

  return (
    <div
      className={`text-2xs truncate cursor-text hover:bg-hover-bg rounded px-1 py-0.5 -mx-1 min-w-0 ${bold ? 'font-semibold text-text-primary' : 'text-text-secondary'} ${className || ''}`}
      onDoubleClick={() => {
        setEditValue(value)
        setEditing(true)
      }}
      title={i18next.t('inlineEdit.doubleClick', { label })}
    >
      {value || <span className="text-text-secondary italic">{placeholder || i18next.t('inlineEdit.doubleClickSet')}</span>}
    </div>
  )
}
