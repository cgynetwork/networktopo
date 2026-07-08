import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryRow, VendorRow, DeviceRow } from '../../types'
import { composePortsInfo, parseModularPorts } from '../../utils/portParser'

interface AddDeviceModalProps {
  device?: DeviceRow | null
  onClose: () => void
  onCreated: () => void
}

export default function AddDeviceModal({ device, onClose, onCreated }: AddDeviceModalProps) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [categoryId, setCategoryId] = useState<number>(0)
  const [vendorId, setVendorId] = useState<number>(0)
  const [newVendorName, setNewVendorName] = useState('')
  const [model, setModel] = useState('')
  const [description, setDescription] = useState('')
  // V0.7.1: Modular port counts
  const [portsRJ45, setPortsRJ45] = useState<number>(0)
  const [portsSFP, setPortsSFP] = useState<number>(0)
  const [portsSFP28, setPortsSFP28] = useState<number>(0)
  const [imagePath, setImagePath] = useState('')
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
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

        if (device) {
          // Edit mode: pre-fill all fields
          setCategoryId(device.category_id)
          setVendorId(device.vendor_id)
          setModel(device.model)
          setDescription(device.description || '')
          // V0.7.1: Parse ports_info into modular counts for editing
          const parsed = parseModularPorts(device.ports_info || '')
          setPortsRJ45(parsed.rj45)
          setPortsSFP(parsed.sfp)
          setPortsSFP28(parsed.tenG)
          setImagePath(device.image_path || '')
        } else {
          // Create mode: default to first category and vendor
          if (cats.length > 0) setCategoryId(cats[0].id)
          if (vends.length > 0) setVendorId(vends[0].id)
        }
      } catch (e) {
        console.error('Failed to load form data:', e)
      }
    }
    load()
  }, [device])

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
        setError(result.error || t('addDeviceModal.vendorAddFailed'))
      }
    } catch {
      setError(t('addDeviceModal.vendorAddFailed'))
    }
  }, [newVendorName])

  const handlePickImage = useCallback(async () => {
    const result = await window.electronAPI.pickDeviceImage()
    if (result.success && result.storedPath) {
      setImagePath(result.storedPath)
    }
  }, [])

  // Load image preview when imagePath changes (设备真机预览)
  useEffect(() => {
    if (imagePath) {
      window.electronAPI
        .readDeviceImage(imagePath)
        .then((result) => {
          if (result.success && result.dataUrl) {
            setImagePreviewUrl(result.dataUrl)
          } else {
            setImagePreviewUrl(null)
          }
        })
        .catch(() => setImagePreviewUrl(null))
    } else {
      setImagePreviewUrl(null)
    }
  }, [imagePath])

  const handleSubmit = useCallback(async () => {
    if (!categoryId || (!vendorId && !showNewVendor)) {
      setError(t('addDeviceModal.categoryRequired'))
      return
    }
    if (!model.trim()) {
      setError(t('addDeviceModal.modelRequired'))
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
          setError(vr.error || t('addDeviceModal.vendorAddFailed'))
          setSubmitting(false)
          return
        }
      }

      if (device) {
        // ── Edit mode: update existing device ──
        const newImagePath = imagePath || null
        const oldImagePath = device.image_path || null

        // If image was changed and old image exists, clean up the old file
        if (oldImagePath && newImagePath !== oldImagePath) {
          await window.electronAPI.deleteDeviceImage(oldImagePath).catch(() => {})
        }

        await window.electronAPI.updateDevice(device.id, {
          category_id: categoryId,
          vendor_id: finalVendorId,
          model: model.trim(),
          description: description.trim(),
          ports_info: composePortsInfo(portsRJ45, portsSFP, portsSFP28),
          image_path: newImagePath,
        })
      } else {
        // ── Create mode ──
        await window.electronAPI.addDevice({
          category_id: categoryId,
          vendor_id: finalVendorId,
          model: model.trim(),
          description: description.trim(),
          ports_info: composePortsInfo(portsRJ45, portsSFP, portsSFP28),
          image_path: imagePath || undefined,
        })
      }
      onCreated()
    } catch {
      setError(device ? t('addDeviceModal.updateFailed') : t('addDeviceModal.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [categoryId, vendorId, showNewVendor, newVendorName, model, description, portsRJ45, portsSFP, portsSFP28, imagePath, device, onCreated])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="bg-surface rounded-lg shadow-xl w-[420px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">
            {device ? t('addDeviceModal.editTitle') : t('addDeviceModal.addTitle')}
          </h2>
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
            <label className="block text-xs text-text-secondary mb-1">{t('addDeviceModal.categoryLabel')} <span className="text-danger">*</span></label>
            <select
              className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
              value={categoryId || ''}
              onChange={(e) => setCategoryId(Number(e.target.value))}
            >
              <option value="" disabled>{t('addDeviceModal.categoryPlaceholder')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">{t('addDeviceModal.vendorLabel')} <span className="text-danger">*</span></label>
            {!showNewVendor ? (
              <div className="flex gap-2">
                <select
                  className="flex-1 h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                  value={vendorId || ''}
                  onChange={(e) => setVendorId(Number(e.target.value))}
                >
                  <option value="" disabled>{t('addDeviceModal.vendorPlaceholder')}</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="px-2 h-8 text-xs text-select-border border border-select-border rounded hover:bg-select-bg transition-colors whitespace-nowrap"
                  onClick={() => setShowNewVendor(true)}
                >
                  {t('addDeviceModal.newVendor')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddVendor() }}
                  placeholder={t('addDeviceModal.newVendorPlaceholder')}
                  autoFocus
                />
                <button
                  type="button"
                  className="px-2 h-8 text-xs bg-select-border text-white rounded hover:opacity-90 transition-opacity whitespace-nowrap"
                  onClick={handleAddVendor}
                >
                  {t('common.confirm')}
                </button>
                <button
                  type="button"
                  className="px-2 h-8 text-xs border border-border rounded hover:bg-hover-bg transition-colors whitespace-nowrap"
                  onClick={() => { setShowNewVendor(false); setNewVendorName('') }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">{t('addDeviceModal.modelLabel')} <span className="text-danger">*</span></label>
            <input
              type="text"
              className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={t('addDeviceModal.modelPlaceholder')}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">{t('addDeviceModal.descriptionLabel')}</label>
            <textarea
              className="w-full h-16 px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('addDeviceModal.descriptionPlaceholder')}
            />
          </div>

          {/* Ports info — V0.7.1 modular editing */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">{t('addDeviceModal.portsSection')}</label>
            <div className="space-y-2">
              <div>
                <label className="block text-2xs text-text-secondary mb-1">{t('addDeviceModal.networkPorts')}</label>
                <input
                  type="number"
                  min="0"
                  max="256"
                  className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                  value={portsRJ45}
                  onChange={(e) => setPortsRJ45(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
              <div>
                <label className="block text-2xs text-text-secondary mb-1">{t('addDeviceModal.gigabitFiberPorts')}</label>
                <input
                  type="number"
                  min="0"
                  max="256"
                  className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                  value={portsSFP}
                  onChange={(e) => setPortsSFP(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
              <div>
                <label className="block text-2xs text-text-secondary mb-1">{t('addDeviceModal.tenGigabitFiberPorts')}</label>
                <input
                  type="number"
                  min="0"
                  max="256"
                  className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                  value={portsSFP28}
                  onChange={(e) => setPortsSFP28(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>
            <p className="text-2xs text-text-secondary mt-1.5">
              {t('addDeviceModal.portDescription', { text: composePortsInfo(portsRJ45, portsSFP, portsSFP28) || t('addDeviceModal.portDescriptionEmpty') })}
            </p>
          </div>

          {/* Device image (设备真机) */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">{t('addDeviceModal.deviceImage')}</label>

            {/* Image preview */}
            <div
              className="w-full h-24 rounded border border-dashed flex items-center justify-center mb-2 overflow-hidden"
              style={{
                borderColor: imagePath ? 'var(--color-device-image-border)' : 'var(--color-border)',
                backgroundColor: 'var(--color-device-image-bg)',
              }}
            >
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt={t('addDeviceModal.deviceImage')}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-text-secondary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span className="text-2xs">{t('addDeviceModal.clickToUpload')}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 px-3 text-xs border border-select-border text-select-border rounded hover:bg-select-bg transition-colors"
                onClick={handlePickImage}
              >
                {imagePath ? t('addDeviceModal.replaceImage') : t('addDeviceModal.selectImage')}
              </button>
              {imagePath && (
                <button
                  type="button"
                  className="text-xs text-danger hover:opacity-70"
                  onClick={() => setImagePath('')}
                >
                  {t('addDeviceModal.removeImage')}
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs text-danger bg-danger-bg px-3 py-2 rounded border border-danger/30">
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
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 h-8 text-xs bg-select-border text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? (device ? t('addDeviceModal.updating') : t('addDeviceModal.creating'))
              : (device ? t('addDeviceModal.updateDevice') : t('addDeviceModal.createDevice'))}
          </button>
        </div>
      </div>
    </div>
  )
}
