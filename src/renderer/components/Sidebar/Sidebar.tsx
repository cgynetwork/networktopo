import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { CategoryRow, DeviceRow } from '../../types'
import AddDeviceModal from './AddDeviceModal'

// Icon mapping per category
const CATEGORY_ICONS: Record<string, string> = {
  firewall: '🛡️',
  switch: '🔀',
  ac: '📡',
  ap: '📶',
  server: '🖥️',
  default: '📦',
}

interface SidebarProps {
  // Phase 3: onDragStart will be wired for drag-to-canvas
}

export default function Sidebar(_props: SidebarProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [hoveredDevice, setHoveredDevice] = useState<DeviceRow | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
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
              placeholder="搜索设备..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full h-8 pl-8 pr-2 text-xs rounded border border-border bg-surface text-text-primary placeholder-text-secondary focus:outline-none focus:border-select-border transition-colors"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-secondary">🔍</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="text-xs text-text-secondary px-2 py-1 mb-1">
            搜索到 {searchResults.length} 个设备
          </div>
          {searchResults.map((device) => (
            <DeviceListItem
              key={device.id}
              device={device}
              onHover={setHoveredDevice}
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
            placeholder="搜索设备..."
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
          <div className="py-8 text-center text-xs text-text-secondary">加载设备库...</div>
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
                      <div className="py-4 text-center text-xs text-text-secondary">暂无设备</div>
                    ) : (
                      catDevices.map((device) => (
                        <DeviceListItem
                          key={device.id}
                          device={device}
                          onHover={setHoveredDevice}
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
          onClick={() => setShowAddModal(true)}
          className="w-full h-8 text-xs font-medium border border-dashed border-select-border text-select-border rounded hover:bg-select-bg transition-colors"
        >
          ＋ 自定义设备
        </button>
        <div className="text-xs text-text-secondary text-center">
          {devices.length} 个设备 · {categories.length} 个分类
        </div>
      </div>

      {/* Custom device modal */}
      {showAddModal && (
        <AddDeviceModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false)
            loadDevices()
          }}
        />
      )}

      {/* Hover tooltip */}
      {hoveredDevice && (
        <DeviceTooltip device={hoveredDevice} />
      )}
    </div>
  )
}

// ── Device list item ───────────────────────────────────────
function DeviceListItem({
  device,
  onHover,
}: {
  device: DeviceRow
  onHover: (d: DeviceRow | null) => void
}) {
  return (
    <div
      className="group flex items-center gap-2 px-2 py-1.5 rounded mx-1 my-0.5 cursor-grab hover:bg-select-bg hover:border hover:border-select-border active:cursor-grabbing transition-all border border-transparent"
      draggable
      onMouseEnter={() => onHover(device)}
      onMouseLeave={() => onHover(null)}
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
          <span className="font-medium">端口：</span>{device.ports_info}
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
  }
  return colors[categoryName] || 'var(--color-cat-default-accent)'
}
