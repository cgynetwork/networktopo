import { useTranslation } from 'react-i18next'
import type { PathStyle } from '../types'

export interface ContextMenuState {
  x: number
  y: number
  type: 'edge' | 'node' | 'batch' | 'canvas'
  id: string
  nodeType?: string  // V1.1.1: to show rack-specific menu items
}

interface CanvasContextMenuProps {
  contextMenu: ContextMenuState
  onClose: () => void
  onEdgePathStyle: (style: PathStyle) => void
  onDeleteEdge: () => void
  onCopyNode: () => void
  onDeleteNode: () => void
  onCopyBatch: () => void
  onDeleteBatch: () => void
  onPaste: () => void
  onSelectAll: () => void
  onFitView: () => void
  hasClipboard: boolean
  onUngroupNode?: () => void
  onUngroupBatch?: () => void
  hasGroupedNode?: boolean
  hasGroupedSelection?: boolean
  // V1.1.1: Rack-specific actions
  onAddDeviceToRack?: () => void
  isRackNode?: boolean
}

export default function CanvasContextMenu({
  contextMenu,
  onClose,
  onEdgePathStyle,
  onDeleteEdge,
  onCopyNode,
  onDeleteNode,
  onCopyBatch,
  onDeleteBatch,
  onPaste,
  onSelectAll,
  onFitView,
  hasClipboard,
  onUngroupNode,
  onUngroupBatch,
  hasGroupedNode,
  hasGroupedSelection,
  onAddDeviceToRack,
  isRackNode,
}: CanvasContextMenuProps) {
  const { t } = useTranslation()

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
              {t('contextMenu.connectionForm')}
            </div>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
              onClick={() => onEdgePathStyle('adaptive')}
            >
              <span className="w-4 text-center">↝</span>
              <span>{t('contextMenu.pathAdaptive')}</span>
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
              onClick={() => onEdgePathStyle('straight')}
            >
              <span className="w-4 text-center">→</span>
              <span>{t('contextMenu.pathStraight')}</span>
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
              onClick={() => onEdgePathStyle('step')}
            >
              <span className="w-4 text-center">└</span>
              <span>{t('contextMenu.pathStep')}</span>
            </button>
            <div className="border-t border-border my-0.5" />
            <button
              className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger-bg transition-colors flex items-center gap-2"
              onClick={onDeleteEdge}
            >
              <span>🗑️</span>
              <span>{t('contextMenu.deleteCable')}</span>
            </button>
          </>
        )}
        {contextMenu.type === 'node' && (
          <>
            {/* V1.1.1: Rack-specific actions */}
            {isRackNode && onAddDeviceToRack && (
              <>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
                  onClick={onAddDeviceToRack}
                >
                  <span className="w-4 text-center">➕</span>
                  <span>{t('contextMenu.addDeviceToRack')}</span>
                </button>
                <div className="border-t border-border my-0.5" />
              </>
            )}
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
              onClick={onCopyNode}
            >
              <span className="w-4 text-center">📋</span>
              <span>{t('contextMenu.copyDevice')}</span>
            </button>
            {hasGroupedNode && (
              <>
                <div className="border-t border-border my-0.5" />
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
                  onClick={onUngroupNode}
                >
                  <span className="w-4 text-center">🔓</span>
                  <span>{t('contextMenu.ungroup')}</span>
                </button>
              </>
            )}
            <div className="border-t border-border my-0.5" />
            <button
              className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger-bg transition-colors flex items-center gap-2"
              onClick={onDeleteNode}
            >
              <span>🗑️</span>
              <span>{t('contextMenu.deleteDevice')}</span>
            </button>
          </>
        )}
        {contextMenu.type === 'batch' && (
          <>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
              onClick={onCopyBatch}
            >
              <span className="w-4 text-center">📋</span>
              <span>{t('contextMenu.copySelected')}</span>
            </button>
            {hasGroupedSelection && (
              <>
                <div className="border-t border-border my-0.5" />
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
                  onClick={onUngroupBatch}
                >
                  <span className="w-4 text-center">🔓</span>
                  <span>{t('contextMenu.ungroup')}</span>
                </button>
              </>
            )}
            <div className="border-t border-border my-0.5" />
            <button
              className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger-bg transition-colors flex items-center gap-2"
              onClick={onDeleteBatch}
            >
              <span>🗑️</span>
              <span>{t('contextMenu.deleteSelected')}</span>
            </button>
          </>
        )}
        {contextMenu.type === 'canvas' && (
          <>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={onPaste}
              disabled={!hasClipboard}
            >
              <span className="w-4 text-center">📋</span>
              <span>{t('contextMenu.paste')}</span>
              <span className="ml-auto text-2xs text-text-secondary">Ctrl+V</span>
            </button>
            <div className="border-t border-border my-0.5" />
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
              onClick={onSelectAll}
            >
              <span className="w-4 text-center">⬜</span>
              <span>{t('contextMenu.selectAll')}</span>
              <span className="ml-auto text-2xs text-text-secondary">Ctrl+A</span>
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
              onClick={onFitView}
            >
              <span className="w-4 text-center">🔍</span>
              <span>{t('contextMenu.fitView')}</span>
              <span className="ml-auto text-2xs text-text-secondary">Ctrl+0</span>
            </button>
          </>
        )}
      </div>
    </>
  )
}
