import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node, Edge } from '@xyflow/react'
import type { ThemeName } from '../../context/ThemeContext'
import type { Language } from '../../context/LanguageContext'
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
  language?: Language
  onToggleLanguage?: () => void
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
  isDemoMode?: boolean
  onToggleDemoMode?: () => void
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
  language,
  onToggleLanguage,
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
  isDemoMode,
  onToggleDemoMode,
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
  const { t } = useTranslation()
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [showStatsTooltip, setShowStatsTooltip] = useState(false)

  // ── V0.9.2: Topology asset statistics ─────────────────────────
  const deviceLabels: Record<string, string> = {
    '防火墙': t('toolbar.assetStats.firewall'),
    '交换机': t('toolbar.assetStats.switch'),
    '无线控制器': t('toolbar.assetStats.wirelessController'),
    '无线接入点': t('toolbar.assetStats.wirelessAP'),
    '服务器': t('toolbar.assetStats.server'),
    '终端-PC': t('toolbar.assetStats.pc'),
    '终端-笔记本': t('toolbar.assetStats.laptop'),
  }
  const connTypeLabels: Record<string, string> = {
    'ethernet': t('toolbar.assetStats.ethernet'),
    'fiber': t('toolbar.assetStats.fiber'),
    'stack': t('toolbar.assetStats.stack'),
    'wireless': t('toolbar.assetStats.wireless'),
    'tunnel': t('toolbar.assetStats.tunnel'),
  }

  const assetStats = useMemo(() => {
    // Device aggregation: category → { count, models: { model → count } }
    const catMap = new Map<string, { count: number; models: Map<string, number> }>()
    for (const n of nodes) {
      const data = n.data as NodeData | undefined
      if (!data?.device) continue
      const cat = data.customCategory || data.device.category_name || t('toolbar.assetStats.uncategorized')
      const model = data.customDeviceModel || data.device.model || t('toolbar.assetStats.unknownModel')
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
  }, [nodes, edges, t])

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
    return parts.length > 0 ? parts.join('  ') : t('toolbar.assetStats.noDevices')
  }, [assetStats, t])

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
          title={sidebarCollapsed ? t('toolbar.expandSidebar') : t('toolbar.collapseSidebar')}
        >
          {sidebarCollapsed ? '☰' : '✕'}
        </button>
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            title={t('toolbar.undo')}
          >
            ↶
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            title={t('toolbar.redo')}
          >
            ↷
          </button>
        </div>

        {/* Alignment & Distribution (visible when ≥2 nodes selected) */}
        {showAlignTools && (
          <div className="flex items-center gap-0.5">
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={onAlignLeft} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title={t('toolbar.alignLeft')}>⇤</button>
            <button onClick={onAlignHorizontalCenter} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title={t('toolbar.alignHorizontalCenter')}>⇔</button>
            <button onClick={onAlignRight} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title={t('toolbar.alignRight')}>⇥</button>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button onClick={onAlignTop} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title={t('toolbar.alignTop')}>⇧</button>
            <button onClick={onAlignVerticalCenter} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title={t('toolbar.alignVerticalCenter')}>⇳</button>
            <button onClick={onAlignBottom} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title={t('toolbar.alignBottom')}>⇩</button>
            {showDistributeTools && (
              <>
                <div className="w-px h-5 bg-border mx-0.5" />
                <button onClick={onDistributeHorizontal} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title={t('toolbar.distributeHorizontal')}>↔</button>
                <button onClick={onDistributeVertical} className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary" title={t('toolbar.distributeVertical')}>↕</button>
              </>
            )}
          </div>
        )}

        <span className="text-sm font-semibold text-text-primary">
          {isDirty && <span className="text-amber-500 mr-0.5">•</span>}
          Topo
        </span>
        <span className="text-2xs text-text-secondary bg-hover-bg px-1.5 py-0.5 rounded">V1.6.0</span>
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
                    {t('toolbar.assetStats.deviceDetails')}
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
                    {t('toolbar.assetStats.connectionDetails')}
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
          title={showGrid ? t('toolbar.hideGrid') : t('toolbar.showGrid')}
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
          title={snapEnabled ? t('toolbar.disableSnap') : t('toolbar.enableSnap')}
        >
          ⊡
        </button>
        {/* Demo mode toggle */}
        <button
          onClick={onToggleDemoMode}
          className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${
            isDemoMode
              ? 'border-accent text-accent bg-accent-bg'
              : 'border-border text-text-secondary hover:bg-hover-bg'
          }`}
          title={isDemoMode ? t('toolbar.exitDemoMode') : t('toolbar.demoMode')}
        >
          🎬
        </button>
        {/* Search */}
        <button
          onClick={onOpenSearch}
          className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary"
          title={t('toolbar.searchDevices')}
        >
          🔍
        </button>
        <div className="w-px h-5 bg-border mx-0.5" />
        {/* Zoom controls */}
        <button
          onClick={onZoomOut}
          className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary text-sm"
          title={t('toolbar.zoomOut')}
        >
          −
        </button>
        <span
          className="text-xs text-text-secondary min-w-[42px] text-center cursor-default"
          title={t('toolbar.currentZoom')}
        >
          {viewportZoom != null ? `${Math.round(viewportZoom * 100)}%` : '100%'}
        </span>
        <button
          onClick={onZoomIn}
          className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary text-sm"
          title={t('toolbar.zoomIn')}
        >
          +
        </button>
        <button
          onClick={onFitView}
          className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary text-xs"
          title={t('toolbar.fitView')}
        >
          ⊡
        </button>
        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary"
          title={theme === 'gilded' ? t('toolbar.switchToDefaultTheme') : t('toolbar.switchToGildedTheme')}
        >
          {theme === 'gilded' ? '☀️' : '✨'}
        </button>

        {/* Language toggle */}
        <button
          onClick={onToggleLanguage}
          className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-secondary text-xs font-semibold"
          title={t('toolbar.switchLanguage')}
        >
          {language === 'zh' ? 'EN' : '中'}
        </button>

        <button
          onClick={onNew}
          className="px-3 py-1.5 text-xs font-medium rounded bg-surface border border-border hover:bg-hover-bg transition-colors text-text-primary"
          title={t('toolbar.newTooltip')}
        >
          {t('toolbar.new')}
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1.5 text-xs font-medium rounded bg-surface border border-border hover:bg-hover-bg transition-colors text-text-primary"
          title={t('toolbar.saveTooltip')}
          disabled={nodes.length === 0}
        >
          {t('toolbar.save')}
        </button>
        <button
          onClick={onOpen}
          className="px-3 py-1.5 text-xs font-medium rounded bg-surface border border-border hover:bg-hover-bg transition-colors text-text-primary"
          title={t('toolbar.openTooltip')}
        >
          {t('toolbar.open')}
        </button>

        {/* Template dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowTemplateMenu(!showTemplateMenu); onRefreshTemplateList?.() }}
            onBlur={() => setTimeout(() => setShowTemplateMenu(false), 200)}
            className="px-3 py-1.5 text-xs font-medium rounded bg-surface border border-border hover:bg-hover-bg transition-colors text-text-primary"
            title={t('toolbar.templateTooltip')}
          >
            {t('toolbar.template')}
          </button>
          {showTemplateMenu && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-50 py-1 min-w-[180px]">
              <button
                onMouseDown={() => { onSaveAsTemplate?.(); setShowTemplateMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors text-text-primary"
                disabled={nodes.length === 0}
              >
                💾 {t('toolbar.saveAsTemplate')}
              </button>
              <button
                onMouseDown={() => { onImportTemplate?.(); setShowTemplateMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors text-text-primary"
              >
                📥 {t('toolbar.importTemplate')}
              </button>
              {templateList && templateList.length > 0 && (
                <>
                  <div className="border-t border-border my-0.5" />
                  <div className="px-3 py-1 text-2xs text-text-secondary font-medium">{t('toolbar.loadTemplate')}</div>
                  {templateList.map(tmpl => (
                    <div key={tmpl.name} className="flex items-center group">
                      <button
                        onMouseDown={() => { onLoadTemplate?.(tmpl.name); setShowTemplateMenu(false) }}
                        className="flex-1 text-left px-3 py-1 text-xs hover:bg-hover-bg transition-colors text-text-primary truncate"
                        title={tmpl.name}
                      >
                        📐 {tmpl.name}
                      </button>
                      <button
                        onMouseDown={() => { onDeleteTemplate?.(tmpl.name); setShowTemplateMenu(false) }}
                        className="px-2 py-1 text-2xs text-text-secondary hover:text-danger hover:bg-danger-bg transition-colors opacity-0 group-hover:opacity-100"
                        title={t('toolbar.deleteTemplate')}
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
            title={t('toolbar.exportTooltip')}
            disabled={nodes.length === 0}
          >
            {t('toolbar.export')}
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
              <button
                onMouseDown={() => { onExportPNG?.(); setShowExportMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors text-text-primary"
              >
                🖼️ {t('toolbar.exportPNG')}
              </button>
              <button
                onMouseDown={() => { onExportPDF?.(); setShowExportMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors text-text-primary"
              >
                📄 {t('toolbar.exportPDF')}
              </button>
              <div className="border-t border-border my-0.5" />
              <button
                onMouseDown={() => { onExportGIF?.(); setShowExportMenu(false) }}
                disabled={isExportingGIF}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors text-text-primary disabled:opacity-40 disabled:cursor-wait"
              >
                {isExportingGIF ? `🎞️ ${t('toolbar.exportingGIF')}` : `🎞️ ${t('toolbar.exportGIF')}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
