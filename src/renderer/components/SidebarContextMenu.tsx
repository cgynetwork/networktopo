import type { DeviceRow } from '../types'

export interface SidebarContextMenuState {
  x: number
  y: number
  device: DeviceRow
}

interface SidebarContextMenuProps {
  contextMenu: SidebarContextMenuState
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function SidebarContextMenu({
  contextMenu,
  onClose,
  onEdit,
  onDelete,
}: SidebarContextMenuProps) {
  return (
    <>
      {/* Backdrop to close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
      />
      <div
        className="fixed z-50 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        <button
          className="w-full text-left px-3 py-2 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
          onClick={onEdit}
        >
          <span className="w-4 text-center">✏️</span>
          <span>修改设备信息</span>
        </button>
        <div className="border-t border-border my-0.5" />
        <button
          className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger-bg transition-colors flex items-center gap-2"
          onClick={onDelete}
        >
          <span>🗑️</span>
          <span>删除设备</span>
        </button>
      </div>
    </>
  )
}
