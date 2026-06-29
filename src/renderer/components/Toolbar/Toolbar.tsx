import { useState } from 'react'
import type { Node, Edge } from '@xyflow/react'

interface ToolbarProps {
  nodes: Node[]
  edges: Edge[]
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onNew?: () => void
  onSave?: () => void
  onOpen?: () => void
  onExportPNG?: () => void
  onExportPDF?: () => void
  onExportGIF?: () => void
  isExportingGIF?: boolean
}

export default function Toolbar({
  nodes,
  edges,
  sidebarCollapsed,
  onToggleSidebar,
  onNew,
  onSave,
  onOpen,
  onExportPNG,
  onExportPDF,
  onExportGIF,
  isExportingGIF,
}: ToolbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false)

  return (
    <div
      className="h-toolbar flex items-center justify-between px-4 border-b border-border bg-white select-none"
      style={{ WebkitAppRegion: 'drag' as any }}
    >
      {/* Left section */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' as any }}>
        <button
          onClick={onToggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary"
          title={sidebarCollapsed ? '展开设备库' : '收起设备库'}
        >
          {sidebarCollapsed ? '☰' : '✕'}
        </button>
        <span className="text-sm font-semibold text-text-primary">Topo</span>
        <span className="text-2xs text-text-secondary bg-hover-bg px-1.5 py-0.5 rounded">V0.3.0</span>
        <span className="text-xs text-text-secondary">
          节点 {nodes.length} · 连线 {edges.length}
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' as any }}>
        <button
          onClick={onNew}
          className="px-3 py-1.5 text-xs font-medium rounded bg-white border border-border hover:bg-hover-bg transition-colors text-text-primary"
          title="新建拓扑 (清空画布)"
        >
          新建
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1.5 text-xs font-medium rounded bg-white border border-border hover:bg-hover-bg transition-colors text-text-primary"
          title="保存拓扑文件 (.topo.json)"
          disabled={nodes.length === 0}
        >
          保存
        </button>
        <button
          onClick={onOpen}
          className="px-3 py-1.5 text-xs font-medium rounded bg-white border border-border hover:bg-hover-bg transition-colors text-text-primary"
          title="打开拓扑文件"
        >
          打开
        </button>

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            onBlur={() => setTimeout(() => setShowExportMenu(false), 150)}
            className="px-3 py-1.5 text-xs font-medium rounded bg-select-border text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            title="导出拓扑图"
            disabled={nodes.length === 0}
          >
            导出 ▾
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
              <button
                onMouseDown={() => { onExportPNG?.(); setShowExportMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors text-text-primary"
              >
                🖼️ 导出 PNG
              </button>
              <button
                onMouseDown={() => { onExportPDF?.(); setShowExportMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors text-text-primary"
              >
                📄 导出 PDF
              </button>
              <div className="border-t border-border my-0.5" />
              <button
                onMouseDown={() => { onExportGIF?.(); setShowExportMenu(false) }}
                disabled={isExportingGIF}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors text-text-primary disabled:opacity-40 disabled:cursor-wait"
              >
                {isExportingGIF ? '🎞️ 正在导出 GIF...' : '🎞️ 导出动画 GIF'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
