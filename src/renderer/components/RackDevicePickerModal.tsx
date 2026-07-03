import { useState, useEffect, useMemo } from 'react'
import type { CategoryRow, DeviceRow } from '../types'

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
  'sdwan-node': '☁️',
  'sdwan-internet': '🌐',
  'sdwan-cloud': '☁️',
  'sdwan-datacenter': '🏢',
  'sdwan-device': '🔷',
  default: '📦',
}

interface RackDevicePickerModalProps {
  rackId: string
  onSelect: (device: DeviceRow) => void
  onClose: () => void
}

export default function RackDevicePickerModal({ rackId, onSelect, onClose }: RackDevicePickerModalProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [cats, devs] = await Promise.all([
          window.electronAPI.getCategories(),
          window.electronAPI.getDevices(),
        ])
        setCategories(cats)
        setDevices(devs)
      } catch (err) {
        console.error('Failed to load devices for rack picker:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const devicesByCategory = useMemo(() => {
    const map = new Map<number, DeviceRow[]>()
    for (const d of devices) {
      const list = map.get(d.category_id) || []
      list.push(d)
      map.set(d.category_id, list)
    }
    return map
  }, [devices])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-surface border border-border rounded-lg shadow-xl w-[480px] max-h-[70vh] flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">选择设备添加到机柜</h3>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary text-xs"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="py-8 text-center text-xs text-text-secondary">加载设备库...</div>
            ) : (
              categories.map((cat) => {
                const catDevices = devicesByCategory.get(cat.id) || []
                if (catDevices.length === 0) return null
                const icon = CATEGORY_ICONS[cat.icon] || CATEGORY_ICONS.default
                return (
                  <div key={cat.id} className="mb-3">
                    <div className="flex items-center gap-2 px-1 py-1 mb-1">
                      <span className="text-xs">{icon}</span>
                      <span className="text-xs font-semibold text-text-primary">{cat.name}</span>
                      <span className="text-2xs text-text-secondary">{catDevices.length}</span>
                    </div>
                    <div className="ml-4 grid grid-cols-1 gap-1">
                      {catDevices.map((device) => (
                        <button
                          key={device.id}
                          className="text-left px-2.5 py-2 rounded border border-transparent hover:border-select-border hover:bg-select-bg transition-colors"
                          onClick={() => onSelect(device)}
                        >
                          <div className="text-xs font-medium text-text-primary">
                            {device.vendor_name} {device.model}
                          </div>
                          <div className="text-2xs text-text-secondary mt-0.5 truncate">
                            {device.ports_info}{device.description ? ` · ${device.description}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border text-2xs text-text-secondary text-center">
            点击设备即可添加到机柜 · 也可从左侧边栏直接拖拽
          </div>
        </div>
      </div>
    </>
  )
}
