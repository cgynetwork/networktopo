import type { PathStyle } from '../types'

export interface ContextMenuState {
  x: number
  y: number
  type: 'edge' | 'node'
  id: string
}

interface CanvasContextMenuProps {
  contextMenu: ContextMenuState
  onClose: () => void
  onEdgePathStyle: (style: PathStyle) => void
  onDeleteEdge: () => void
  onDeleteNode: () => void
}

export default function CanvasContextMenu({
  contextMenu,
  onClose,
  onEdgePathStyle,
  onDeleteEdge,
  onDeleteNode,
}: CanvasContextMenuProps) {
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
        {contextMenu.type === 'edge' && (
          <>
            <div className="px-3 py-1.5 text-2xs text-text-secondary font-medium">
              连接形式
            </div>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
              onClick={() => onEdgePathStyle('adaptive')}
            >
              <span className="w-4 text-center">↝</span>
              <span>自适应连接</span>
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
              onClick={() => onEdgePathStyle('straight')}
            >
              <span className="w-4 text-center">→</span>
              <span>直线连接</span>
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
              onClick={() => onEdgePathStyle('step')}
            >
              <span className="w-4 text-center">└</span>
              <span>肘形连接线</span>
            </button>
            <div className="border-t border-border my-0.5" />
            <button
              className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger-bg transition-colors flex items-center gap-2"
              onClick={onDeleteEdge}
            >
              <span>🗑️</span>
              <span>删除线缆</span>
            </button>
          </>
        )}
        {contextMenu.type === 'node' && (
          <button
            className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger-bg transition-colors flex items-center gap-2"
            onClick={onDeleteNode}
          >
            <span>🗑️</span>
            <span>删除设备及相关线缆</span>
          </button>
        )}
      </div>
    </>
  )
}
