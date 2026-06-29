import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Handle, Position, NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import type { DeviceRow } from '../../types'
import { parsePortsInfo, type ParsedPortGroup } from '../../utils/portParser'

// Category color mapping
const CATEGORY_COLORS: Record<string, { bg: string; border: string; accent: string; light: string }> = {
  '防火墙': { bg: '#FEF2F2', border: '#FECACA', accent: '#EF4444', light: '#FEE2E2' },
  '交换机': { bg: '#EFF6FF', border: '#BFDBFE', accent: '#2196F3', light: '#DBEAFE' },
  '无线控制器': { bg: '#F5F3FF', border: '#DDD6FE', accent: '#8B5CF6', light: '#EDE9FE' },
  '无线接入点': { bg: '#ECFDF5', border: '#A7F3D0', accent: '#10B981', light: '#D1FAE5' },
  '服务器': { bg: '#FFFBEB', border: '#FDE68A', accent: '#F59E0B', light: '#FEF3C7' },
}

const DEFAULT_COLOR = { bg: '#FAFAFA', border: '#E5E5E5', accent: '#6B7280', light: '#F3F4F6' }

export interface DeviceNodeData {
  device: DeviceRow
  customName?: string
  customCategory?: string
  customVendor?: string
  customDeviceModel?: string
  customPorts?: string
  customColor?: string
}

// ── SVG device illustrations (dynamic width, proportional ports) ───

const SVG_H = 54

/** Render a row of identically-sized ports */
function PortRow({ count, x, y, availableW, height, maxPerRow, fill, stroke, rx = 1 }: {
  count: number; x: number; y: number; availableW: number; height: number
  maxPerRow: number; fill: string; stroke: string; rx?: number
}) {
  if (count <= 0) return null
  const actual = Math.min(count, maxPerRow)
  const spacing = availableW / actual
  const width = Math.max(3, spacing - 1.5)
  return (
    <>
      {Array.from({ length: actual }).map((_, i) => (
        <rect
          key={`p-${i}`}
          x={x + i * spacing}
          y={y}
          width={width}
          height={height}
          rx={rx}
          fill={fill}
          stroke={stroke}
          strokeWidth={0.5}
        />
      ))}
    </>
  )
}

function SmallPorts({ count, startX, row1Y, row2Y, availableW, maxPerRow }: {
  count: number; startX: number; row1Y: number; row2Y: number; availableW: number
  maxPerRow?: number
}) {
  if (count <= 0) return null
  const effectiveMaxPerRow = maxPerRow ?? (count <= 24 ? 12 : 24)
  const row1 = Math.min(count, effectiveMaxPerRow)
  const row2 = Math.max(0, count - effectiveMaxPerRow)
  return (
    <>
      <PortRow count={row1} x={startX} y={row1Y} availableW={availableW} height={5} maxPerRow={effectiveMaxPerRow} fill="#1E293B" stroke="#64748B" />
      {row2 > 0 && <PortRow count={row2} x={startX} y={row2Y} availableW={availableW} height={5} maxPerRow={effectiveMaxPerRow} fill="#1E293B" stroke="#64748B" />}
    </>
  )
}

function LargePorts({ count, startX, row1Y, row2Y, availableW, maxPerRow = 8 }: {
  count: number; startX: number; row1Y: number; row2Y: number; availableW: number; maxPerRow?: number
}) {
  if (count <= 0) return null
  const row1 = Math.min(count, maxPerRow)
  const row2 = Math.max(0, count - maxPerRow)
  return (
    <>
      <PortRow count={row1} x={startX} y={row1Y} availableW={availableW} height={6} maxPerRow={maxPerRow} fill="#334155" stroke="#94A3B8" rx={1.5} />
      {row2 > 0 && <PortRow count={row2} x={startX} y={row2Y} availableW={availableW} height={6} maxPerRow={maxPerRow} fill="#334155" stroke="#94A3B8" rx={1.5} />}
    </>
  )
}

// ── Per-category SVGs (dynamic width) ──────────────────────────

function SwitchSvg({ accent, portsInfo, svgW }: { accent: string; portsInfo: string; svgW: number }) {
  const groups = parsePortsInfo(portsInfo)
  const small = groups.filter(g => g.category === 'small').reduce((s, g) => s + g.count, 0)
  const large = groups.filter(g => g.category === 'large').reduce((s, g) => s + g.count, 0)

  const margin = 4
  const totalW = svgW - margin * 2
  const startX = margin
  const gap = 6

  let smallZoneW: number
  let largeStartX: number
  let largeZoneW: number

  if (small > 0 && large > 0) {
    largeZoneW = Math.min(totalW * 0.45, Math.max(36, large * 7.5))
    smallZoneW = totalW - largeZoneW - gap
    largeStartX = startX + smallZoneW + gap
  } else if (small > 0) {
    smallZoneW = totalW
    largeZoneW = 0
    largeStartX = 0
  } else {
    smallZoneW = 0
    largeZoneW = totalW
    largeStartX = startX
  }

  const smallMaxPerRow = small === 16 ? 8 : (small <= 24 ? 12 : 24)
  const smallHasRow2 = small > smallMaxPerRow
  const largeMaxPerRow = 8
  const largeHasRow2 = large > largeMaxPerRow
  const needsTwoRows = smallHasRow2 || largeHasRow2

  return (
    <svg viewBox={`0 0 ${svgW} ${SVG_H}`} width={svgW} height={SVG_H} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width={svgW - 4} height="50" rx="3" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
      {/* LED indicators */}
      {Array.from({ length: Math.min(12, Math.floor(totalW / 12)) }).map((_, i) => (
        <rect key={`led-${i}`} x={margin + i * 12.5} y="7" width="3" height="2" rx="0.5" fill={i % 3 === 0 ? accent : '#22C55E'} />
      ))}
      {small > 0 && (
        <SmallPorts count={small} startX={startX} row1Y={needsTwoRows ? 11 : 15} row2Y={20}
          availableW={smallZoneW} maxPerRow={smallMaxPerRow} />
      )}
      {large > 0 && (
        <LargePorts count={large} startX={largeStartX} row1Y={needsTwoRows ? 11 : 15} row2Y={20}
          availableW={largeZoneW} maxPerRow={largeMaxPerRow} />
      )}
    </svg>
  )
}

function FirewallSvg({ accent, portsInfo, svgW }: { accent: string; portsInfo: string; svgW: number }) {
  const groups = parsePortsInfo(portsInfo)
  const small = groups.filter(g => g.category === 'small').reduce((s, g) => s + g.count, 0)
  const large = groups.filter(g => g.category === 'large').reduce((s, g) => s + g.count, 0)

  const zoneStartX = Math.round(svgW * 0.23)
  const zoneW = svgW - zoneStartX - 5
  const gap = 5

  let smallZoneW: number
  let largeStartX: number
  let largeZoneW: number

  if (small > 0 && large > 0) {
    largeZoneW = Math.min(zoneW * 0.4, Math.max(30, large * 8))
    smallZoneW = zoneW - largeZoneW - gap
    largeStartX = zoneStartX + smallZoneW + gap
  } else if (small > 0) {
    smallZoneW = zoneW
    largeZoneW = 0
    largeStartX = 0
  } else {
    smallZoneW = 0
    largeZoneW = zoneW
    largeStartX = zoneStartX
  }

  const smallMaxPerRow = small === 16 ? 8 : (small <= 24 ? 12 : 24)
  const smallHasRow2 = small > smallMaxPerRow
  const largeMaxPerRow = 8
  const largeHasRow2 = large > largeMaxPerRow
  const needsTwoRows = smallHasRow2 || largeHasRow2

  return (
    <svg viewBox={`0 0 ${svgW} ${SVG_H}`} width={svgW} height={SVG_H} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width={svgW - 4} height="50" rx="3" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
      <rect x="2" y="2" width="6" height="50" rx="3" fill={accent} />
      <path d={`M${Math.round(svgW * 0.12)} 10 L${Math.round(svgW * 0.17)} 10 L${Math.round(svgW * 0.17)} 18 C${Math.round(svgW * 0.17)} 26 ${Math.round(svgW * 0.14)} 30 ${Math.round(svgW * 0.14)} 30 C${Math.round(svgW * 0.14)} 30 ${Math.round(svgW * 0.11)} 26 ${Math.round(svgW * 0.12)} 18 Z`} fill={accent} opacity="0.8" />
      <rect x={Math.round(svgW * 0.23)} y="8" width="28" height="12" rx="1" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.5" />
      {[Math.round(svgW * 0.26), Math.round(svgW * 0.30), Math.round(svgW * 0.34), Math.round(svgW * 0.38)].map((cx) => (
        <circle key={`st-${cx}`} cx={cx} cy="13" r="2" fill={cx === Math.round(svgW * 0.30) || cx === Math.round(svgW * 0.34) ? '#22C55E' : accent} />
      ))}
      {small > 0 && (
        <SmallPorts count={small} startX={zoneStartX} row1Y={needsTwoRows ? 22 : 24} row2Y={34}
          availableW={smallZoneW} maxPerRow={smallMaxPerRow} />
      )}
      {large > 0 && (
        <LargePorts count={large} startX={largeStartX} row1Y={needsTwoRows ? 22 : 24} row2Y={34}
          availableW={largeZoneW} maxPerRow={largeMaxPerRow} />
      )}
    </svg>
  )
}

function AcSvg({ accent, portsInfo, svgW }: { accent: string; portsInfo: string; svgW: number }) {
  const groups = parsePortsInfo(portsInfo)
  const small = groups.filter(g => g.category === 'small').reduce((s, g) => s + g.count, 0)
  const large = groups.filter(g => g.category === 'large').reduce((s, g) => s + g.count, 0)

  const zoneStartX = Math.round(svgW * 0.23)
  const zoneW = svgW - zoneStartX - 5
  const gap = 5

  let smallZoneW: number
  let largeStartX: number
  let largeZoneW: number

  if (small > 0 && large > 0) {
    largeZoneW = Math.min(zoneW * 0.4, Math.max(30, large * 8))
    smallZoneW = zoneW - largeZoneW - gap
    largeStartX = zoneStartX + smallZoneW + gap
  } else if (small > 0) {
    smallZoneW = zoneW
    largeZoneW = 0
    largeStartX = 0
  } else {
    smallZoneW = 0
    largeZoneW = zoneW
    largeStartX = zoneStartX
  }

  const smallMaxPerRow = small === 16 ? 8 : (small <= 24 ? 12 : 24)
  const smallHasRow2 = small > smallMaxPerRow
  const largeMaxPerRow = 8
  const largeHasRow2 = large > largeMaxPerRow
  const needsTwoRows = smallHasRow2 || largeHasRow2

  const cx1 = Math.round(svgW * 0.15)
  const cx2 = Math.round(svgW * 0.21)

  return (
    <svg viewBox={`0 0 ${svgW} ${SVG_H}`} width={svgW} height={SVG_H} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width={svgW - 4} height="50" rx="3" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
      <path d={`M${cx1} 12 Q${cx2} 4 ${Math.round(svgW * 0.20)} 12`} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <path d={`M${Math.round(svgW * 0.09)} 17 Q${Math.round(svgW * 0.14)} 7 ${Math.round(svgW * 0.22)} 17`} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d={`M${Math.round(svgW * 0.07)} 22 Q${Math.round(svgW * 0.12)} 10 ${Math.round(svgW * 0.24)} 22`} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <circle cx={Math.round(svgW * 0.14)} cy="27" r="2.5" fill={accent} opacity="0.6" />
      {[0.23, 0.27, 0.31, 0.35].map(pct => Math.round(svgW * pct)).map((x) => (
        <rect key={`led-${x}`} x={x} y="8" width="3" height="2" rx="0.5" fill={x === Math.round(svgW * 0.31) ? accent : '#22C55E'} />
      ))}
      {small > 0 && (
        <SmallPorts count={small} startX={zoneStartX} row1Y={needsTwoRows ? 14 : 18} row2Y={26}
          availableW={smallZoneW} maxPerRow={smallMaxPerRow} />
      )}
      {large > 0 && (
        <LargePorts count={large} startX={largeStartX} row1Y={needsTwoRows ? 14 : 18} row2Y={26}
          availableW={largeZoneW} maxPerRow={largeMaxPerRow} />
      )}
      <rect x={zoneStartX} y={needsTwoRows ? 38 : 30} width={zoneW * 0.7} height="10" rx="2" fill={accent} opacity="0.15" />
    </svg>
  )
}

function ApSvg({ accent, portsInfo, svgW }: { accent: string; portsInfo: string; svgW: number }) {
  const groups = parsePortsInfo(portsInfo)
  const small = groups.filter(g => g.category === 'small').reduce((s, g) => s + g.count, 0)
  const large = groups.filter(g => g.category === 'large').reduce((s, g) => s + g.count, 0)
  const total = small + large

  const apBodyX = Math.round(svgW * 0.20)
  const apBodyW = Math.round(svgW * 0.60)

  function renderUplinkPorts() {
    if (total <= 0) return null
    const count = Math.min(total, 4)
    const portW = 10
    const gap = 6
    const totalW = count * portW + (count - 1) * gap
    const startX = apBodyX + (apBodyW - totalW) / 2
    const portY = 42
    return Array.from({ length: count }).map((_, i) => (
      <rect
        key={`ap-port-${i}`}
        x={startX + i * (portW + gap)}
        y={portY}
        width={portW}
        height={4}
        rx={1}
        fill="#1E293B"
        stroke="#64748B"
        strokeWidth={0.5}
      />
    ))
  }

  const antennaCX = Math.round(svgW * 0.50)

  return (
    <svg viewBox={`0 0 ${svgW} ${SVG_H}`} width={svgW} height={SVG_H} xmlns="http://www.w3.org/2000/svg">
      <rect x={apBodyX} y="8" width={apBodyW} height="38" rx="6" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
      <rect x={antennaCX - 10} y="2" width="20" height="8" rx="2" fill="#CBD5E1" />
      <path d={`M${apBodyX + 24} 26 Q${apBodyX + 18} 20 ${apBodyX + 24} 14`} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <path d={`M${apBodyX + 18} 28 Q${apBodyX + 10} 20 ${apBodyX + 18} 12`} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d={`M${apBodyX + apBodyW - 24} 26 Q${apBodyX + apBodyW - 18} 20 ${apBodyX + apBodyW - 24} 14`} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <path d={`M${apBodyX + apBodyW - 18} 28 Q${apBodyX + apBodyW - 10} 20 ${apBodyX + apBodyW - 18} 12`} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <circle cx={antennaCX} cy="24" r="3" fill={accent} opacity="0.8" />
      {renderUplinkPorts()}
    </svg>
  )
}

function ServerSvg({ accent, portsInfo, svgW }: { accent: string; portsInfo: string; svgW: number }) {
  const groups = parsePortsInfo(portsInfo)
  const nicTotal = groups.filter(g => g.category === 'large').reduce((s, g) => s + g.count, 0)
    || groups.reduce((s, g) => s + g.count, 0)

  const nicCount = Math.min(nicTotal, 6)
  const nicStartX = Math.round(svgW * 0.44)
  const nicAreaW = svgW - nicStartX - 4
  const nicSpacing = nicCount > 0 ? nicAreaW / nicCount : 24
  const nicWidth = Math.max(12, nicSpacing - 4)

  return (
    <svg viewBox={`0 0 ${svgW} ${SVG_H}`} width={svgW} height={SVG_H} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width={svgW - 4} height="50" rx="3" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
      {/* Drive bays */}
      {[8, Math.round(svgW * 0.19)].map((x) =>
        [8, 20, 32].map((y) => (
          <rect key={`d-${x}-${y}`} x={x} y={y} width="18" height="10" rx="1" fill="#1E293B" stroke="#64748B" strokeWidth="0.5" />
        ))
      )}
      <circle cx={Math.round(svgW * 0.36)} cy="13" r="2" fill="#22C55E" />
      <circle cx={Math.round(svgW * 0.36)} cy="25" r="2" fill={accent} />
      <circle cx={Math.round(svgW * 0.36)} cy="37" r="2" fill="#22C55E" />
      {Array.from({ length: nicCount }).map((_, i) => (
        <rect
          key={`nic-${i}`}
          x={nicStartX + i * nicSpacing}
          y="12"
          width={nicWidth}
          height={8}
          rx="1.5"
          fill="#334155"
          stroke="#94A3B8"
          strokeWidth={0.5}
        />
      ))}
      <rect x={Math.round(svgW * 0.44)} y="26" width="16" height="14" rx="1" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.5" />
      <rect x={Math.round(svgW * 0.56)} y="26" width="16" height="14" rx="1" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.5" />
      <text x={Math.round(svgW * 0.50)} y="35" fontSize="5" fill="#94A3B8" textAnchor="middle" fontFamily="sans-serif">PSU1</text>
      <text x={Math.round(svgW * 0.62)} y="35" fontSize="5" fill="#94A3B8" textAnchor="middle" fontFamily="sans-serif">PSU2</text>
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={`fan-${i}`} x1={Math.round(svgW * 0.73) + i * 5} y1="30" x2={Math.round(svgW * 0.73) + i * 5} y2="38" stroke="#CBD5E1" strokeWidth="1" />
      ))}
    </svg>
  )
}

function DeviceIllustration({ categoryName, accent, portsInfo, svgW }: { categoryName: string; accent: string; portsInfo: string; svgW: number }) {
  switch (categoryName) {
    case '交换机': return <SwitchSvg accent={accent} portsInfo={portsInfo} svgW={svgW} />
    case '防火墙': return <FirewallSvg accent={accent} portsInfo={portsInfo} svgW={svgW} />
    case '无线控制器': return <AcSvg accent={accent} portsInfo={portsInfo} svgW={svgW} />
    case '无线接入点': return <ApSvg accent={accent} portsInfo={portsInfo} svgW={svgW} />
    case '服务器': return <ServerSvg accent={accent} portsInfo={portsInfo} svgW={svgW} />
    default: return <SwitchSvg accent={accent} portsInfo={portsInfo} svgW={svgW} />
  }
}

// ── InlineEdit — double-click to edit text field ────────────────

interface InlineEditProps {
  label: string
  value: string
  nodeId: string
  dataKey: string
  placeholder?: string
  bold?: boolean
  className?: string
}

function InlineEdit({ label, value, placeholder, nodeId, dataKey, bold, className }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setNodes } = useReactFlow()

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = useCallback(() => {
    setEditing(false)
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, [dataKey]: editValue.trim() || undefined } }
        }
        return node
      })
    )
  }, [nodeId, dataKey, editValue, setNodes])

  const cancel = useCallback(() => {
    setEditValue(value)
    setEditing(false)
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commit()
      else if (e.key === 'Escape') cancel()
    },
    [commit, cancel],
  )

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`text-2xs bg-white border border-select-border rounded px-1.5 py-0.5 outline-none min-w-0 ${bold ? 'font-semibold' : ''} ${className || ''}`}
        placeholder={placeholder}
      />
    )
  }

  return (
    <div
      className={`text-2xs truncate cursor-text hover:bg-gray-50 rounded px-1 py-0.5 -mx-1 min-w-0 ${bold ? 'font-semibold text-text-primary' : 'text-text-secondary'} ${className || ''}`}
      onDoubleClick={() => {
        setEditValue(value)
        setEditing(true)
      }}
      title={`双击编辑${label}`}
    >
      {value || <span className="text-text-secondary italic">{placeholder || '双击设置...'}</span>}
    </div>
  )
}

// ── Dynamic ConnectionHandles — distributed evenly per side ────

/**
 * Compute the number of handles per side based on total port count.
 * More ports → more handles → cables spread out across the node.
 */
function getHandlesPerSide(totalPorts: number): { top: number; bottom: number; left: number; right: number } {
  if (totalPorts <= 4) return { top: 2, bottom: 2, left: 2, right: 2 }
  if (totalPorts <= 12) return { top: 4, bottom: 4, left: 3, right: 3 }
  if (totalPorts <= 24) return { top: 6, bottom: 6, left: 4, right: 4 }
  if (totalPorts <= 48) return { top: 10, bottom: 10, left: 6, right: 6 }
  return { top: 16, bottom: 16, left: 8, right: 8 }
}

/** Generate evenly-spaced percentage offsets (e.g. 5 handles → ["16.7%","33.3%","50.0%","66.7%","83.3%"]) */
function spreadOffsets(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${((i + 1) / (count + 1)) * 100}%`)
}

interface ConnectionHandlesProps {
  totalPorts: number
  visible: boolean
}

function ConnectionHandles({ totalPorts, visible }: ConnectionHandlesProps) {
  const handleStyle: React.CSSProperties = {
    width: 10,
    height: 10,
    background: visible ? '#2196F3' : 'transparent',
    border: visible ? '2px solid white' : '2px solid transparent',
    borderRadius: '50%',
    cursor: 'crosshair',
    zIndex: 10,
    opacity: visible ? 0.95 : 0,
    transition: 'opacity 0.15s, background 0.15s',
  }

  const targetHandleStyle: React.CSSProperties = {
    ...handleStyle,
    background: visible ? '#22C55E' : 'transparent',
  }

  const counts = getHandlesPerSide(totalPorts)

  // Half-step helper: places target handles halfway between source handles
  const halfStep = (count: number) => `${50 / (count + 1)}%`

  const handles: React.ReactNode[] = []

  // Top side — source at `off`, target at `off + halfStep`
  const topOffsets = spreadOffsets(counts.top)
  const topHS = halfStep(counts.top)
  for (const [i, off] of topOffsets.entries()) {
    handles.push(
      <Handle key={`top-src-${i}`} type="source" position={Position.Top} id={`top-src-${i}`} style={{ ...handleStyle, left: off }} />,
      <Handle key={`top-tgt-${i}`} type="target" position={Position.Top} id={`top-tgt-${i}`} style={{ ...targetHandleStyle, left: `calc(${off} + ${topHS})` }} />,
    )
  }

  // Bottom side
  const bottomOffsets = spreadOffsets(counts.bottom)
  const bottomHS = halfStep(counts.bottom)
  for (const [i, off] of bottomOffsets.entries()) {
    handles.push(
      <Handle key={`bot-src-${i}`} type="source" position={Position.Bottom} id={`bottom-src-${i}`} style={{ ...handleStyle, left: off }} />,
      <Handle key={`bot-tgt-${i}`} type="target" position={Position.Bottom} id={`bottom-tgt-${i}`} style={{ ...targetHandleStyle, left: `calc(${off} + ${bottomHS})` }} />,
    )
  }

  // Left side
  const leftOffsets = spreadOffsets(counts.left)
  const leftHS = halfStep(counts.left)
  for (const [i, off] of leftOffsets.entries()) {
    handles.push(
      <Handle key={`left-src-${i}`} type="source" position={Position.Left} id={`left-src-${i}`} style={{ ...handleStyle, top: off }} />,
      <Handle key={`left-tgt-${i}`} type="target" position={Position.Left} id={`left-tgt-${i}`} style={{ ...targetHandleStyle, top: `calc(${off} + ${leftHS})` }} />,
    )
  }

  // Right side
  const rightOffsets = spreadOffsets(counts.right)
  const rightHS = halfStep(counts.right)
  for (const [i, off] of rightOffsets.entries()) {
    handles.push(
      <Handle key={`right-src-${i}`} type="source" position={Position.Right} id={`right-src-${i}`} style={{ ...handleStyle, top: off }} />,
      <Handle key={`right-tgt-${i}`} type="target" position={Position.Right} id={`right-tgt-${i}`} style={{ ...targetHandleStyle, top: `calc(${off} + ${rightHS})` }} />,
    )
  }

  return <>{handles}</>
}

// ── DeviceNode ─────────────────────────────────────────────────

/** Compute optimal node width based on port count */
function getNodeWidth(totalPorts: number): number {
  // Base width for devices with few ports
  if (totalPorts <= 8) return 200
  if (totalPorts <= 16) return 240
  if (totalPorts <= 24) return 280
  if (totalPorts <= 48) return 340
  return 400
}

function DeviceNode({ id, data, selected, width: rfWidth, height: rfHeight }: NodeProps) {
  const nodeData = data as unknown as DeviceNodeData
  const { device } = nodeData
  const [isHovered, setIsHovered] = useState(false)

  const colors = CATEGORY_COLORS[device.category_name] || DEFAULT_COLOR
  const showBorder = selected || isHovered
  const showHandles = selected || isHovered

  // Resolved display values (custom override → database fallback)
  const displayCategory = nodeData.customCategory || device.category_name
  const displayVendor = nodeData.customVendor || device.vendor_name
  const displayDeviceName = nodeData.customName || device.model
  const displayDeviceModel = nodeData.customDeviceModel || `${device.vendor_name} ${device.model}`
  const displayPorts = nodeData.customPorts || device.ports_info || ''

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

  return (
    <div
      className="relative rounded-lg shadow-sm border-2 transition-colors transition-shadow duration-150 select-none"
      style={{
        width: nodeWidth,
        height: nodeHeight,
        minWidth: 160,
        minHeight: 120,
        backgroundColor: '#FFFFFF',
        borderColor: showBorder ? (selected ? '#2196F3' : colors.border) : 'transparent',
        boxShadow: selected
          ? '0 4px 16px rgba(33,150,243,0.25)'
          : isHovered
            ? '0 2px 8px rgba(0,0,0,0.1)'
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
        maxWidth={600}
        keepAspectRatio={false}
        color="#2196F3"
        lineStyle={{ opacity: 0.8 }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: '#2196F3',
          border: '2px solid white',
          zIndex: 5,
        }}
      />

      {/* Connection handles — dynamically distributed */}
      <ConnectionHandles totalPorts={totalPorts} visible={showHandles} />

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

      {/* SVG illustration */}
      <div className="px-2 py-2 flex justify-center bg-white">
        <DeviceIllustration categoryName={device.category_name} accent={nodeData.customColor || colors.accent} portsInfo={displayPorts} svgW={svgW} />
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
        <InlineEdit
          label="设备端口"
          value={displayPorts}
          nodeId={id}
          dataKey="customPorts"
          placeholder="端口信息..."
        />
      </div>
    </div>
  )
}

export default memo(DeviceNode)
