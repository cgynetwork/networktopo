import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node, Edge } from '@xyflow/react'
import type { DeviceNodeData } from '../nodes/DeviceNode'
import type { EdgeData, PathStyle, RackNodeData, RackDeviceNodeData, RackViewMode } from '../../types'
import { getDeviceFromNode, getNodeData } from '../../types'
import { getDefaultPortLabel, listAllPorts, composePortsInfo, parseModularPorts } from '../../utils/portParser'
import { getRackNodeWidth, getRackHeight, getOccupiedSlots, U_PX_HEIGHT, RACK_HEADER_H } from '../../utils/rackUtils'

interface PropertyPanelProps {
  selectedNode: Node | null
  selectedEdge: Edge | null
  selectedCount?: number
  nodes?: Node[]
  edges?: Edge[]
  onClose: () => void
  onUpdateNodeData?: (nodeId: string, data: Record<string, unknown>) => void
  onUpdateEdgeData?: (edgeId: string, data: Partial<EdgeData>) => void
}

export default function PropertyPanel({
  selectedNode,
  selectedEdge,
  selectedCount,
  nodes,
  edges,
  onClose,
  onUpdateNodeData,
  onUpdateEdgeData,
}: PropertyPanelProps) {
  const { t } = useTranslation()
  const nodeData = selectedNode?.data as unknown as DeviceNodeData | undefined
  const edgeData = (selectedEdge?.data || {}) as EdgeData
  const [customName, setCustomName] = useState('')
  const [ipAddress, setIpAddress] = useState('')
  const [description, setDescription] = useState('')
  const [dbDescription, setDbDescription] = useState('')
  const [connType, setConnType] = useState<EdgeData['connectionType']>('ethernet')
  const [animStyle, setAnimStyle] = useState<EdgeData['animationStyle']>('none')
  const [direction, setDirection] = useState<EdgeData['direction']>('forward')
  const [pathStyle, setPathStyle] = useState<PathStyle>('adaptive')
  const [bandwidth, setBandwidth] = useState('')
  const [cableLength, setCableLength] = useState('')
  const [sourcePort, setSourcePort] = useState('')
  const [targetPort, setTargetPort] = useState('')
  const [sourceIp, setSourceIp] = useState('')
  const [targetIp, setTargetIp] = useState('')
  const [strokeWidth, setStrokeWidth] = useState(3.5)
  const [strokeColor, setStrokeColor] = useState('')
  const [animSpeed, setAnimSpeed] = useState(2)
  const [particleSize, setParticleSize] = useState(4.5)
  const [effectColor, setEffectColor] = useState('#2196F3')
  const [customCategory, setCustomCategory] = useState('')
  const [customVendor, setCustomVendor] = useState('')
  const [customDeviceModel, setCustomDeviceModel] = useState('')
  const [customPorts, setCustomPorts] = useState('')
  // V0.7.1: Modular port counts
  const [customPortsRJ45, setCustomPortsRJ45] = useState<number>(0)
  const [customPortsSFP, setCustomPortsSFP] = useState<number>(0)
  const [customPortsSFP28, setCustomPortsSFP28] = useState<number>(0)
  const [customColor, setCustomColor] = useState('')
  const [customImage, setCustomImage] = useState('')
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  // V1.5.0: App business images (multi-image)
  const [appImages, setAppImages] = useState<Array<{ id: string; dataUrl: string; offsetX: number; offsetY: number; scale: number }>>([])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [elbowOffset, setElbowOffset] = useState(50)
  const [elbowHorizontalOffset, setElbowHorizontalOffset] = useState(0)
  const [edgeDescription, setEdgeDescription] = useState('')
  // V0.9.0: Device stacking
  const [isStacked, setIsStacked] = useState(false)
  // V1.3.0: Tunnel ports for SDWAN CPE
  const [hasTunnelPorts, setHasTunnelPorts] = useState(false)
  const [tunnelPortCount, setTunnelPortCount] = useState(2)
  // V0.9.1: Port numbering options
  const [portZeroBased, setPortZeroBased] = useState(false)
  const [portInterleaved, setPortInterleaved] = useState(false)
  // V0.9.3: Business description note
  const [businessNote, setBusinessNote] = useState('')

  // ── Node type detection ──────────────────────────────────
  const nodeType = selectedNode?.type as string | undefined
  const isRackNode = nodeType === 'rackNode'
  const isRackDeviceNode = nodeType === 'rackDeviceNode'

  // Extract rack-specific data
  const rackData = isRackNode
    ? (selectedNode!.data as unknown as RackNodeData)
    : undefined
  const rackDeviceData = isRackDeviceNode
    ? (selectedNode!.data as unknown as RackDeviceNodeData)
    : undefined

  // Compute rack statistics
  const rackStats = useMemo(() => {
    if (!isRackNode || !rackData || !nodes) return null
    const childNodes = nodes.filter(n => n.parentId === selectedNode!.id)
    const occupiedSlots = getOccupiedSlots(
      childNodes.map(n => ({
        uPosition: Math.round((n.position.y - RACK_HEADER_H) / U_PX_HEIGHT),
        uHeight: (n.data as unknown as RackDeviceNodeData).uHeight || 1,
      })),
      rackData.accessories || [],
    )
    const totalU = rackData.uHeight
    const occupied = new Array(totalU).fill(false)
    for (const slot of occupiedSlots) {
      for (let i = slot.uPosition; i < slot.uPosition + slot.uHeight && i < totalU; i++) {
        occupied[i] = true
      }
    }
    const usedU = occupied.filter(Boolean).length
    const freeU = totalU - usedU
    return { totalU, usedU, freeU, occupiedSlots }
  }, [isRackNode, rackData, nodes, selectedNode])

  // Sync local state when selected node changes
  useEffect(() => {
    // Skip sync for rack nodes (they don't have device-level fields)
    if (isRackNode) return
    if (nodeData) {
      setCustomName(nodeData.customName || '')
      setIpAddress(nodeData.ipAddress || '')
      setDescription(nodeData.description || '')
      setDbDescription(nodeData.device?.description || '')
      setCustomCategory(nodeData.customCategory || '')
      setCustomVendor(nodeData.customVendor || '')
      setCustomDeviceModel(nodeData.customDeviceModel || '')
      setCustomPorts(nodeData.customPorts || '')
      // V0.7.1: Initialize modular port counts from node data or device template
      if (nodeData.customPortsRJ45 !== undefined || nodeData.customPortsSFP !== undefined || nodeData.customPortsSFP28 !== undefined) {
        setCustomPortsRJ45(nodeData.customPortsRJ45 ?? 0)
        setCustomPortsSFP(nodeData.customPortsSFP ?? 0)
        setCustomPortsSFP28(nodeData.customPortsSFP28 ?? 0)
      } else {
        // Parse from legacy string or device template
        const portsSource = nodeData.customPorts || nodeData.device?.ports_info || ''
        const parsed = parseModularPorts(portsSource)
        setCustomPortsRJ45(parsed.rj45)
        setCustomPortsSFP(parsed.sfp)
        setCustomPortsSFP28(parsed.tenG)
      }
      setCustomColor(nodeData.customColor || '')
      setCustomImage(nodeData.customImage || '')
      setIsStacked(nodeData.isStacked ?? false)
    setHasTunnelPorts(nodeData.hasTunnelPorts ?? false)
      setTunnelPortCount(nodeData.tunnelPortCount || 2)
      setPortZeroBased(nodeData.portZeroBased ?? false)
      setPortInterleaved(nodeData.portInterleaved ?? false)
      setBusinessNote(nodeData.businessNote || '')
      // V1.5.0: App business images (multi-image)
      setAppImages(nodeData.appImages || [])
      setSelectedImageId(null)
    }
  }, [selectedNode?.id, nodeData, isRackNode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local state when selected edge changes
  useEffect(() => {
    if (selectedEdge) {
      setConnType(edgeData.connectionType || 'ethernet')
      setAnimStyle(edgeData.animationStyle || 'none')
      setDirection(edgeData.direction || 'forward')
      setPathStyle(edgeData.pathStyle || 'adaptive')
      setBandwidth(edgeData.bandwidth || '')
      setCableLength(edgeData.cableLength || '')
      setSourcePort(edgeData.sourcePort || '')
      setTargetPort(edgeData.targetPort || '')
      setSourceIp(edgeData.sourceIp || '')
      setTargetIp(edgeData.targetIp || '')
      setStrokeWidth(edgeData.strokeWidth ?? 3.5)
      setStrokeColor(edgeData.strokeColor || '')
      setAnimSpeed(edgeData.animSpeed ?? 2)
      setParticleSize(edgeData.particleSize ?? 4.5)
      setEffectColor(edgeData.effectColor || '#2196F3')
      setElbowOffset(edgeData.elbowOffset ?? 50)
      setElbowHorizontalOffset(edgeData.elbowHorizontalOffset ?? 0)
      setEdgeDescription(edgeData.edgeDescription || '')
    }
  }, [selectedEdge?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load image preview when customImage changes
  useEffect(() => {
    if (customImage) {
      setImageLoading(true)
      window.electronAPI
        .readDeviceImage(customImage)
        .then((result) => {
          if (result.success && result.dataUrl) {
            setImagePreviewUrl(result.dataUrl)
          } else {
            setImagePreviewUrl(null)
          }
        })
        .catch(() => setImagePreviewUrl(null))
        .finally(() => setImageLoading(false))
    } else {
      setImagePreviewUrl(null)
    }
  }, [customImage])

  // ── Device image handlers ─────────────────────────────────
  const handleUploadImage = useCallback(async () => {
    if (!selectedNode) return
    const result = await window.electronAPI.pickDeviceImage()
    if (result.success && result.storedPath) {
      const basename = result.storedPath
      setCustomImage(basename)
      onUpdateNodeData?.(selectedNode.id, { customImage: basename })
    }
  }, [selectedNode, onUpdateNodeData])

  const handleRemoveImage = useCallback(() => {
    if (!selectedNode) return
    setCustomImage('')
    setImagePreviewUrl(null)
    onUpdateNodeData?.(selectedNode.id, { customImage: undefined })
  }, [selectedNode, onUpdateNodeData])

  // V1.5.0: App business images — add / remove / scale
  const handleAddAppImage = useCallback(async () => {
    if (!selectedNode) return
    const result = await window.electronAPI.pickAppImage()
    if (result.success && result.dataUrl) {
      const newItem = {
        id: crypto.randomUUID(),
        dataUrl: result.dataUrl,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      }
      const updated = [...appImages, newItem]
      setAppImages(updated)
      setSelectedImageId(newItem.id)
      onUpdateNodeData?.(selectedNode.id, { appImages: updated })
    }
  }, [selectedNode, appImages, onUpdateNodeData])

  const handleRemoveAppImage = useCallback((imgId: string) => {
    if (!selectedNode) return
    const updated = appImages.filter(img => img.id !== imgId)
    setAppImages(updated)
    if (selectedImageId === imgId) setSelectedImageId(null)
    onUpdateNodeData?.(selectedNode.id, { appImages: updated.length > 0 ? updated : undefined })
  }, [selectedNode, appImages, selectedImageId, onUpdateNodeData])

  const handleUpdateAppImageScale = useCallback((imgId: string, scale: number) => {
    if (!selectedNode) return
    const updated = appImages.map(img => img.id === imgId ? { ...img, scale } : img)
    setAppImages(updated)
    onUpdateNodeData?.(selectedNode.id, { appImages: updated })
  }, [selectedNode, appImages, onUpdateNodeData])

  const handleNameChange = useCallback(() => {
    if (selectedNode && onUpdateNodeData) {
      onUpdateNodeData(selectedNode.id, { customName })
    }
  }, [selectedNode, customName, onUpdateNodeData])

  const handleIpChange = useCallback(() => {
    if (selectedNode && onUpdateNodeData) {
      onUpdateNodeData(selectedNode.id, { ipAddress })
    }
  }, [selectedNode, ipAddress, onUpdateNodeData])

  const handleDescChange = useCallback(() => {
    if (selectedNode && onUpdateNodeData) {
      onUpdateNodeData(selectedNode.id, { description })
    }
  }, [selectedNode, description, onUpdateNodeData])

  // V0.9.3: Business description note
  const handleBusinessNoteChange = useCallback(() => {
    if (selectedNode && onUpdateNodeData) {
      onUpdateNodeData(selectedNode.id, { businessNote: businessNote || undefined })
    }
  }, [selectedNode, businessNote, onUpdateNodeData])

  const handleCustomCategoryChange = useCallback(() => {
    if (selectedNode && onUpdateNodeData) {
      onUpdateNodeData(selectedNode.id, { customCategory: customCategory || undefined })
    }
  }, [selectedNode, customCategory, onUpdateNodeData])

  const handleCustomVendorChange = useCallback(() => {
    if (selectedNode && onUpdateNodeData) {
      onUpdateNodeData(selectedNode.id, { customVendor: customVendor || undefined })
    }
  }, [selectedNode, customVendor, onUpdateNodeData])

  const handleCustomColorChange = useCallback(() => {
    if (selectedNode && onUpdateNodeData) {
      onUpdateNodeData(selectedNode.id, { customColor: customColor || undefined })
    }
  }, [selectedNode, customColor, onUpdateNodeData])

  const handleCustomDeviceModelChange = useCallback(() => {
    if (selectedNode && onUpdateNodeData) {
      onUpdateNodeData(selectedNode.id, { customDeviceModel: customDeviceModel || undefined })
    }
  }, [selectedNode, customDeviceModel, onUpdateNodeData])

  // V0.7.1: Save all three modular port counts atomically
  const handlePortCountsChange = useCallback(() => {
    if (selectedNode && onUpdateNodeData) {
      onUpdateNodeData(selectedNode.id, {
        customPortsRJ45: customPortsRJ45 > 0 ? customPortsRJ45 : undefined,
        customPortsSFP: customPortsSFP > 0 ? customPortsSFP : undefined,
        customPortsSFP28: customPortsSFP28 > 0 ? customPortsSFP28 : undefined,
        // Clear legacy field when modular counts are in use
        customPorts: undefined,
      })
    }
  }, [selectedNode, customPortsRJ45, customPortsSFP, customPortsSFP28, onUpdateNodeData])

  // ── Port auto-assign ──────────────────────────────────────
  const handleAutoSourcePort = useCallback(() => {
    if (!selectedEdge || !nodes) return
    const srcNode = nodes.find(n => n.id === selectedEdge.source)
    const device = getDeviceFromNode(srcNode!)
    if (device?.ports_info) {
      const label = getDefaultPortLabel(device.ports_info)
      setSourcePort(label)
      onUpdateEdgeData?.(selectedEdge.id, { sourcePort: label })
    }
  }, [selectedEdge, nodes, onUpdateEdgeData])

  const handleAutoTargetPort = useCallback(() => {
    if (!selectedEdge || !nodes) return
    const tgtNode = nodes.find(n => n.id === selectedEdge.target)
    const device = getDeviceFromNode(tgtNode!)
    if (device?.ports_info) {
      const label = getDefaultPortLabel(device.ports_info)
      setTargetPort(label)
      onUpdateEdgeData?.(selectedEdge.id, { targetPort: label })
    }
  }, [selectedEdge, nodes, onUpdateEdgeData])

  if (!selectedNode && !selectedEdge) {
    // V0.10.0: Multi-selection overview
    if (selectedCount && selectedCount > 1) {
      return (
        <div className="h-full bg-panel border-l border-border flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">{t('propertyPanel.multiSelect')}</h3>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary text-xs"
              title={t('propertyPanel.closePanel')}
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="text-4xl font-bold text-select-border">{selectedCount}</div>
              <p className="text-xs text-text-secondary">{t('propertyPanel.devicesSelected', { count: selectedCount })}</p>
              <div className="border-t border-border pt-3 mt-3">
                <p className="text-2xs text-text-secondary">
                  {t('propertyPanel.pressEsc')}
                </p>
                <p className="text-2xs text-text-secondary mt-1.5">
                  {t('propertyPanel.alignHint')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full bg-panel border-l border-border p-4">
        <p className="text-xs text-text-secondary">{t('propertyPanel.noSelection')}</p>
      </div>
    )
  }

  return (
    <div className="h-full bg-panel border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">
          {selectedNode ? (isRackNode ? t('propertyPanel.rackProps') : t('propertyPanel.deviceProps')) : t('propertyPanel.edgeProps')}
        </h3>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary text-xs"
          title={t('propertyPanel.closePanel')}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ── Rack Node Properties ────────────────────────── */}
        {selectedNode && isRackNode && rackData && (
          <div className="space-y-4">
            {/* Rack header info */}
            <div className="flex items-center gap-2 p-2 bg-hover-bg rounded">
              <span className="text-lg">🗄️</span>
              <div>
                <div className="text-sm font-semibold text-text-primary">{rackData.label}</div>
                <div className="text-xs text-text-secondary">{t('propertyPanel.rackLabel', { u: rackData.uHeight })}</div>
              </div>
            </div>

            {/* Rack name */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.rackName')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={rackData.label}
                onChange={(e) => {
                  onUpdateNodeData?.(selectedNode.id, { label: e.target.value })
                }}
                placeholder={t('propertyPanel.rackName')}
              />
            </div>

            {/* U statistics */}
            {rackStats && (
              <div>
                <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.uUsage')}</label>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-hover-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-select-border rounded-full transition-all duration-300"
                        style={{ width: `${rackStats.totalU > 0 ? (rackStats.usedU / rackStats.totalU) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-2xs text-text-secondary w-16 text-right">
                      {rackStats.usedU}/{rackStats.totalU}U
                    </span>
                  </div>
                  <div className="flex justify-between text-2xs text-text-secondary">
                    <span>{t('propertyPanel.usedSpace', { u: rackStats.usedU })}</span>
                    <span>{t('propertyPanel.freeSpace', { u: rackStats.freeU })}</span>
                  </div>
                </div>
              </div>
            )}

            {/* V1.1.1: Empty rack hint — show when no devices in rack */}
            {rackStats && rackStats.usedU === 0 && (
              <div className="p-3 bg-select-bg/30 border border-dashed border-select-border rounded text-center space-y-2">
                <div className="text-2xl">📥</div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {t('propertyPanel.dragDeviceHint')}
                </p>
                <p className="text-2xs text-text-secondary">
                  {t('propertyPanel.rightClickHint')}
                </p>
              </div>
            )}

            {/* View mode toggle */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                👁️ {t('propertyPanel.viewMode')}
              </label>
              <div className="flex gap-2">
                <button
                  className={`flex-1 h-8 text-xs rounded border transition-colors ${
                    rackData.viewMode === 'front'
                      ? 'bg-select-bg border-select-border text-select-border font-semibold'
                      : 'border-border bg-surface hover:bg-hover-bg'
                  }`}
                  onClick={() => onUpdateNodeData?.(selectedNode.id, { viewMode: 'front' as RackViewMode })}
                >
                  🔲 {t('propertyPanel.rackFront')}
                </button>
                <button
                  className={`flex-1 h-8 text-xs rounded border transition-colors ${
                    rackData.viewMode === 'back'
                      ? 'bg-select-bg border-select-border text-select-border font-semibold'
                      : 'border-border bg-surface hover:bg-hover-bg'
                  }`}
                  onClick={() => onUpdateNodeData?.(selectedNode.id, { viewMode: 'back' as RackViewMode })}
                >
                  🔌 {t('propertyPanel.rackBack')}
                </button>
              </div>
              <p className="text-2xs text-text-secondary mt-1.5">
                {t('propertyPanel.doubleClickHint')}
              </p>
            </div>

            {/* Rack info */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">📐 {t('propertyPanel.rackInfo')}</label>
              <div className="space-y-1 text-xs text-text-secondary">
                <div className="flex justify-between">
                  <span>{t('propertyPanel.totalHeight')}</span>
                  <span className="font-mono">{rackData.uHeight}U ({rackData.uHeight * U_PX_HEIGHT}px)</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('propertyPanel.frontWidth')}</span>
                  <span className="font-mono">{getRackNodeWidth('front')}px</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('propertyPanel.backWidth')}</span>
                  <span className="font-mono">{getRackNodeWidth('back')}px</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Rack Device Node Properties ──────────────────── */}
        {selectedNode && isRackDeviceNode && rackDeviceData && (
          <div className="space-y-4">
            {/* Vendor info */}
            <div className="flex items-center gap-2 p-2 bg-hover-bg rounded">
              <span className="text-sm font-semibold text-text-primary">
                {rackDeviceData.device.vendor_name}
              </span>
              <span className="text-xs text-text-secondary">
                {rackDeviceData.device.category_name}
              </span>
            </div>

            {/* U Position + U Height summary */}
            <div className="flex gap-2">
              <div className="flex-1 p-2 bg-hover-bg rounded text-center">
                <div className="text-2xs text-text-secondary">{t('propertyPanel.uPosition')}</div>
                <div className="text-sm font-bold text-select-border font-mono">
                  U{rackDeviceData.uPosition ?? '?'}
                </div>
              </div>
              <div className="flex-1 p-2 bg-hover-bg rounded text-center">
                <div className="text-2xs text-text-secondary">{t('propertyPanel.uHeight')}</div>
                <div className="text-sm font-bold text-text-primary font-mono">
                  {rackDeviceData.uHeight || 1}U
                </div>
              </div>
            </div>

            {/* U Height adjustment */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.uHeightLabel')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="1"
                  value={rackDeviceData.uHeight || 1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    onUpdateNodeData?.(selectedNode.id, { uHeight: val })
                  }}
                  className="flex-1 h-1.5 accent-select-border cursor-pointer"
                />
                <span className="text-xs font-mono text-text-primary w-6 text-right">
                  {rackDeviceData.uHeight || 1}U
                </span>
              </div>
            </div>

            {/* Power supply count (V1.1.2) */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🔌 {t('propertyPanel.psuCount')}
              </label>
              <div className="flex items-center gap-2">
                <button
                  className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-primary text-sm"
                  onClick={() => {
                    const current = rackDeviceData.powerSupplyCount ?? 1
                    const next = Math.max(0, current - 1)
                    onUpdateNodeData?.(selectedNode.id, { powerSupplyCount: next })
                  }}
                >
                  −
                </button>
                <input
                  type="number"
                  min="0"
                  max="4"
                  className="flex-1 h-8 px-2 text-xs text-center rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                  value={rackDeviceData.powerSupplyCount ?? 1}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(4, parseInt(e.target.value) || 0))
                    onUpdateNodeData?.(selectedNode.id, { powerSupplyCount: val })
                  }}
                />
                <button
                  className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-primary text-sm"
                  onClick={() => {
                    const current = rackDeviceData.powerSupplyCount ?? 1
                    const next = Math.min(4, current + 1)
                    onUpdateNodeData?.(selectedNode.id, { powerSupplyCount: next })
                  }}
                >
                  +
                </button>
              </div>
              <p className="text-2xs text-text-secondary mt-1.5">
                {t('propertyPanel.psuHint')}
              </p>
            </div>

            {/* Device color */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.nodeColor')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor || '#6B7280'}
                  onChange={(e) => {
                    setCustomColor(e.target.value)
                    onUpdateNodeData?.(selectedNode.id, { customColor: e.target.value })
                  }}
                  className="w-8 h-8 rounded border border-border cursor-pointer p-0.5"
                />
                <span className="text-2xs text-text-secondary">
                  {customColor ? customColor : t('propertyPanel.defaultByType')}
                </span>
                {customColor && (
                  <button
                    className="text-2xs text-danger hover:opacity-70 transition-colors ml-auto"
                    onClick={() => {
                      setCustomColor('')
                      onUpdateNodeData?.(selectedNode.id, { customColor: undefined })
                    }}
                  >
                    {t('propertyPanel.resetColor')}
                  </button>
                )}
              </div>
            </div>

            {/* Device name */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.deviceName')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onBlur={handleNameChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameChange() }}
                placeholder={rackDeviceData.device.model}
              />
            </div>

            {/* Device model */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.deviceModel')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={customDeviceModel}
                onChange={(e) => setCustomDeviceModel(e.target.value)}
                onBlur={handleCustomDeviceModelChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomDeviceModelChange() }}
                placeholder={`${rackDeviceData.device.vendor_name} ${rackDeviceData.device.model}`}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.description')}</label>
              <textarea
                className="w-full h-20 px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescChange}
                placeholder={t('propertyPanel.descriptionPlaceholder')}
              />
            </div>
          </div>
        )}

        {/* ── Standard Device Node Properties ──────────────── */}
        {selectedNode && !isRackNode && !isRackDeviceNode && nodeData && (
          <div className="space-y-4">
            {/* Vendor info */}
            <div className="flex items-center gap-2 p-2 bg-hover-bg rounded">
              <span className="text-sm font-semibold text-text-primary">
                {nodeData.device.vendor_name}
              </span>
              <span className="text-xs text-text-secondary">
                {nodeData.device.category_name}
              </span>
            </div>

            {/* Node color */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.nodeColor')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor || '#6B7280'}
                  onChange={(e) => {
                    setCustomColor(e.target.value)
                    onUpdateNodeData?.(selectedNode.id, { customColor: e.target.value })
                  }}
                  className="w-8 h-8 rounded border border-border cursor-pointer p-0.5"
                />
                <span className="text-2xs text-text-secondary">
                  {customColor ? customColor : t('propertyPanel.defaultByType')}
                </span>
                {customColor && (
                  <button
                    className="text-2xs text-danger hover:opacity-70 transition-colors ml-auto"
                    onClick={() => {
                      setCustomColor('')
                      onUpdateNodeData?.(selectedNode.id, { customColor: undefined })
                    }}
                  >
                    {t('propertyPanel.resetColor')}
                  </button>
                )}
              </div>
            </div>

            {/* Device function */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.deviceFunction')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                onBlur={handleCustomCategoryChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomCategoryChange() }}
                placeholder={nodeData.device.category_name}
              />
            </div>

            {/* Device vendor */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.deviceVendor')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={customVendor}
                onChange={(e) => setCustomVendor(e.target.value)}
                onBlur={handleCustomVendorChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomVendorChange() }}
                placeholder={nodeData.device.vendor_name}
              />
            </div>

            {/* Device name */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.deviceName')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onBlur={handleNameChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameChange() }}
                placeholder={nodeData.device.model}
              />
            </div>

            {/* Device model */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.deviceModel')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={customDeviceModel}
                onChange={(e) => setCustomDeviceModel(e.target.value)}
                onBlur={handleCustomDeviceModelChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomDeviceModelChange() }}
                placeholder={`${nodeData.device.vendor_name} ${nodeData.device.model}`}
              />
            </div>

            {/* Device ports — V0.7.1 modular editing */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🔌 {t('propertyPanel.devicePorts')}
              </label>
              <div className="space-y-2">
                {/* Network port count */}
                <div>
                  <label className="block text-2xs text-text-secondary mb-1">{t('propertyPanel.networkPortCount')}</label>
                  <input
                    type="number"
                    min="0"
                    max="256"
                    className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                    value={customPortsRJ45}
                    onChange={(e) => setCustomPortsRJ45(Math.max(0, parseInt(e.target.value) || 0))}
                    onBlur={handlePortCountsChange}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePortCountsChange() }}
                  />
                </div>
                {/* Gigabit fiber port count */}
                <div>
                  <label className="block text-2xs text-text-secondary mb-1">{t('propertyPanel.gigabitFiberCount')}</label>
                  <input
                    type="number"
                    min="0"
                    max="256"
                    className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                    value={customPortsSFP}
                    onChange={(e) => setCustomPortsSFP(Math.max(0, parseInt(e.target.value) || 0))}
                    onBlur={handlePortCountsChange}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePortCountsChange() }}
                  />
                </div>
                {/* 10G fiber port count */}
                <div>
                  <label className="block text-2xs text-text-secondary mb-1">{t('propertyPanel.tenGigabitFiberCount')}</label>
                  <input
                    type="number"
                    min="0"
                    max="256"
                    className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                    value={customPortsSFP28}
                    onChange={(e) => setCustomPortsSFP28(Math.max(0, parseInt(e.target.value) || 0))}
                    onBlur={handlePortCountsChange}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePortCountsChange() }}
                  />
                </div>
              </div>
              {/* Live preview of composed ports_info */}
              <p className="text-2xs text-text-secondary mt-1.5">
                {t('propertyPanel.portDescriptionLabel', { text: composePortsInfo(customPortsRJ45, customPortsSFP, customPortsSFP28) || t('propertyPanel.portDescriptionNone') })}
              </p>
            </div>

            {/* ── V0.9.0: Device Stacking Toggle ── */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🔗 {t('propertyPanel.stackMode')}
              </label>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  {t('propertyPanel.enableStack')}
                </span>
                <button
                  type="button"
                  className={`w-10 h-5 rounded-full transition-colors relative overflow-hidden ${
                    isStacked
                      ? 'bg-select-border'
                      : ''
                  }`}
                  style={isStacked ? {} : { backgroundColor: 'var(--color-device-body-stroke)' }}
                  onClick={() => {
                    const newVal = !isStacked
                    setIsStacked(newVal)
                    onUpdateNodeData?.(selectedNode!.id, { isStacked: newVal || undefined })
                  }}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      isStacked ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              {isStacked && (
                <p className="text-2xs text-text-secondary mt-1.5">
                  {t('propertyPanel.stackHint')}
                </p>
              )}
            </div>

            {/* ── V1.3.0: Tunnel Ports Toggle (SDWAN CPE only) ── */}
            {nodeData?.device?.category_name === 'SDWAN' && nodeData?.device?.ports_info && (
              <div className="border-t border-border pt-3">
                <label className="block text-xs font-semibold text-text-primary mb-2">
                  🔷 {t('propertyPanel.tunnelPorts')}
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    {t('propertyPanel.enableTunnel')}
                  </span>
                  <button
                    type="button"
                    className={`w-10 h-5 rounded-full transition-colors relative overflow-hidden ${
                      hasTunnelPorts
                        ? 'bg-select-border'
                        : ''
                    }`}
                    style={hasTunnelPorts ? {} : { backgroundColor: 'var(--color-device-body-stroke)' }}
                    onClick={() => {
                      const newVal = !hasTunnelPorts
                      setHasTunnelPorts(newVal)
                      onUpdateNodeData?.(selectedNode!.id, { hasTunnelPorts: newVal || undefined })
                    }}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        hasTunnelPorts ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                {hasTunnelPorts && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="block text-2xs text-text-secondary mb-1">{t('propertyPanel.tunnelPortCount')}</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-primary text-xs"
                          onClick={() => {
                            const next = Math.max(1, tunnelPortCount - 1)
                            setTunnelPortCount(next)
                            onUpdateNodeData?.(selectedNode!.id, { tunnelPortCount: next })
                          }}
                        >−</button>
                        <input
                          type="number"
                          min="1"
                          max="8"
                          className="flex-1 h-7 px-2 text-xs text-center rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                          value={tunnelPortCount}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(8, parseInt(e.target.value) || 2))
                            setTunnelPortCount(val)
                            onUpdateNodeData?.(selectedNode!.id, { tunnelPortCount: val })
                          }}
                        />
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-hover-bg transition-colors text-text-primary text-xs"
                          onClick={() => {
                            const next = Math.min(8, tunnelPortCount + 1)
                            setTunnelPortCount(next)
                            onUpdateNodeData?.(selectedNode!.id, { tunnelPortCount: next })
                          }}
                        >+</button>
                      </div>
                    </div>
                    <p className="text-2xs text-text-secondary">
                      {t('propertyPanel.tunnelPortHint', { count: tunnelPortCount })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── V0.9.1: Port numbering options ── */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🔢 {t('propertyPanel.portNumbering')}
              </label>

              {/* Zero-based toggle */}
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs text-text-secondary">
                  {t('propertyPanel.startFromGE0')}
                </span>
                <button
                  type="button"
                  className={`w-10 h-5 rounded-full transition-colors relative overflow-hidden ${
                    portZeroBased
                      ? 'bg-select-border'
                      : ''
                  }`}
                  style={portZeroBased ? {} : { backgroundColor: 'var(--color-device-body-stroke)' }}
                  onClick={() => {
                    const newVal = !portZeroBased
                    setPortZeroBased(newVal)
                    onUpdateNodeData?.(selectedNode!.id, { portZeroBased: newVal || undefined })
                  }}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      portZeroBased ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              {portZeroBased && (
                <p className="text-2xs text-text-secondary -mt-1.5 mb-2">
                  {t('propertyPanel.portNumberingHint')}
                </p>
              )}

              {/* Port interleave toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  {t('propertyPanel.portInterleave')}
                </span>
                <button
                  type="button"
                  className={`w-10 h-5 rounded-full transition-colors relative overflow-hidden ${
                    portInterleaved
                      ? 'bg-select-border'
                      : ''
                  }`}
                  style={portInterleaved ? {} : { backgroundColor: 'var(--color-device-body-stroke)' }}
                  onClick={() => {
                    const newVal = !portInterleaved
                    setPortInterleaved(newVal)
                    onUpdateNodeData?.(selectedNode!.id, { portInterleaved: newVal || undefined })
                  }}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      portInterleaved ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              {portInterleaved && (
                <p className="text-2xs text-text-secondary mt-1.5">
                  {t('propertyPanel.portInterleaveHint')}
                </p>
              )}
            </div>

            {/* Device photo — V0.7.0 */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🖼️ {t('propertyPanel.devicePhoto')}
              </label>

              {/* Image preview */}
              <div
                className="w-full h-24 rounded border border-dashed flex items-center justify-center mb-2 overflow-hidden"
                style={{
                  borderColor: customImage ? 'var(--color-device-image-border)' : 'var(--color-border)',
                  backgroundColor: 'var(--color-device-image-bg)',
                }}
              >
                {imageLoading ? (
                  <div className="flex flex-col items-center gap-1 text-text-secondary">
                    <div className="w-5 h-5 border-2 border-select-border border-t-transparent rounded-full animate-spin" />
                    <span className="text-2xs">{t('propertyPanel.photoLoading')}</span>
                  </div>
                ) : imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt={t('propertyPanel.photoPreviewAlt')}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-text-secondary">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <span className="text-2xs">{t('propertyPanel.photoClickToUpload')}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  className="flex-1 h-7 text-xs rounded border border-select-border text-select-border hover:bg-select-bg transition-colors"
                  onClick={handleUploadImage}
                >
                  {customImage ? t('propertyPanel.changePhoto') : t('propertyPanel.uploadPhoto')}
                </button>
                {customImage && (
                  <button
                    className="h-7 px-3 text-xs rounded border border-danger text-danger hover:bg-danger-bg transition-colors"
                    onClick={handleRemoveImage}
                  >
                    {t('propertyPanel.removePhoto')}
                  </button>
                )}
              </div>
              <p className="text-2xs text-text-secondary mt-1.5">{t('propertyPanel.photoFormatHint')}</p>
            </div>

            {/* V1.5.0: App business images — only for 互联网应用 device */}
            {nodeData?.device?.model === '互联网应用' && (
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🖼️ {t('propertyPanel.businessImages')}
                {appImages.length > 0 && (
                  <span className="ml-1 text-2xs text-text-secondary font-normal">
                    {t('propertyPanel.businessImagesCount', { count: appImages.length })}
                  </span>
                )}
              </label>

              {/* Thumbnail grid */}
              {appImages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {appImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className={`relative w-[50px] h-[50px] rounded border-2 cursor-pointer overflow-hidden flex-shrink-0 ${
                        selectedImageId === img.id
                          ? 'border-select-border'
                          : 'border-border hover:border-select-border/50'
                      }`}
                      style={{ backgroundColor: 'var(--color-device-image-bg)' }}
                      onClick={() => setSelectedImageId(selectedImageId === img.id ? null : img.id)}
                      title={t('propertyPanel.businessImageLabel', { n: idx + 1 })}
                    >
                      <img
                        src={img.dataUrl}
                        alt={t('propertyPanel.businessImageLabel', { n: idx + 1 })}
                        className="w-full h-full object-contain"
                      />
                      {/* Remove button */}
                      <button
                        className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-bl text-2xs leading-none text-white bg-danger/80 hover:bg-danger transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveAppImage(img.id)
                        }}
                        title={t('propertyPanel.removePhoto')}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add image button */}
              <button
                className="w-full h-7 text-xs rounded border border-dashed border-select-border/50 text-select-border hover:bg-select-bg transition-colors mb-2"
                onClick={handleAddAppImage}
              >
                {t('propertyPanel.addImage')}
              </button>

              {/* Selected image scale control */}
              {selectedImageId && (() => {
                const selectedImg = appImages.find(img => img.id === selectedImageId)
                if (!selectedImg) return null
                const imgIdx = appImages.findIndex(img => img.id === selectedImageId) + 1
                return (
                  <div className="p-2 bg-hover-bg rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">{t('propertyPanel.businessImageLabel', { n: imgIdx })}</span>
                      <button
                        className="text-2xs text-danger hover:opacity-70 transition-colors"
                        onClick={() => handleRemoveAppImage(selectedImageId)}
                      >
                        {t('propertyPanel.removePhoto')}
                      </button>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-2xs text-text-secondary">{t('propertyPanel.zoom')}</label>
                        <span className="text-2xs text-select-border font-mono">
                          {Math.round(selectedImg.scale * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="300"
                        step="5"
                        value={Math.round(selectedImg.scale * 100)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) / 100
                          handleUpdateAppImageScale(selectedImageId, val)
                        }}
                        className="w-full h-1.5 accent-select-border cursor-pointer"
                      />
                      <div className="flex justify-between text-2xs text-text-secondary mt-0.5">
                        <span>15%</span><span>300%</span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <p className="text-2xs text-text-secondary mt-1.5">{t('propertyPanel.imageFormatHint')}</p>
            </div>
            )}

            {/* IP Address */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.ipAddress')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                onBlur={handleIpChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleIpChange() }}
                placeholder="192.168.1.1"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.description')}</label>
              <textarea
                className="w-full h-20 px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescChange}
                placeholder={t('propertyPanel.descriptionPlaceholder')}
              />
            </div>

            {/* V0.9.3: Business description note — shown on 3-second device hover */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.businessDescription')}</label>
              <textarea
                className="w-full h-20 px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border resize-none"
                value={businessNote}
                onChange={(e) => setBusinessNote(e.target.value)}
                onBlur={handleBusinessNoteChange}
                placeholder={t('propertyPanel.businessDescriptionPlaceholder')}
              />
            </div>

            {/* Device description from database (editable) */}
            {nodeData.device.description !== undefined && (
              <div>
                <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.dbDescription')}</label>
                <textarea
                  className="w-full h-20 px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border resize-none"
                  value={dbDescription}
                  onChange={(e) => setDbDescription(e.target.value)}
                  onBlur={() => {
                    if (dbDescription !== nodeData.device.description) {
                      const updatedDevice = { ...nodeData.device, description: dbDescription }
                      onUpdateNodeData?.(selectedNode!.id, { device: updatedDevice })
                      window.electronAPI.updateDeviceDescription(nodeData.device.id, dbDescription).catch(console.error)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      ;(e.target as HTMLTextAreaElement).blur()
                    }
                  }}
                  placeholder={t('propertyPanel.dbDescriptionPlaceholder')}
                />
              </div>
            )}
          </div>
        )}

        {selectedEdge && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.connectionType')}</label>
              <select
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={connType}
                onChange={(e) => {
                  const val = e.target.value as EdgeData['connectionType']
                  setConnType(val)
                  onUpdateEdgeData?.(selectedEdge.id, { connectionType: val })
                }}
              >
                <option value="ethernet">{t('propertyPanel.connEthernet')}</option>
                <option value="fiber">{t('propertyPanel.connFiber')}</option>
                <option value="stack">{t('propertyPanel.connStack')}</option>
                <option value="tunnel">{t('propertyPanel.connTunnel')}</option>
                <option value="wireless">{t('propertyPanel.connWireless')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.connectionForm')}</label>
              <select
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={pathStyle}
                onChange={(e) => {
                  const val = e.target.value as PathStyle
                  setPathStyle(val)
                  // Auto-compute unique elbow offset when switching to step
                  if (val === 'step' && edges) {
                    const existingOffsets = edges
                      .filter(
                        (ed) =>
                          ed.id !== selectedEdge.id &&
                          ed.type === 'animated' &&
                          (ed.data as EdgeData)?.pathStyle === 'step' &&
                          ((ed.source === selectedEdge.source && ed.target === selectedEdge.target) ||
                           (ed.source === selectedEdge.target && ed.target === selectedEdge.source)),
                      )
                      .map((ed) => ((ed.data as EdgeData)?.elbowOffset ?? 50))
                    // Assign offset spaced 30px apart from existing ones
                    let autoOffset = 50
                    while (existingOffsets.some((off) => Math.abs(off - autoOffset) < 25)) {
                      autoOffset += 30
                    }
                    setElbowOffset(autoOffset)
                    onUpdateEdgeData?.(selectedEdge.id, { pathStyle: val, elbowOffset: autoOffset })
                  } else {
                    onUpdateEdgeData?.(selectedEdge.id, { pathStyle: val })
                  }
                }}
              >
                <option value="adaptive">{t('propertyPanel.pathAdaptive')}</option>
                <option value="straight">{t('propertyPanel.pathStraight')}</option>
                <option value="step">{t('propertyPanel.pathStep')}</option>
              </select>
            </div>

            {/* Elbow offset — only visible when pathStyle is step */}
            {pathStyle === 'step' && (
              <div className="mb-3 p-2 bg-select-bg/50 rounded border border-select-border/30">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">{t('propertyPanel.elbowHeight')}</label>
                  <span className="text-2xs text-select-border bg-select-bg px-1.5 py-0.5 rounded font-mono">{elbowOffset}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="400"
                  step="5"
                  value={elbowOffset}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setElbowOffset(val)
                    onUpdateEdgeData?.(selectedEdge.id, { elbowOffset: val })
                  }}
                  className="w-full h-1.5 accent-select-border cursor-pointer"
                />
                <div className="flex justify-between text-2xs text-text-secondary mt-0.5">
                  <span>{t('propertyPanel.elbowNear')}</span><span>{t('propertyPanel.elbowFar')}</span>
                </div>
                {elbowOffset !== 50 && (
                  <button
                    className="text-2xs text-select-border hover:opacity-80 transition-colors mt-1"
                    onClick={() => {
                      setElbowOffset(50)
                      onUpdateEdgeData?.(selectedEdge.id, { elbowOffset: undefined })
                    }}
                  >
                    {t('propertyPanel.resetToDefault')}
                  </button>
                )}
              </div>
            )}

            {/* Elbow horizontal offset — only visible when pathStyle is step */}
            {pathStyle === 'step' && (
              <div className="mb-3 p-2 bg-select-bg/50 rounded border border-select-border/30">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">{t('propertyPanel.elbowSide')}</label>
                  <span className="text-2xs text-select-border bg-select-bg px-1.5 py-0.5 rounded font-mono">
                    {elbowHorizontalOffset > 0 ? `→ ${elbowHorizontalOffset}px` : elbowHorizontalOffset < 0 ? `← ${Math.abs(elbowHorizontalOffset)}px` : t('propertyPanel.centered')}
                  </span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  step="5"
                  value={elbowHorizontalOffset}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setElbowHorizontalOffset(val)
                    onUpdateEdgeData?.(selectedEdge.id, { elbowHorizontalOffset: val === 0 ? undefined : val })
                  }}
                  className="w-full h-1.5 accent-select-border cursor-pointer"
                />
                <div className="flex justify-between text-2xs text-text-secondary mt-0.5">
                  <span>{t('propertyPanel.elbowLeft')}</span><span>{t('propertyPanel.elbowRight')}</span>
                </div>
                {elbowHorizontalOffset !== 0 && (
                  <button
                    className="text-2xs text-select-border hover:opacity-80 transition-colors mt-1"
                    onClick={() => {
                      setElbowHorizontalOffset(0)
                      onUpdateEdgeData?.(selectedEdge.id, { elbowHorizontalOffset: undefined })
                    }}
                  >
                    {t('propertyPanel.resetToCenter')}
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.displayState')}</label>
              <select
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={animStyle}
                onChange={(e) => {
                  const val = e.target.value as EdgeData['animationStyle']
                  setAnimStyle(val)
                  onUpdateEdgeData?.(selectedEdge.id, { animationStyle: val })
                }}
              >
                <option value="none">{t('propertyPanel.animStatic')}</option>
                <option value="particle">{t('propertyPanel.animParticle')}</option>
                <option value="glow">{t('propertyPanel.animGlow')}</option>
                <option value="wave">{t('propertyPanel.animWave')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.direction')}</label>
              <div className="flex gap-2">
                <button
                  className={`flex-1 h-8 text-xs rounded border transition-colors ${
                    direction === 'forward'
                      ? 'bg-select-bg border-select-border text-select-border font-semibold'
                      : 'border-border bg-surface hover:bg-hover-bg'
                  }`}
                  onClick={() => {
                    setDirection('forward')
                    onUpdateEdgeData?.(selectedEdge.id, { direction: 'forward' })
                  }}
                >
                  {t('propertyPanel.dirForward')}
                </button>
                <button
                  className={`flex-1 h-8 text-xs rounded border transition-colors ${
                    direction === 'reverse'
                      ? 'bg-select-bg border-select-border text-select-border font-semibold'
                      : 'border-border bg-surface hover:bg-hover-bg'
                  }`}
                  onClick={() => {
                    setDirection('reverse')
                    onUpdateEdgeData?.(selectedEdge.id, { direction: 'reverse' })
                  }}
                >
                  {t('propertyPanel.dirBackward')}
                </button>
              </div>
            </div>

            {/* ── V0.2.1: Cable appearance ── */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🎨 {t('propertyPanel.cableAppearance')}
              </label>

              {/* Stroke width */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">{t('propertyPanel.cableThickness')}</label>
                  <span className="text-2xs text-text-secondary bg-hover-bg px-1.5 py-0.5 rounded">{strokeWidth.toFixed(1)}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={strokeWidth}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    setStrokeWidth(val)
                    onUpdateEdgeData?.(selectedEdge.id, { strokeWidth: val })
                  }}
                  className="w-full h-1.5 accent-select-border cursor-pointer"
                />
                <div className="flex justify-between text-2xs text-text-secondary mt-0.5">
                  <span>1px</span><span>10px</span>
                </div>
              </div>

              {/* Stroke color */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">{t('propertyPanel.cableColor')}</label>
                  {strokeColor && (
                    <button
                      className="text-2xs text-danger hover:opacity-70 transition-colors"
                      onClick={() => {
                        setStrokeColor('')
                        onUpdateEdgeData?.(selectedEdge.id, { strokeColor: '' })
                      }}
                    >
                      {t('propertyPanel.resetColor')}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={strokeColor || (connType === 'fiber' ? '#F59E0B' : '#1A1A1A')}
                    onChange={(e) => {
                      setStrokeColor(e.target.value)
                      onUpdateEdgeData?.(selectedEdge.id, { strokeColor: e.target.value })
                    }}
                    className="w-8 h-8 rounded border border-border cursor-pointer p-0.5"
                  />
                  <span className="text-2xs text-text-secondary">
                    {strokeColor ? strokeColor : connType === 'fiber' ? t('propertyPanel.fiberDefault') : t('propertyPanel.ethernetDefault')}
                  </span>
                </div>
              </div>

              {/* Animation speed */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">{t('propertyPanel.animationSpeed')}</label>
                  <span className={`text-2xs px-1.5 py-0.5 rounded ${
                    animSpeed <= 0.75 ? 'bg-danger-bg text-danger' :
                    animSpeed >= 3 ? 'bg-select-bg text-select-border' :
                    'bg-hover-bg text-text-secondary'
                  }`}>
                    {animSpeed <= 0.75 ? t('propertyPanel.fast') : animSpeed >= 3 ? t('propertyPanel.slow') : t('propertyPanel.normal')}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.25"
                  value={animSpeed}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    setAnimSpeed(val)
                    onUpdateEdgeData?.(selectedEdge.id, { animSpeed: val })
                  }}
                  className="w-full h-1.5 accent-select-border cursor-pointer"
                />
                <div className="flex justify-between text-2xs text-text-secondary mt-0.5">
                  <span>{t('propertyPanel.fastLeft')}</span><span>{t('propertyPanel.slowRight')}</span>
                </div>
              </div>

              {/* Particle size — only when particle animation is active */}
              {animStyle === 'particle' && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-text-secondary">{t('propertyPanel.particleSize')}</label>
                    <span className="text-2xs text-text-secondary bg-hover-bg px-1.5 py-0.5 rounded">{particleSize.toFixed(1)}px</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="12"
                    step="0.5"
                    value={particleSize}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      setParticleSize(val)
                      onUpdateEdgeData?.(selectedEdge.id, { particleSize: val })
                    }}
                    className="w-full h-1.5 accent-select-border cursor-pointer"
                  />
                  <div className="flex justify-between text-2xs text-text-secondary mt-0.5">
                    <span>2px</span><span>12px</span>
                  </div>
                </div>
              )}

              {/* Effect color */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">{t('propertyPanel.effectColor')}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={effectColor}
                    onChange={(e) => {
                      setEffectColor(e.target.value)
                      onUpdateEdgeData?.(selectedEdge.id, { effectColor: e.target.value })
                    }}
                    className="w-8 h-8 rounded border border-border cursor-pointer p-0.5"
                  />
                  <span className="text-2xs text-text-secondary">
                    {effectColor}
                  </span>
                  <button
                    className="text-2xs text-select-border hover:opacity-80 transition-colors ml-auto"
                    onClick={() => {
                      setEffectColor('#2196F3')
                      onUpdateEdgeData?.(selectedEdge.id, { effectColor: '#2196F3' })
                    }}
                  >
                    {t('propertyPanel.default')}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-1" />
            {/* ── Source port ── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-text-secondary">{t('propertyPanel.localPort')}</label>
                <button
                  className="text-2xs text-select-border hover:opacity-80 transition-colors"
                  onClick={handleAutoSourcePort}
                  title={t('propertyPanel.autoFillHint')}
                >
                  {t('propertyPanel.autoDetect')}
                </button>
              </div>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={sourcePort}
                onChange={(e) => {
                  setSourcePort(e.target.value)
                  onUpdateEdgeData?.(selectedEdge.id, { sourcePort: e.target.value })
                }}
                placeholder={t('propertyPanel.localPortPlaceholder')}
              />
              {/* Port selector dropdown — lists all individual ports from the device */}
              {nodes && selectedEdge && (() => {
                const srcNode = nodes.find(n => n.id === selectedEdge.source)
                const srcDevice = getDeviceFromNode(srcNode!)
                const srcPortsInfo = getNodeData(srcNode!)?.customPorts || srcDevice?.ports_info || ''
                const srcNodeData = getNodeData(srcNode!)
                const portList = listAllPorts(srcPortsInfo, {
                  zeroBased: srcNodeData?.portZeroBased,
                  interleaved: srcNodeData?.portInterleaved,
                })
                if (portList.length === 0) return null
                // V0.8.0: Mark ports already used by other edges on this node as unavailable
                const usedSourcePorts = new Set(
                  edges?.filter(e => e.id !== selectedEdge!.id && e.source === selectedEdge!.source)
                    .map(e => (e.data as EdgeData | undefined)?.sourcePort)
                    .filter(Boolean) ?? []
                )
                return (
                  <select
                    className="w-full h-7 px-1.5 mt-1 text-2xs rounded border border-border bg-surface text-text-secondary focus:outline-none focus:border-select-border"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return
                      setSourcePort(e.target.value)
                      onUpdateEdgeData?.(selectedEdge!.id, { sourcePort: e.target.value })
                    }}
                  >
                    <option value="">{t('propertyPanel.selectPort')}</option>
                    {portList.map((p) => (
                      <option key={p} value={p} disabled={usedSourcePorts.has(p)}>
                        {p}{usedSourcePorts.has(p) ? t('propertyPanel.portUsed') : ''}
                      </option>
                    ))}
                  </select>
                )
              })()}
            </div>
            {/* ── Target port ── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-text-secondary">{t('propertyPanel.remotePort')}</label>
                <button
                  className="text-2xs text-select-border hover:opacity-80 transition-colors"
                  onClick={handleAutoTargetPort}
                  title={t('propertyPanel.autoFillHint')}
                >
                  {t('propertyPanel.autoDetect')}
                </button>
              </div>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={targetPort}
                onChange={(e) => {
                  setTargetPort(e.target.value)
                  onUpdateEdgeData?.(selectedEdge.id, { targetPort: e.target.value })
                }}
                placeholder={t('propertyPanel.remotePortPlaceholder')}
              />
              {/* Port selector dropdown — lists all individual ports from the device */}
              {nodes && selectedEdge && (() => {
                const tgtNode = nodes.find(n => n.id === selectedEdge.target)
                const tgtDevice = getDeviceFromNode(tgtNode!)
                const tgtPortsInfo = getNodeData(tgtNode!)?.customPorts || tgtDevice?.ports_info || ''
                const tgtNodeData = getNodeData(tgtNode!)
                const portList = listAllPorts(tgtPortsInfo, {
                  zeroBased: tgtNodeData?.portZeroBased,
                  interleaved: tgtNodeData?.portInterleaved,
                })
                if (portList.length === 0) return null
                // V0.8.0: Mark ports already used by other edges on this node as unavailable
                const usedTargetPorts = new Set(
                  edges?.filter(e => e.id !== selectedEdge!.id && e.target === selectedEdge!.target)
                    .map(e => (e.data as EdgeData | undefined)?.targetPort)
                    .filter(Boolean) ?? []
                )
                return (
                  <select
                    className="w-full h-7 px-1.5 mt-1 text-2xs rounded border border-border bg-surface text-text-secondary focus:outline-none focus:border-select-border"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return
                      setTargetPort(e.target.value)
                      onUpdateEdgeData?.(selectedEdge!.id, { targetPort: e.target.value })
                    }}
                  >
                    <option value="">{t('propertyPanel.selectPort')}</option>
                    {portList.map((p) => (
                      <option key={p} value={p} disabled={usedTargetPorts.has(p)}>
                        {p}{usedTargetPorts.has(p) ? t('propertyPanel.portUsed') : ''}
                      </option>
                    ))}
                  </select>
                )
              })()}
            </div>
            {/* ── V1.5.1: Interface IP ── */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🌐 {t('propertyPanel.interfaceIP')}
              </label>
              <div className="space-y-2">
                <div>
                  <label className="block text-2xs text-text-secondary mb-1">{t('propertyPanel.localIP')}</label>
                  <input
                    type="text"
                    className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                    value={sourceIp}
                    onChange={(e) => {
                      setSourceIp(e.target.value)
                      onUpdateEdgeData?.(selectedEdge.id, { sourceIp: e.target.value || undefined })
                    }}
                    placeholder={t('propertyPanel.ipPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-2xs text-text-secondary mb-1">{t('propertyPanel.remoteIP')}</label>
                  <input
                    type="text"
                    className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                    value={targetIp}
                    onChange={(e) => {
                      setTargetIp(e.target.value)
                      onUpdateEdgeData?.(selectedEdge.id, { targetIp: e.target.value || undefined })
                    }}
                    placeholder={t('propertyPanel.ipPlaceholder')}
                  />
                </div>
              </div>
              <p className="text-2xs text-text-secondary mt-1.5">{t('propertyPanel.ipHint')}</p>
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.bandwidth')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={bandwidth}
                onChange={(e) => {
                  setBandwidth(e.target.value)
                  onUpdateEdgeData?.(selectedEdge.id, { bandwidth: e.target.value })
                }}
                placeholder={t('propertyPanel.bandwidthPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">{t('propertyPanel.cableLength')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={cableLength}
                onChange={(e) => {
                  setCableLength(e.target.value)
                  onUpdateEdgeData?.(selectedEdge.id, { cableLength: e.target.value })
                }}
                placeholder={t('propertyPanel.cableLengthPlaceholder')}
              />
            </div>

            {/* ── Cable description ── */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                📝 {t('propertyPanel.cableDescription')}
              </label>
              <textarea
                className="w-full h-24 px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border resize-none"
                value={edgeDescription}
                onChange={(e) => setEdgeDescription(e.target.value)}
                onBlur={() => {
                  onUpdateEdgeData?.(selectedEdge.id, { edgeDescription: edgeDescription || undefined })
                }}
                placeholder={t('propertyPanel.cableDescriptionPlaceholder')}
              />
              <p className="text-2xs text-text-secondary mt-1.5">
                {t('propertyPanel.cableDescriptionHint')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
