import { useState, useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { ThemeName } from '../../context/ThemeContext'
import type { NodeData, EdgeData } from '../../types'

interface ToolbarProps {
  nodes: Node[]
  edges: Edge[]
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onNew?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onOpen?: () => void
  onExportPNG?: () => void
  onExportPDF?: () => void
  onExportGIF?: () => void
  isExportingGIF?: boolean
  isDirty?: boolean
  theme?: ThemeName
  onToggleTheme?: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  selectedCount?: number
  onAlignLeft?: () => void
  onAlignHorizontalCenter?: () => void
  onAlignRight?: () => void
  onAlignTop?: () => void
  onAlignVerticalCenter?: () => void
  onAlignBottom?: () => void
  onDistributeHorizontal?: () => void
  onDistributeVertical?: () => void
  showGrid?: boolean
  onToggleGrid?: () => void
  snapEnabled?: boolean
  onToggleSnap?: () => void
  onOpenSearch?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitView?: () => void
  viewportZoom?: number
  templateList?: { name: string; file: string }[]
  onSaveAsTemplate?: () => void
  onLoadTemplate?: (name: string) => void
  onDeleteTemplate?: (name: string) => void
  onImportTemplate?: () => void
  onRefreshTemplateList?: () => void
}

export default function Toolbar({
  nodes,
  edges,
  sidebarCollapsed,
  onToggleSidebar,
  onNew,
  onSave,
  onSaveAs,
  onOpen,
  onExportPNG,
  onExportPDF,
  onExportGIF,
  isExportingGIF,
  isDirty,
  theme,
  onToggleTheme,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  selectedCount,
  onAlignLeft,
  onAlignHorizontalCenter,
  onAlignRight,
  onAlignTop,
  onAlignVerticalCenter,
  onAlignBottom,
  onDistributeHorizontal,
  onDistributeVertical,
  showGrid,
  onToggleGrid,
  snapEnabled,
  onToggleSnap,
  onOpenSearch,
  onZoomIn,
  onZoomOut,
  onFitView,
  viewportZoom,
  templateList,
  onSaveAsTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  onImportTemplate,
  onRefreshTemplateList,
}: ToolbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [showStatsTooltip, setShowStatsTooltip] = useState(false)

  // ── V0.9.2: Topology asset statistics ─────────────────────────
  const deviceLabels: Record<string, string> = {
    '防火墙': '防火墙', '交换机': '交换机', '无线控制器': '无线控制器',
    '无线接入点': '无线接入点', '服务器': '服务器',
    '终端-PC': 'PC终端', '终端-笔记本': '笔记本终端',
  }
  const connTypeLabels: Record<string, string> = {
    'ethernet': '网络线缆', 'fiber': '光纤线缆', 'stack': '堆叠线缆',
    'wireless': '无线线缆',
  }

  const assetStats = useMemo(() => {
    // Device aggregation: category → { count, models: { model → count } }
    const catMap = new Map<string, { count: number; models: Map<string, number> }>()
    for (const n of nodes) {
      const data = n.data as NodeData | undefined
      if (!data?.device) continue
      const cat = data.customCategory || data.device.category_name || '未分类'
      const model = data.customDeviceModel || data.device.model || '未知型号'
      let entry = catMap.get(cat)
      if (!entry) { entry = { count: 0, models: new Map() }; catMap.set(cat, entry) }
      entry.count++
      entry.models.set(model, (entry.models.get(model) || 0) + 1)
    }
    // Connection type aggregation
    const connMap = new Map<string, number>()
    for (const e of edges) {
      const ed = e.data as EdgeData | undefined
      const ct = ed?.connectionType || 'ethernet'
      connMap.set(ct, (connMap.get(ct) || 0) + 1)
    }

    // Build ordered arrays for display
    const deviceCategories = Array.from(catMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([cat, info]) => ({
        label: deviceLabels[cat] || cat,
        count: info.count,
        models: Array.from(info.models.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([m, c]) => ({ name: m, count: c })),
      }))
    const connectionTypes = Array.from(connMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([ct, count]) => ({
        label: connTypeLabels[ct] || ct,
        count,
      }))
    return { deviceCategories, connectionTypes }
  }, [nodes, edges])

  const showAlignTools = (selectedCount ?? 0) >= 2
  const showDistributeTools = (selectedCount ?? 0) >= 3

  const statsSummary = useMemo(() => {
    const parts: string[] = []
    for (const d of assetStats.deviceCategories) {
      parts.push(`${d.label} ${d.count}`)
    }
    for (const c of assetStats.connectionTypes) {
      parts.push(`${c.label} ${c.count}`)
    }
    return parts.length > 0 ? parts.join('  ') : '暂无设备'
  }, [assetStats])

  return (
    <div
      className="h-toolbar flex items-center justify-between px-4 border-b border-border bg-surface select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left section */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={onToggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary"
          title={sidebarCollapsed ? '展开设备库' : '收起设备库'}
        >
          {sidebarCollapsed ? '☰' : '✕'}
        </button>
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            title="撤销 (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            title="重做 (Ctrl+Y)"
          >
            ↷
          </button>
        </div>

        {/* Alignment & Distribution (visible when ≥2 nodes selected) */}
        {showAlignTools && (
          <div className="flex items-center gap-0.5">
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={onAlignLeft} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title="左对齐">⇤</button>
            <button onClick={onAlignHorizontalCenter} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title="水平居中">⇔</button>
            <button onClick={onAlignRight} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title="右对齐">⇥</button>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button onClick={onAlignTop} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title="顶对齐">⇧</button>
            <button onClick={onAlignVerticalCenter} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title="垂直居中">⇳</button>
            <button onClick={onAlignBottom} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title="底对齐">⇩</button>
            {showDistributeTools && (
              <>
                <div className="w-px h-5 bg-border mx-0.5" />
                <button onClick={onDistributeHorizontal} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title="水平分布">↔</button>
                <button onClick={onDistributeVertical} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title="垂直分布">↕</button>
              </>
            )}
          </div>
        )}

        <span className="text-sm font-semibold text-text-primary">
          {isDirty && <span className="text-amber-500 mr-0.5">•</span>}
          Topo
        </span>
        <span className="text-2xs text-text-secondary bg-hover-bg px-1.5 py-0.5 rounded">V1.0.0</span>
        {/* V0.9.2: Asset statistics with hover tooltip */}
        <div
          className="relative"
          onMouseEnter={() => setShowStatsTooltip(true)}
          onMouseLeave={() => setShowStatsTooltip(false)}
        >
          <span className="text-xs text-text-secondary cursor-default">
            {statsSummary}
          </span>
          {showStatsTooltip && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 bg-surface border border-border rounded-lg shadow-lg p-3 min-w-[200px]"
              onMouseEnter={() => setShowStatsTooltip(true)}
              onMouseLeave={() => setShowStatsTooltip(false)}
            >
              {/* Device details */}
              {assetStats.deviceCategories.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-text-primary mb-1.5">
                    📦 设备详情
                  </div>
                  <div className="border-t border-border mb-1.5" />
                  {assetStats.deviceCategories.map(dc => (
                    <div key={dc.label} className="mb-1.5">
                      <div className="text-xs font-medium text-text-primary">
                        {dc.label} · {dc.count}
                      </div>
                      {dc.models.map(m => (
                        <div key={m.name} className="text-2xs text-text-secondary ml-2">
                          {m.name} · {m.count}
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
              {/* Connection details */}
              {assetStats.connectionTypes.length > 0 && (
                <>
                  {assetStats.deviceCategories.length > 0 && (
                    <div className="border-t border-border my-1.5" />
                  )}
                  <div className="text-xs font-semibold text-text-primary mb-1.5">
                    🔗 连线详情
                  </div>
                  <div className="border-t border-border mb-1.5" />
                  {assetStats.connectionTypes.map(ct => (
                    <div key={ct.label} className="text-xs text-text-primary">
                      {ct.label} · {ct.count}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
        {/* Grid toggle */}
        <button
          onClick={onToggleGrid}
          className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${
            showGrid
              ? 'border-accent text-accent bg-accent-bg'
              : 'border-border text-text-secondary hover:bg-hover-bg'
          }`}
          title={showGrid ? '隐藏网格' : '显示网格'}
        >
          ⊞
        </button>
        {/* Snap toggle */}
        <button
          onClick={onToggleSnap}
          className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${
            snapEnabled
              ? 'border-accent text-accent bg-accent-bg'
              : 'border-border text-text-secondary hover:bg-hover-bg'
          }`}
          title={snapEnabled ? '关闭吸附' : '开启吸附'}
        >
          ⊡
        </button>
        {/* Search */}
        <button
          onClick={onOpenSearch}
          className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary"
          title="搜索设备 (Ctrl+F)"
        >
          🔍
        </button>
        <div className="w-px h-5 bg-border mx-0.5" />
        {/* Zoom controls */}
        <button
          onClick={onZoomOut}
          className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary text-sm"
          title="缩小 (Ctrl+-)"
        >
          −
        </button>
        <span
          className="text-xs text-text-secondary min-w-[42px] text-center cursor-default"
          title="当前缩放比例"
        >
          {viewportZoom != null ? `${Math.round(viewportZoom * 100)}%` : '100%'}
        </span>
        <button
          onClick={onZoomIn}
          className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary text-sm"
          title="放大 (Ctrl+=)"
        >
          +
        </button>
        <button
          onClick={onFitView}
          className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary text-xs"
          title="适应视窗 (Ctrl+0)"
        >
          ⊡
        </button>
        <div className="w-px h-5 bg-border mx-0.5" />

        <button
          onClick={onToggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary"
          title={theme === 'gilded' ? '切换到简洁主题' : '切换到鎏金主题'}
        >
          {theme === 'gilded' ? '☀️' : '✨'}
        </button>

        <button
          onClick={onNew}
          className="px-3 py-1.5 text-xs font-medium rounded bg-surface border border-border hover:bg-hover-bg transition-colors text-text-primary"
          title="新建拓扑 (清空画布)"
        >
          新建
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1.5 text-xs font-medium rounded bg-surface border border-border hover:bg-hover-bg transition-colors text-text-primary"
          title="保存拓扑文件 (.topo.json)"
          disabled={nodes.length === 0}
        >
          保存
        </button>
        <button
          onClick={onOpen}
          className="px-3 py-1.5 text-xs font-medium rounded bg-surface border border-border hover:bg-hover-bg transition-colors text-text-primary"
          title="打开拓扑文件"
        >
          打开
        </button>

        {/* Template dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowTemplateMenu(!showTemplateMenu); onRefreshTemplateList?.() }}
            onBlur={() => setTimeout(() => setShowTemplateMenu(false), 200)}
            className="px-3 py-1.5 text-xs font-medium rounded bg-surface border border-border hover:bg-hover-bg transition-colors text-text-primary"
            title="拓扑模板"
          >
            模板 ▾
          </button>
          {showTemplateMenu && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-50 py-1 min-w-[180px]">
              <button
                onMouseDown={() => { onSaveAsTemplate?.(); setShowTemplateMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors text-text-primary"
                disabled={nodes.length === 0}
              >
                💾 保存为模板...
              </button>
              <button
                onMouseDown={() => { onImportTemplate?.(); setShowTemplateMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors text-text-primary"
              >
                📥 导入模板...
              </button>
              {templateList && templateList.length > 0 && (
                <>
                  <div className="border-t border-border my-0.5" />
                  <div className="px-3 py-1 text-2xs text-text-secondary font-medium">加载模板</div>
                  {templateList.map(t => (
                    <div key={t.name} className="flex items-center group">
                      <button
                        onMouseDown={() => { onLoadTemplate?.(t.name); setShowTemplateMenu(false) }}
                        className="flex-1 text-left px-3 py-1 text-xs hover:bg-hover-bg transition-colors text-text-primary truncate"
                        title={t.name}
                      >
                        📐 {t.name}
                      </button>
                      <button
                        onMouseDown={() => { onDeleteTemplate?.(t.name); setShowTemplateMenu(false) }}
                        className="px-2 py-1 text-2xs text-text-secondary hover:text-danger hover:bg-danger-bg transition-colors opacity-0 group-hover:opacity-100"
                        title="删除模板"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

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
            <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
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
