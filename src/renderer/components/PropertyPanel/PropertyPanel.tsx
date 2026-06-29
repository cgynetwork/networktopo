import { useState, useEffect, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { DeviceNodeData } from '../nodes/DeviceNode'
import type { EdgeData, PathStyle } from '../../types'
import { getDeviceFromNode, getNodeData } from '../../types'
import { getDefaultPortLabel, listAllPorts } from '../../utils/portParser'

interface PropertyPanelProps {
  selectedNode: Node | null
  selectedEdge: Edge | null
  nodes?: Node[]
  edges?: Edge[]
  onClose: () => void
  onUpdateNodeData?: (nodeId: string, data: Record<string, unknown>) => void
  onUpdateEdgeData?: (edgeId: string, data: Partial<EdgeData>) => void
}

export default function PropertyPanel({
  selectedNode,
  selectedEdge,
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
  const [connType, setConnType] = useState<EdgeData['connectionType']>('ethernet')
  const [animStyle, setAnimStyle] = useState<EdgeData['animationStyle']>('none')
  const [direction, setDirection] = useState<EdgeData['direction']>('forward')
  const [pathStyle, setPathStyle] = useState<PathStyle>('adaptive')
  const [bandwidth, setBandwidth] = useState('')
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
  const [customColor, setCustomColor] = useState('')
  const [elbowOffset, setElbowOffset] = useState(50)

  // Sync local state when selected node changes
  useEffect(() => {
    if (nodeData) {
      setCustomName(nodeData.customName || '')
      setIpAddress((selectedNode?.data?.ipAddress as string) || '')
      setDescription((selectedNode?.data?.description as string) || '')
      setCustomCategory(nodeData.customCategory || '')
      setCustomVendor(nodeData.customVendor || '')
      setCustomDeviceModel(nodeData.customDeviceModel || '')
      setCustomPorts(nodeData.customPorts || '')
      setCustomColor(nodeData.customColor || '')
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

  const handleCustomPortsChange = useCallback(() => {
    if (selectedNode && onUpdateNodeData) {
      onUpdateNodeData(selectedNode.id, { customPorts: customPorts || undefined })
    }
  }, [selectedNode, customPorts, onUpdateNodeData])

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

            {/* 设备端口 */}
            <div>
              <label className="block text-xs text-text-secondary mb-1">设备端口</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-select-border"
                value={customPorts}
                onChange={(e) => setCustomPorts(e.target.value)}
                onBlur={handleCustomPortsChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomPortsChange() }}
                placeholder={nodeData.device.ports_info || '端口信息...'}
              />
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

            {/* Device description from database (read-only reference) */}
            {nodeData.device.description && (
              <div>
                <label className="block text-xs text-text-secondary mb-1">设备说明（数据库）</label>
                <p className="text-xs text-text-secondary bg-hover-bg px-2 py-1.5 rounded leading-relaxed">
                  {nodeData.device.description}
                </p>
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
                  max="250"
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
                  <span>近(10px)</span><span>远(250px)</span>
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
                const portList = listAllPorts(srcPortsInfo)
                if (portList.length === 0) return null
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
                      <option key={p} value={p}>{p}</option>
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
                const portList = listAllPorts(tgtPortsInfo)
                if (portList.length === 0) return null
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
                      <option key={p} value={p}>{p}</option>
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
          </div>
        )}
      </div>
    </div>
  )
}
