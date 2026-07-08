import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryRow, DeviceRow } from '../../types'
import { RACK_SIZES } from '../../utils/rackUtils'
import AddDeviceModal from './AddDeviceModal'
import SidebarContextMenu from '../SidebarContextMenu'
import type { SidebarContextMenuState } from '../SidebarContextMenu'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog'

// Icon mapping per category
const CATEGORY_ICONS: Record<string, string> = {
  firewall: '🛡️',
  switch: '🔀',
  ac: '📡',
  ap: '📶',
  server: '🖥️',
  pc: '🖥️',
  laptop: '💻',
  'patch-panel': '🔌',
  'hyper-converged': '🗄️',
  storage: '💾',
  ont: '📟',
  'sdwan': '🔷',
  default: '📦',
}

// Map rack uHeight to translation key suffix
function getRackLabelKey(uHeight: number): string {
  if (uHeight <= 12) return 'sidebar.rackSizes.wallMount'
  if (uHeight <= 22) return 'sidebar.rackSizes.small'
  if (uHeight <= 36) return 'sidebar.rackSizes.medium'
  if (uHeight === 42) return 'sidebar.rackSizes.standard'
  return 'sidebar.rackSizes.large'
}

interface SidebarProps {
  // Phase 3: onDragStart will be wired for drag-to-canvas
}

export default function Sidebar(_props: SidebarProps) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [hoveredDevice, setHoveredDevice] = useState<DeviceRow | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState | null>(null)
  const [editingDevice, setEditingDevice] = useState<DeviceRow | null>(null)
  const [deletingDevice, setDeletingDevice] = useState<DeviceRow | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load devices from database
  const loadDevices = useCallback(async () => {
    try {
      const [cats, devs] = await Promise.all([
        window.electronAPI.getCategories(),
        window.electronAPI.getDevices(),
      ])
      setCategories(cats)
      setDevices(devs)
      // Auto-expand first 3 categories
      setExpandedCategories(new Set(cats.slice(0, 3).map((c) => c.id)))
    } catch (err) {
      console.error('Failed to load device data:', err)
    }
  }, [])

  // Fetch data from database on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      await loadDevices()
      setLoading(false)
    }
    loadData()
  }, [loadDevices])

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    return devices.filter(
      (d) =>
        d.model.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.vendor_name.toLowerCase().includes(q) ||
        d.category_name.toLowerCase().includes(q)
    )
  }, [searchQuery, devices])

  // Group devices by category
  const devicesByCategory = useMemo(() => {
    const map = new Map<number, DeviceRow[]>()
    for (const d of devices) {
      const list = map.get(d.category_id) || []
      list.push(d)
      map.set(d.category_id, list)
    }
    return map
  }, [devices])

  const toggleCategory = useCallback((id: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Right-click context menu
  const handleDeviceContextMenu = useCallback((e: React.MouseEvent, device: DeviceRow) => {
    setContextMenu({ x: e.clientX, y: e.clientY, device })
  }, [])

  // Delete device
  const handleDeleteDevice = useCallback(async () => {
    if (!deletingDevice) return
    try {
      await window.electronAPI.deleteDevice(deletingDevice.id)
      await loadDevices()
    } catch (err) {
      console.error('Failed to delete device:', err)
    } finally {
      setDeletingDevice(null)
    }
  }, [deletingDevice, loadDevices])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setSearchQuery(value)

      // Clear any pending debounce timer
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = null
      }

      if (value.trim()) {
        // Debounce API call by 300ms
        searchTimerRef.current = setTimeout(async () => {
          try {
            const results = await window.electronAPI.searchDevices(value)
            setDevices(results)
          } catch {
            // fall back to local search (results already filtered via useMemo)
          }
        }, 300)
      } else {
        // Reload all devices immediately on clear
        window.electronAPI.getDevices().then(setDevices).catch(() => {})
      }
    },
    []
  )

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // ── Render: Search mode ──────────────────────────────────
  if (searchQuery.trim() && searchResults) {
    return (
      <div className="h-full bg-sidebar border-r border-border flex flex-col">
        <div className="p-3">
          <div className="relative">
            <input
              type="text"
              placeholder={t('sidebar.searchPlaceholder')}
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full h-8 pl-8 pr-2 text-xs rounded border border-border bg-surface text-text-primary placeholder-text-secondary focus:outline-none focus:border-select-border transition-colors"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-secondary">🔍</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="text-xs text-text-secondary px-2 py-1 mb-1">
            {t('sidebar.searchResults', { count: searchResults.length })}
          </div>
          {searchResults.map((device) => (
            <DeviceListItem
              key={device.id}
              device={device}
              onHover={setHoveredDevice}
              onContextMenu={handleDeviceContextMenu}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Render: Normal category view ─────────────────────────
  return (
    <div className="h-full bg-sidebar border-r border-border flex flex-col">
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <input
            type="text"
            placeholder={t('sidebar.searchPlaceholder')}
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full h-8 pl-8 pr-2 text-xs rounded border border-border bg-surface text-text-primary placeholder-text-secondary focus:outline-none focus:border-select-border transition-colors"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-secondary">🔍</span>
        </div>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading && (
          <div className="py-8 text-center text-xs text-text-secondary">{t('sidebar.loading')}</div>
        )}

        {/* ── V1.1.0: Rack cabinet section ── */}
        {!loading && (
          <div className="mb-3">
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
              <span className="text-sm">🗄️</span>
              <span className="text-sm font-semibold text-text-primary">{t('sidebar.rackSection')}</span>
            </div>
            <div className="text-2xs text-text-secondary px-2 mb-1.5">
              {t('sidebar.rackSubtitle')}
            </div>
            <div className="ml-2 pl-3 border-l border-border grid grid-cols-2 gap-1">
              {RACK_SIZES.map((rack) => (
                <div
                  key={rack.uHeight}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-grab hover:bg-select-bg hover:border hover:border-select-border active:cursor-grabbing transition-all border border-transparent"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/topo-rack', JSON.stringify(rack))
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-rack-frame)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">
                      {t(getRackLabelKey(rack.uHeight), { u: rack.uHeight })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading &&
          categories.map((cat) => {
            const catDevices = devicesByCategory.get(cat.id) || []
            const isExpanded = expandedCategories.has(cat.id)
            const icon = CATEGORY_ICONS[cat.icon] || CATEGORY_ICONS.default

            return (
              <div key={cat.id} className="mb-1">
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-hover-bg transition-colors text-left"
                >
                  <span
                    className="text-xs transition-transform duration-150"
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >
                    ▶
                  </span>
                  <span className="text-sm">{icon}</span>
                  <span className="text-sm font-semibold text-text-primary flex-1">{cat.name}</span>
                  <span className="text-xs text-text-secondary">{catDevices.length}</span>
                </button>

                {/* Device list */}
                {isExpanded && (
                  <div className="ml-2 pl-3 border-l border-border">
                    {catDevices.length === 0 ? (
                      <div className="py-4 text-center text-xs text-text-secondary">{t('sidebar.noDevices')}</div>
                    ) : (
                      catDevices.map((device) => (
                        <DeviceListItem
                          key={device.id}
                          device={device}
                          onHover={setHoveredDevice}
                          onContextMenu={handleDeviceContextMenu}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-2">
        <button
          onClick={() => { setEditingDevice(null); setShowAddModal(true); }}
          className="w-full h-8 text-xs font-medium border border-dashed border-select-border text-select-border rounded hover:bg-select-bg transition-colors"
        >
          {t('sidebar.addCustomDevice')}
        </button>
        <div className="text-xs text-text-secondary text-center">
          {t('sidebar.footerSummary', { deviceCount: devices.length, categoryCount: categories.length })}
        </div>
      </div>

      {/* Custom device modal */}
      {showAddModal && (
        <AddDeviceModal
          device={editingDevice}
          onClose={() => { setShowAddModal(false); setEditingDevice(null); }}
          onCreated={() => {
            setShowAddModal(false)
            setEditingDevice(null)
            loadDevices()
          }}
        />
      )}

      {/* Hover tooltip */}
      {hoveredDevice && (
        <DeviceTooltip device={hoveredDevice} />
      )}

      {/* Sidebar device context menu */}
      {contextMenu && (
        <SidebarContextMenu
          contextMenu={contextMenu}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            setEditingDevice(contextMenu.device)
            setShowAddModal(true)
            setContextMenu(null)
          }}
          onDelete={() => {
            setDeletingDevice(contextMenu.device)
            setContextMenu(null)
          }}
        />
      )}

      {/* Delete device confirmation */}
      <ConfirmDialog
        open={deletingDevice !== null}
        title={t('sidebar.deleteConfirmTitle')}
        message={deletingDevice ? (
          <>{t('sidebar.deleteConfirmMessage', { name: `${deletingDevice.vendor_name} ${deletingDevice.model}` })}</>
        ) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={handleDeleteDevice}
        onCancel={() => setDeletingDevice(null)}
      />
    </div>
  )
}

// ── Device list item ───────────────────────────────────────
function DeviceListItem({
  device,
  onHover,
  onContextMenu,
}: {
  device: DeviceRow
  onHover: (d: DeviceRow | null) => void
  onContextMenu: (e: React.MouseEvent, device: DeviceRow) => void
}) {
  return (
    <div
      className="group flex items-center gap-2 px-2 py-1.5 rounded mx-1 my-0.5 cursor-grab hover:bg-select-bg hover:border hover:border-select-border active:cursor-grabbing transition-all border border-transparent"
      draggable
      onMouseEnter={() => onHover(device)}
      onMouseLeave={() => onHover(null)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e, device)
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/topo-device', JSON.stringify(device))
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      {/* Device type dot */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: getCategoryColor(device.category_name) }}
      />

      {/* Device info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-primary truncate">
          {device.vendor_name} {device.model}
        </div>
        <div className="text-2xs text-text-secondary truncate mt-0.5">
          {device.ports_info}
        </div>
      </div>
    </div>
  )
}

// ── Hover tooltip ──────────────────────────────────────────
function DeviceTooltip({ device }: { device: DeviceRow }) {
  const { t } = useTranslation()
  return (
    <div className="fixed left-[270px] top-20 z-50 w-64 p-3 bg-surface border border-border rounded-lg shadow-lg pointer-events-none">
      <div className="text-sm font-semibold text-text-primary">
        {device.vendor_name} {device.model}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs text-text-secondary bg-hover-bg px-1.5 py-0.5 rounded">
          {device.category_name}
        </span>
      </div>
      {device.description && (
        <div className="mt-2 text-xs text-text-secondary leading-relaxed">
          {device.description}
        </div>
      )}
      {device.ports_info && (
        <div className="mt-1.5 text-2xs text-text-secondary">
          <span className="font-medium">{t('sidebar.portPrefix')}</span>{device.ports_info}
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────
function getCategoryColor(categoryName: string): string {
  const colors: Record<string, string> = {
    '防火墙': 'var(--color-cat-firewall-accent)',
    '交换机': 'var(--color-cat-switch-accent)',
    '无线控制器': 'var(--color-cat-ac-accent)',
    '无线接入点': 'var(--color-cat-ap-accent)',
    '服务器': 'var(--color-cat-server-accent)',
    '终端-PC': 'var(--color-cat-pc-accent)',
    '终端-笔记本': 'var(--color-cat-laptop-accent)',
    '配线架': 'var(--color-cat-patch-panel-accent)',
    '超融合': 'var(--color-cat-hyper-converged-accent)',
    '存储': 'var(--color-cat-storage-accent)',
    '运营商光猫': 'var(--color-cat-ont-accent)',
    'SDWAN': 'var(--color-cat-sdwan-accent)',
  }
  return colors[categoryName] || 'var(--color-cat-default-accent)'
}
