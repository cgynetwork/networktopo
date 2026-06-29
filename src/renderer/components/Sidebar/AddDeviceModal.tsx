import { useState, useEffect, useCallback } from 'react'
import type { CategoryRow, VendorRow } from '../../types'

interface AddDeviceModalProps {
  onClose: () => void
  onCreated: () => void
}

export default function AddDeviceModal({ onClose, onCreated }: AddDeviceModalProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [categoryId, setCategoryId] = useState<number>(0)
  const [vendorId, setVendorId] = useState<number>(0)
  const [newVendorName, setNewVendorName] = useState('')
  const [model, setModel] = useState('')
  const [description, setDescription] = useState('')
  const [portsInfo, setPortsInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showNewVendor, setShowNewVendor] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [cats, vends] = await Promise.all([
          window.electronAPI.getCategories(),
          window.electronAPI.getVendors(),
        ])
        setCategories(cats)
        setVendors(vends)
        if (cats.length > 0) setCategoryId(cats[0].id)
        if (vends.length > 0) setVendorId(vends[0].id)
      } catch (e) {
        console.error('Failed to load form data:', e)
      }
    }
    load()
  }, [])

  const handleAddVendor = useCallback(async () => {
    const name = newVendorName.trim()
    if (!name) return
    setError('')
    try {
      const result = await window.electronAPI.addVendor(name)
      if (result.success && result.id) {
        setVendors((prev) => [...prev, { id: result.id!, name, logo_path: null }])
        setVendorId(result.id)
        setNewVendorName('')
        setShowNewVendor(false)
      } else {
        setError(result.error || '添加厂商失败')
      }
    } catch {
      setError('添加厂商失败')
    }
  }, [newVendorName])

  const handleSubmit = useCallback(async () => {
    if (!categoryId || (!vendorId && !showNewVendor)) {
      setError('请选择分类和厂商')
      return
    }
    if (!model.trim()) {
      setError('请输入型号')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      let finalVendorId = vendorId
      // If adding a new vendor, do it first
      if (showNewVendor && newVendorName.trim()) {
        const vr = await window.electronAPI.addVendor(newVendorName.trim())
        if (vr.success && vr.id) {
          finalVendorId = vr.id
        } else {
          setError(vr.error || '添加厂商失败')
          setSubmitting(false)
          return
        }
      }
      await window.electronAPI.addDevice({
        category_id: categoryId,
        vendor_id: finalVendorId,
        model: model.trim(),
        description: description.trim(),
        ports_info: portsInfo.trim(),
      })
      onCreated()
    } catch {
      setError('创建设备失败')
    } finally {
      setSubmitting(false)
    }
  }, [categoryId, vendorId, showNewVendor, newVendorName, model, description, portsInfo, onCreated])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl w-[420px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">自定义设备</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary text-xs"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">设备分类 <span className="text-red-400">*</span></label>
            <select
              className="w-full h-8 px-2 text-xs rounded border border-border bg-white text-text-primary focus:outline-none focus:border-select-border"
              value={categoryId || ''}
              onChange={(e) => setCategoryId(Number(e.target.value))}
            >
              <option value="" disabled>请选择分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">厂商 <span className="text-red-400">*</span></label>
            {!showNewVendor ? (
              <div className="flex gap-2">
                <select
                  className="flex-1 h-8 px-2 text-xs rounded border border-border bg-white text-text-primary focus:outline-none focus:border-select-border"
                  value={vendorId || ''}
                  onChange={(e) => setVendorId(Number(e.target.value))}
                >
                  <option value="" disabled>请选择厂商</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="px-2 h-8 text-xs text-select-border border border-select-border rounded hover:bg-select-bg transition-colors whitespace-nowrap"
                  onClick={() => setShowNewVendor(true)}
                >
                  + 新厂商
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 h-8 px-2 text-xs rounded border border-border bg-white text-text-primary focus:outline-none focus:border-select-border"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddVendor() }}
                  placeholder="输入新厂商名称..."
                  autoFocus
                />
                <button
                  type="button"
                  className="px-2 h-8 text-xs bg-select-border text-white rounded hover:opacity-90 transition-opacity whitespace-nowrap"
                  onClick={handleAddVendor}
                >
                  确认
                </button>
                <button
                  type="button"
                  className="px-2 h-8 text-xs border border-border rounded hover:bg-hover-bg transition-colors whitespace-nowrap"
                  onClick={() => { setShowNewVendor(false); setNewVendorName('') }}
                >
                  取消
                </button>
              </div>
            )}
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">型号 <span className="text-red-400">*</span></label>
            <input
              type="text"
              className="w-full h-8 px-2 text-xs rounded border border-border bg-white text-text-primary focus:outline-none focus:border-select-border"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="如 S5130S-28S-HPWR-EI"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">描述</label>
            <textarea
              className="w-full h-16 px-2 py-1 text-xs rounded border border-border bg-white text-text-primary focus:outline-none focus:border-select-border resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="设备描述..."
            />
          </div>

          {/* Ports info */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">端口信息</label>
            <input
              type="text"
              className="w-full h-8 px-2 text-xs rounded border border-border bg-white text-text-primary focus:outline-none focus:border-select-border"
              value={portsInfo}
              onChange={(e) => setPortsInfo(e.target.value)}
              placeholder="如 24×GE + 4×10G SFP+"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded border border-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 h-8 text-xs border border-border rounded hover:bg-hover-bg transition-colors text-text-primary"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 h-8 text-xs bg-select-border text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '创建中...' : '创建设备'}
          </button>
        </div>
      </div>
    </div>
  )
}
