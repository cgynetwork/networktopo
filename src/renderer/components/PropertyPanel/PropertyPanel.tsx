import { useState, useEffect, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { DeviceNodeData } from '../nodes/DeviceNode'
import type { EdgeData, PathStyle } from '../../types'
import { getDeviceFromNode, getNodeData } from '../../types'
import { getDefaultPortLabel, listAllPorts, composePortsInfo, parseModularPorts } from '../../utils/portParser'

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
  const [elbowOffset, setElbowOffset] = useState(50)
  // V0.9.0: Device stacking
  const [isStacked, setIsStacked] = useState(false)
  // V0.9.1: Port numbering options
  const [portZeroBased, setPortZeroBased] = useState(false)
  const [portInterleaved, setPortInterleaved] = useState(false)
  // V0.9.3: Business description note
  const [businessNote, setBusinessNote] = useState('')

  // Sync local state when selected node changes
  useEffect(() => {
    if (nodeData) {
      setCustomName(nodeData.customName || '')
      setIpAddress(nodeData.ipAddress || '')
      setDescription(nodeData.description || '')
      setDbDescription(nodeData.device.description || '')
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
        const portsSource = nodeData.customPorts || nodeData.device.ports_info || ''
        const parsed = parseModularPorts(portsSource)
        setCustomPortsRJ45(parsed.rj45)
        setCustomPortsSFP(parsed.sfp)
        setCustomPortsSFP28(parsed.tenG)
      }
      setCustomColor(nodeData.customColor || '')
      setCustomImage(nodeData.customImage || '')
      setIsStacked(nodeData.isStacked ?? false)
      setPortZeroBased(nodeData.portZeroBased ?? false)
      setPortInterleaved(nodeData.portInterleaved ?? false)
      setBusinessNote(nodeData.businessNote || '')
    }
  }, [selectedNode?.id, nodeData]) // eslint-disable-line react-hooks/exhaustive-deps

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
      setStrokeWidth(edgeData.strokeWidth ?? 3.5)
      setStrokeColor(edgeData.strokeColor || '')
      setAnimSpeed(edgeData.animSpeed ?? 2)
      setParticleSize(edgeData.particleSize ?? 4.5)
      setEffectColor(edgeData.effectColor || '#2196F3')
      setElbowOffset(edgeData.elbowOffset ?? 50)
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
            <h3 className="text-sm font-semibold text-text-primary">多选模式</h3>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary text-xs"
              title="关闭面板"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="text-4xl font-bold text-select-border">{selectedCount}</div>
              <p className="text-xs text-text-secondary">个设备已选中</p>
              <div className="border-t border-border pt-3 mt-3">
                <p className="text-2xs text-text-secondary">
                  按 <kbd className="px-1 py-0.5 bg-surface border border-border rounded text-2xs font-mono">Esc</kbd> 取消全部选中
                </p>
                <p className="text-2xs text-text-secondary mt-1.5">
                  使用工具栏对齐 / 分布按钮调整设备布局
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full bg-panel border-l border-border p-4">
        <p className="text-xs text-text-secondary">未选中任何元素</p>
      </div>
    )
  }

  return (
    <div className="h-full bg-panel border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">
          {selectedNode ? '设备属性' : '连线属性'}
        </h3>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-hover-bg transition-colors text-text-secondary text-xs"
          title="关闭面板"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedNode && nodeData && (
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

            {/* 节点底纹颜色 */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">节点颜色</label>
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
                  {customColor ? customColor : '默认（按设备类型）'}
                </span>
                {customColor && (
                  <button
                    className="text-2xs text-danger hover:opacity-70 transition-colors ml-auto"
                    onClick={() => {
                      setCustomColor('')
                      onUpdateNodeData?.(selectedNode.id, { customColor: undefined })
                    }}
                  >
                    重置
                  </button>
                )}
              </div>
            </div>

            {/* 设备功能 */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">设备功能</label>
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

            {/* 设备厂商 */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">设备厂商</label>
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

            {/* 设备名称 */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">设备名称</label>
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

            {/* 设备型号 */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">设备型号</label>
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

            {/* 设备端口 — V0.7.1 modular editing */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🔌 设备端口
              </label>
              <div className="space-y-2">
                {/* 网络端口数量 */}
                <div>
                  <label className="block text-2xs text-text-secondary mb-1">网络端口数量</label>
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
                {/* 千兆光纤端口数量 */}
                <div>
                  <label className="block text-2xs text-text-secondary mb-1">千兆光纤端口数量</label>
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
                {/* 万兆光纤端口数量 */}
                <div>
                  <label className="block text-2xs text-text-secondary mb-1">万兆光纤端口数量</label>
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
                端口描述：{composePortsInfo(customPortsRJ45, customPortsSFP, customPortsSFP28) || '（未设置）'}
              </p>
            </div>

            {/* ── V0.9.0: Device Stacking Toggle ── */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🔗 堆叠模式
              </label>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  启用设备堆叠
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
                  STACK 端口已显示在设备底部，可连接至另一台堆叠设备
                </p>
              )}
            </div>

            {/* ── V0.9.1: Port numbering options ── */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🔢 端口编号规则
              </label>

              {/* 零基编号 toggle */}
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs text-text-secondary">
                  从 GE0 开始编号
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
                  端口将从 GE0、SFP0... 开始编号
                </p>
              )}

              {/* 端口对调 (interleaved) toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  端口对调（列优先交错）
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
                  多行端口按列交错编号，避免上行/下行端口号混淆
                </p>
              )}
            </div>

            {/* 设备真机 — V0.7.0 */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🖼️ 设备真机
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
                    <span className="text-2xs">加载中...</span>
                  </div>
                ) : imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="设备图片预览"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-text-secondary">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <span className="text-2xs">点击上传设备实拍图</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  className="flex-1 h-7 text-xs rounded border border-select-border text-select-border hover:bg-select-bg transition-colors"
                  onClick={handleUploadImage}
                >
                  {customImage ? '更换图片' : '上传图片'}
                </button>
                {customImage && (
                  <button
                    className="h-7 px-3 text-xs rounded border border-danger text-danger hover:bg-danger-bg transition-colors"
                    onClick={handleRemoveImage}
                  >
                    移除
                  </button>
                )}
              </div>
              <p className="text-2xs text-text-secondary mt-1.5">支持 PNG / JPG / WebP 格式</p>
            </div>

            {/* IP Address */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">IP 地址</label>
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
              <label className="block text-xs text-text-secondary mb-1">描述</label>
              <textarea
                className="w-full h-20 px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescChange}
                placeholder="设备描述..."
              />
            </div>

            {/* V0.9.3: Business description note — shown on 3-second device hover */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">业务描述</label>
              <textarea
                className="w-full h-20 px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border resize-none"
                value={businessNote}
                onChange={(e) => setBusinessNote(e.target.value)}
                onBlur={handleBusinessNoteChange}
                placeholder="管理IP、上联接口模式、业务接口规划、下联VLAN信息..."
              />
            </div>

            {/* Device description from database (editable) */}
            {nodeData.device.description !== undefined && (
              <div>
                <label className="block text-xs text-text-secondary mb-1">设备说明（数据库）</label>
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
                  placeholder="数据库中的设备说明..."
                />
              </div>
            )}
          </div>
        )}

        {selectedEdge && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">连接类型</label>
              <select
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={connType}
                onChange={(e) => {
                  const val = e.target.value as EdgeData['connectionType']
                  setConnType(val)
                  onUpdateEdgeData?.(selectedEdge.id, { connectionType: val })
                }}
              >
                <option value="ethernet">网线 (实线)</option>
                <option value="fiber">光纤 (虚线)</option>
                <option value="stack">堆叠线缆 (粗实线)</option>
                <option value="wireless">无线 (信号波)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">连接形式</label>
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
                <option value="adaptive">自适应连接</option>
                <option value="straight">直线连接</option>
                <option value="step">肘形连接线</option>
              </select>
            </div>

            {/* 肘形偏移量 — only visible when pathStyle is step */}
            {pathStyle === 'step' && (
              <div className="mb-3 p-2 bg-select-bg/50 rounded border border-select-border/30">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">肘形高度</label>
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
                  <span>近(10px)</span><span>远(400px)</span>
                </div>
                {elbowOffset !== 50 && (
                  <button
                    className="text-2xs text-select-border hover:opacity-80 transition-colors mt-1"
                    onClick={() => {
                      setElbowOffset(50)
                      onUpdateEdgeData?.(selectedEdge.id, { elbowOffset: undefined })
                    }}
                  >
                    重置为默认值
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs text-text-secondary mb-1">显示状态</label>
              <select
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={animStyle}
                onChange={(e) => {
                  const val = e.target.value as EdgeData['animationStyle']
                  setAnimStyle(val)
                  onUpdateEdgeData?.(selectedEdge.id, { animationStyle: val })
                }}
              >
                <option value="none">静态</option>
                <option value="particle">动态 — 粒子流动</option>
                <option value="glow">动态 — 光带流动</option>
                <option value="wave">动态 — 信号波纹</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">方向</label>
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
                  正向 →
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
                  反向 ←
                </button>
              </div>
            </div>

            {/* ── V0.2.1: 自定义线缆外观 ── */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-primary mb-2">
                🎨 线缆外观
              </label>

              {/* 线缆粗细 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">线缆粗细</label>
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

              {/* 线缆颜色 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">线缆颜色</label>
                  {strokeColor && (
                    <button
                      className="text-2xs text-danger hover:opacity-70 transition-colors"
                      onClick={() => {
                        setStrokeColor('')
                        onUpdateEdgeData?.(selectedEdge.id, { strokeColor: '' })
                      }}
                    >
                      重置
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
                    {strokeColor ? strokeColor : connType === 'fiber' ? '光纤默认 (橙色)' : '网线默认 (黑色)'}
                  </span>
                </div>
              </div>

              {/* 动画速度 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">动画速度</label>
                  <span className={`text-2xs px-1.5 py-0.5 rounded ${
                    animSpeed <= 0.75 ? 'bg-danger-bg text-danger' :
                    animSpeed >= 3 ? 'bg-select-bg text-select-border' :
                    'bg-hover-bg text-text-secondary'
                  }`}>
                    {animSpeed <= 0.75 ? '快速' : animSpeed >= 3 ? '慢速' : '正常'}
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
                  <span>快 ←</span><span>→ 慢</span>
                </div>
              </div>

              {/* 粒子大小 — only when particle animation is active */}
              {animStyle === 'particle' && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-text-secondary">粒子大小</label>
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

              {/* 特效颜色 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-secondary">特效颜色</label>
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
                    默认
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-1" />
            {/* ── 本端端口号 ── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-text-secondary">本端端口号</label>
                <button
                  className="text-2xs text-select-border hover:opacity-80 transition-colors"
                  onClick={handleAutoSourcePort}
                  title="根据设备端口信息自动填充"
                >
                  自动获取
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
                placeholder="如 GE 1"
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
                    <option value="">— 选择端口 —</option>
                    {portList.map((p) => (
                      <option key={p} value={p} disabled={usedSourcePorts.has(p)}>
                        {p}{usedSourcePorts.has(p) ? ' (已使用)' : ''}
                      </option>
                    ))}
                  </select>
                )
              })()}
            </div>
            {/* ── 对端端口号 ── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-text-secondary">对端端口号</label>
                <button
                  className="text-2xs text-select-border hover:opacity-80 transition-colors"
                  onClick={handleAutoTargetPort}
                  title="根据设备端口信息自动填充"
                >
                  自动获取
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
                placeholder="如 25GE 1"
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
                    <option value="">— 选择端口 —</option>
                    {portList.map((p) => (
                      <option key={p} value={p} disabled={usedTargetPorts.has(p)}>
                        {p}{usedTargetPorts.has(p) ? ' (已使用)' : ''}
                      </option>
                    ))}
                  </select>
                )
              })()}
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">带宽</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={bandwidth}
                onChange={(e) => {
                  setBandwidth(e.target.value)
                  onUpdateEdgeData?.(selectedEdge.id, { bandwidth: e.target.value })
                }}
                placeholder="如 10Gbps"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">线缆长度</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={cableLength}
                onChange={(e) => {
                  setCableLength(e.target.value)
                  onUpdateEdgeData?.(selectedEdge.id, { cableLength: e.target.value })
                }}
                placeholder="如 0.3M"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
