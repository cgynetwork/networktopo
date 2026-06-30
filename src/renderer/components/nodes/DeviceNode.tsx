import { memo, useLayoutEffect, useRef, useState } from 'react'
import { NodeResizer, useReactFlow, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import type { DeviceRow, EdgeData } from '../../types'
import { parsePortsInfo, getPortLayout, composePortsInfo, countLayoutRows } from '../../utils/portParser'
import InlineEdit from './InlineEdit'
import ConnectionHandles, { type PortHandleInfo } from './ConnectionHandles'
import DeviceIllustration, { getDeviceLayoutParams, SVG_H_DEFAULT } from './DeviceIllustration'

// Category color mapping — uses CSS variables for dynamic theme switching
const CATEGORY_COLORS: Record<string, { bg: string; border: string; accent: string; light: string }> = {
  '防火墙':     { bg: 'var(--color-cat-firewall-bg)', border: 'var(--color-cat-firewall-border)', accent: 'var(--color-cat-firewall-accent)', light: 'var(--color-cat-firewall-light)' },
  '交换机':     { bg: 'var(--color-cat-switch-bg)',   border: 'var(--color-cat-switch-border)',   accent: 'var(--color-cat-switch-accent)',   light: 'var(--color-cat-switch-light)' },
  '无线控制器': { bg: 'var(--color-cat-ac-bg)',       border: 'var(--color-cat-ac-border)',       accent: 'var(--color-cat-ac-accent)',       light: 'var(--color-cat-ac-light)' },
  '无线接入点': { bg: 'var(--color-cat-ap-bg)',       border: 'var(--color-cat-ap-border)',       accent: 'var(--color-cat-ap-accent)',       light: 'var(--color-cat-ap-light)' },
  '服务器':     { bg: 'var(--color-cat-server-bg)',   border: 'var(--color-cat-server-border)',   accent: 'var(--color-cat-server-accent)',   light: 'var(--color-cat-server-light)' },
}

const DEFAULT_COLOR = { bg: 'var(--color-cat-default-bg)', border: 'var(--color-cat-default-border)', accent: 'var(--color-cat-default-accent)', light: 'var(--color-cat-default-light)' }

export interface DeviceNodeData {
  device: DeviceRow
  customName?: string
  customImage?: string
  customCategory?: string
  customVendor?: string
  customDeviceModel?: string
  customPorts?: string          // legacy — single string format
  customPortsRJ45?: number      // V0.7.1: 网络端口数量
  customPortsSFP?: number       // V0.7.1: 千兆光纤端口数量
  customPortsSFP28?: number     // V0.7.1: 万兆光纤端口数量
  customColor?: string
  description?: string
  ipAddress?: string
}

// ── DeviceNode ─────────────────────────────────────────────────

/** Compute optimal node width based on port count and side-by-side layout rules */
function getNodeWidth(totalPorts: number): number {
  // Side-by-side layout needs more horizontal space when copper+fiber coexist.
  // Widths account for max-per-row rules + SIDE_GAP between left/right groups:
  //   ≤8  → 200px (single side, up to 8 ports)
  //   ≤16 → 320px (side-by-side: up to 8+8, or single-side 16)
  //   ≤24 → 420px (side-by-side: up to 12+12, or single-side 24)
  //   ≤48 → 640px (side-by-side: up to 24+24, or single-side 48)
  if (totalPorts <= 8) return 200
  if (totalPorts <= 16) return 320
  if (totalPorts <= 24) return 440   // V0.7.2: slightly wider for fiber at full visualWidth
  if (totalPorts <= 48) return 640
  return 720                          // V0.7.2: slightly wider
}

function DeviceNode({ id, data, selected, width: rfWidth, height: rfHeight }: NodeProps) {
  const nodeData = data as unknown as DeviceNodeData
  const { device } = nodeData
  const [isHovered, setIsHovered] = useState(false)

  // V0.8.0: Access edges for used-port tracking and measure SVG offset
  const { getEdges } = useReactFlow()
  const nodeOuterRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [svgOffset, setSvgOffset] = useState({ left: 24, top: 40 }) // analytical fallback

  const colors = CATEGORY_COLORS[device.category_name] || DEFAULT_COLOR
  const showBorder = selected || isHovered
  const showHandles = selected || isHovered

  // Resolved display values (custom override → database fallback)
  const displayCategory = nodeData.customCategory || device.category_name
  const displayVendor = nodeData.customVendor || device.vendor_name
  const displayDeviceName = nodeData.customName || device.model
  const displayDeviceModel = nodeData.customDeviceModel || `${device.vendor_name} ${device.model}`
  // V0.7.1: Modular port counts take precedence over legacy customPorts string
  const rj45 = nodeData.customPortsRJ45
  const sfp = nodeData.customPortsSFP
  const sfp28 = nodeData.customPortsSFP28
  const hasModularPorts = rj45 !== undefined || sfp !== undefined || sfp28 !== undefined
  const displayPorts = hasModularPorts
    ? composePortsInfo(rj45 ?? 0, sfp ?? 0, sfp28 ?? 0)
    : (nodeData.customPorts || device.ports_info || '')

  // Compute total port count for handle distribution & node sizing
  const portGroups = parsePortsInfo(displayPorts)
  const totalPorts = portGroups.reduce((sum, g) => sum + g.count, 0)
  const computedWidth = getNodeWidth(totalPorts)
  // Use React Flow's width if user has manually resized (it will differ from computed),
  // otherwise use computed width based on port count
  const nodeWidth = rfWidth && rfWidth > 0 ? rfWidth : computedWidth
  // Use React Flow's height if user has manually resized, otherwise auto (content-determined)
  const nodeHeight = rfHeight && rfHeight > 0 ? rfHeight : undefined
  // SVG width: node body minus horizontal padding (~24px)
  const svgW = Math.max(140, nodeWidth - 24)
  // SVG height: adapt to port layout row count. Reserved: header(~30px) + info(~60px) + padding(~12px)
  const SVG_H_MIN = 100
  const layoutRows = countLayoutRows(portGroups)
  const dynamicSvgH = layoutRows > 0
    ? Math.max(SVG_H_MIN, layoutRows * 28 + 20)  // V0.7.3: 28px per row (up to 23px height + 5px gap) for fiber port headroom
    : SVG_H_DEFAULT
  const svgH = nodeHeight
    ? Math.max(SVG_H_MIN, nodeHeight - 102)
    : dynamicSvgH

  // ── V0.8.0: Compute port layout and used-port tracking ──────────
  const layoutParams = getDeviceLayoutParams(device.category_name, svgW, svgH)
  const portLayoutAvailableW = layoutParams.portPanelSvgW - 24
  const portLayoutAvailableH = Math.max(40, layoutParams.bodyH - 12)
  const portLayout = portGroups.length > 0
    ? getPortLayout(portGroups, portLayoutAvailableW, portLayoutAvailableH)
    : { ports: [], rows: 0 }

  // Build per-port handle info with edge-tracking
  const allEdges = getEdges()
  const portHandleInfos: PortHandleInfo[] = portLayout.ports.map(port => {
    const portLabel = `${port.typeLabel}${port.portIndex}`
    // Port center in SVG viewBox coordinates
    const svgCenterX = layoutParams.panelX + port.x + port.width / 2
    const svgCenterY = layoutParams.portPanelBodyY + 6 + port.y + port.height / 2
    // Check if this port is already referenced by any edge connected to this node
    const isUsed = allEdges.some(e => {
      const ed = e.data as EdgeData | undefined
      return (e.source === id && ed?.sourcePort === portLabel) ||
             (e.target === id && ed?.targetPort === portLabel)
    })
    return { portLabel, svgCenterX, svgCenterY, isUsed }
  })

  // Build used-port set for SVG LED highlighting
  const usedPorts = new Set(portHandleInfos.filter(p => p.isUsed).map(p => p.portLabel))

  // V0.8.3: Measure the SVG element itself (not its container) so that
  // padding (px-2) and centering (flex justify-center) are automatically
  // accounted for in the offset. This keeps handles locked to port positions
  // when the node is resized.
  useLayoutEffect(() => {
    if (!svgContainerRef.current || !nodeOuterRef.current) return
    const svgEl = svgContainerRef.current.querySelector('svg')
    if (!svgEl) return
    const nodeRect = nodeOuterRef.current.getBoundingClientRect()
    const svgRect = svgEl.getBoundingClientRect()
    setSvgOffset({
      left: svgRect.left - nodeRect.left,
      top: svgRect.top - nodeRect.top,
    })
  }, [nodeWidth, nodeHeight])

  // V0.8.4: After svgOffset updates and handles re-render, tell React Flow
  // to re-measure handle positions via getBoundingClientRect (getHandleBounds).
  // Without this, React Flow's internal handleBounds are stale, causing edge
  // endpoints to be offset from actual port centers.
  const updateNodeInternals = useUpdateNodeInternals()
  useLayoutEffect(() => {
    updateNodeInternals(id)
  }, [svgOffset, id, updateNodeInternals])

  return (
    <div
      ref={nodeOuterRef}
      className="relative rounded-lg shadow-sm border-2 transition-colors transition-shadow duration-150 select-none"
      style={{
        width: nodeWidth,
        height: nodeHeight,
        minWidth: 160,
        minHeight: 220,
        backgroundColor: 'var(--color-surface)',
        borderColor: showBorder ? (selected ? 'var(--color-edge-selected)' : colors.border) : 'transparent',
        boxShadow: selected
          ? 'var(--color-node-shadow-selected)'
          : isHovered
            ? 'var(--color-node-shadow-hover)'
            : 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Node resizer — allows manual resize */}
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={120}
        maxWidth={800}
        keepAspectRatio={false}
        color="var(--color-resizer)"
        lineStyle={{ opacity: 0.8 }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: 'var(--color-resizer)',
          border: '2px solid var(--color-handle-border)',
          zIndex: 5,
        }}
      />

      {/* Connection handles — V0.8.0: port-level handles on each port */}
      <ConnectionHandles
        portHandleInfos={portHandleInfos}
        visible={showHandles}
        svgOffset={svgOffset}
      />

      {/* Header bar */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-md border-b"
        style={{ backgroundColor: nodeData.customColor || colors.light, borderColor: colors.border }}
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: nodeData.customColor || colors.accent }} />
        <div className="flex-1 min-w-0">
          <InlineEdit
            label="设备功能"
            value={displayCategory}
            nodeId={id}
            dataKey="customCategory"
          />
        </div>
        <div className="min-w-0">
          <InlineEdit
            label="设备厂商"
            value={displayVendor}
            nodeId={id}
            dataKey="customVendor"
          />
        </div>
      </div>

      {/* Device illustration — always SVG, device image is shown in PropertyPanel only */}
      <div ref={svgContainerRef} className="px-2 py-2 flex justify-center bg-surface">
        <DeviceIllustration categoryName={device.category_name} accent={nodeData.customColor || colors.accent} portsInfo={displayPorts} ports={portLayout.ports} usedPorts={usedPorts} svgW={svgW} svgH={svgH} />
      </div>

      {/* Device info */}
      <div className="px-3 pb-2.5 space-y-0.5">
        <InlineEdit
          label="设备名称"
          value={displayDeviceName}
          nodeId={id}
          dataKey="customName"
          bold
        />
        <InlineEdit
          label="设备型号"
          value={displayDeviceModel}
          nodeId={id}
          dataKey="customDeviceModel"
        />
        {/* 设备端口 — read-only display, edit via PropertyPanel */}
        <div
          className="text-2xs truncate rounded px-1 py-0.5 -mx-1 min-w-0 text-text-secondary"
          title="在属性面板中编辑端口数量"
        >
          {displayPorts || <span className="text-text-secondary italic">无端口信息</span>}
        </div>
      </div>
    </div>
  )
}

export default memo(DeviceNode)
