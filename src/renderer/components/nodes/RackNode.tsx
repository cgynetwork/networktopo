import { useRef } from 'react'
import { type NodeProps } from '@xyflow/react'
import type { RackNodeData, RackAccessory } from '../../types'
import { useDragState } from '../../context/DragStateContext'
import {
  U_PX_HEIGHT, RACK_HEADER_H, RACK_FOOTER_H, RACK_RAIL_W,
  getRackNodeWidth, getRackHeight,
} from '../../utils/rackUtils'

// ── Accessory SVG Renderers ────────────────────────────────

/** Render a cable management bar (理线器) at the given Y position */
function CableManagementSvg({ y, rackWidth, uHeight }: { y: number; rackWidth: number; uHeight: number }) {
  const h = uHeight * U_PX_HEIGHT
  const cx = RACK_RAIL_W + 4
  const cw = rackWidth - RACK_RAIL_W * 2 - 8
  const slotCount = Math.floor(cw / 8) // grooves every 8px
  return (
    <g>
      <rect x={cx} y={y} width={cw} height={h} rx={2}
        fill="var(--color-rack-cable-mgmt)" stroke="var(--color-rack-rail-stroke)" strokeWidth={0.5} />
      {Array.from({ length: slotCount }, (_, i) => (
        <line key={i} x1={cx + 4 + i * 8} y1={y + 2}
          x2={cx + 4 + i * 8} y2={y + h - 2}
          stroke="var(--color-rack-rail-bg)" strokeWidth={1.5} />
      ))}
      <text x={cx + cw / 2} y={y + h / 2 + 4} textAnchor="middle"
        fill="var(--color-rack-u-marker)" fontSize={9} fontFamily="system-ui">
        理线器
      </text>
    </g>
  )
}

/** Render a blanking panel (盲板) at the given Y position */
function BlankingPanelSvg({ y, rackWidth, uHeight }: { y: number; rackWidth: number; uHeight: number }) {
  const h = uHeight * U_PX_HEIGHT
  const cx = RACK_RAIL_W + 4
  const cw = rackWidth - RACK_RAIL_W * 2 - 8
  return (
    <g>
      <rect x={cx} y={y} width={cw} height={h} rx={2}
        fill="var(--color-rack-blanking)" stroke="var(--color-rack-rail-stroke)" strokeWidth={0.5} />
      <rect x={cx + 2} y={y + 2} width={cw - 4} height={h - 4} rx={1}
        fill="var(--color-rack-blanking-inner)" />
      {uHeight > 1 && (
        <line x1={cx} y1={y + h / 2} x2={cx + cw} y2={y + h / 2}
          stroke="var(--color-rack-rail-stroke)" strokeWidth={0.3} />
      )}
    </g>
  )
}

/** Render a PDU strip on the right side of the rack */
function PduSvg({ rackHeight, rackWidth }: { rackHeight: number; rackWidth: number }) {
  const px = rackWidth - RACK_RAIL_W - 8
  const py = RACK_HEADER_H + 4
  const pw = 8
  const ph = rackHeight - RACK_HEADER_H - RACK_FOOTER_H - 8
  const outletCount = Math.floor(ph / 12)
  return (
    <g>
      <rect x={px} y={py} width={pw} height={ph} rx={3}
        fill="var(--color-rack-pdu)" stroke="var(--color-rack-pdu-stroke)" strokeWidth={0.5} />
      {Array.from({ length: outletCount }, (_, i) => (
        <rect key={i} x={px + 1.5} y={py + 4 + i * 12}
          width={pw - 3} height={6} rx={1}
          fill="var(--color-rack-pdu-outlet)" />
      ))}
      <text x={px + pw / 2} y={py - 6} textAnchor="middle"
        fill="var(--color-rack-pdu)" fontSize={7} fontWeight={600}>PDU</text>
    </g>
  )
}

// ── RackNode ──────────────────────────────────────────────

const RackNode = function RackNode({ id, data, selected }: NodeProps) {
  const rackData = data as unknown as RackNodeData
  const { uHeight, viewMode, accessories, label } = rackData

  // ── DEBUG: render cycle tracking ──────────────────────
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  if (renderCountRef.current <= 5 || renderCountRef.current % 10 === 0) {
    console.log(`[DEBUG RackNode] render #${renderCountRef.current} — id: ${id}, viewMode: ${viewMode}, width/height: ${getRackNodeWidth(viewMode)}/${getRackHeight(uHeight)}`)
  }
  if (renderCountRef.current > 100) {
    console.error(`[DEBUG RackNode] ⚠️ RENDER LOOP DETECTED! ${renderCountRef.current} renders for ${id}`)
  }

  const rackWidth = getRackNodeWidth(viewMode)
  const rackHeight = getRackHeight(uHeight)

  // V1.1.1: Highlight when a device is being dragged over this rack
  const { dragOverRackId } = useDragState()
  const isDragHovered = dragOverRackId === id

  // Generate U markers (EIA-310-D: top=highest U, bottom=U1)
  // Index i=0 is top of rack, i=uHeight-1 is bottom
  const uMarkers = Array.from({ length: uHeight }, (_, i) => ({
    label: uHeight - i,  // display: 42, 41, ..., 1
    y: RACK_HEADER_H + (i + 0.5) * U_PX_HEIGHT + 4,  // Y position from rack top-left
  }))

  // Render a single accessory
  const renderAccessory = (acc: RackAccessory) => {
    const accY = RACK_HEADER_H + acc.uPosition * U_PX_HEIGHT
    switch (acc.type) {
      case 'cable-management':
        return (
          <CableManagementSvg
            key={acc.id}
            y={accY}
            rackWidth={rackWidth}
            uHeight={acc.uHeight}
          />
        )
      case 'blanking-panel':
        return (
          <BlankingPanelSvg
            key={acc.id}
            y={accY}
            rackWidth={rackWidth}
            uHeight={acc.uHeight}
          />
        )
      case 'pdu':
        return null // PDU rendered separately as a side strip
      default:
        return null
    }
  }

  // Check if there's at least one PDU accessory
  const hasPdu = accessories.some(a => a.type === 'pdu')

  return (
    <div
      className="rack-node-wrapper"
      style={{
        width: rackWidth,
        height: rackHeight,
        borderRadius: 6,
        boxShadow: isDragHovered
          ? '0 0 16px 4px rgba(59, 130, 246, 0.45), 0 0 0 2px rgba(59, 130, 246, 0.3)'
          : selected
            ? 'var(--color-node-shadow-selected)'
            : '0 1px 3px rgba(0,0,0,0.12)',
        border: isDragHovered
          ? '2px solid #3B82F6'
          : selected
            ? '2px solid var(--color-edge-selected)'
            : '2px solid var(--color-rack-frame)',
        outline: isDragHovered ? '4px solid rgba(59, 130, 246, 0.25)' : 'none',
        transition: 'border 0.15s ease, box-shadow 0.15s ease, outline 0.15s ease',
      }}
    >
      <svg
        width={rackWidth}
        height={rackHeight}
        viewBox={`0 0 ${rackWidth} ${rackHeight}`}
        style={{ display: 'block', borderRadius: 6 }}
      >
        {/* ── Cabinet outer frame ── */}
        <rect x={1} y={1} width={rackWidth - 2} height={rackHeight - 2} rx={4}
          fill="var(--color-rack-bg)" stroke="var(--color-rack-frame)" strokeWidth={2} />

        {/* ── Top header ── */}
        <rect x={2} y={2} width={rackWidth - 4} height={RACK_HEADER_H - 2} rx={3}
          fill="var(--color-rack-header-bg)" />
        {/* Header text + view mode badge */}
        <>
        <text x={rackWidth / 2} y={RACK_HEADER_H / 2 + 3} textAnchor="middle"
          fill="var(--color-rack-label)" fontSize={13} fontWeight={600}
          fontFamily="system-ui, sans-serif">
          {label}
        </text>
        {/* View mode badge */}
        <rect x={rackWidth / 2 - 18} y={RACK_HEADER_H / 2 + 6} width={36} height={14} rx={3}
          fill={viewMode === 'front' ? 'var(--color-rack-front-badge)' : 'var(--color-rack-back-badge)'} />
        <text x={rackWidth / 2} y={RACK_HEADER_H / 2 + 16} textAnchor="middle"
          fill="var(--color-rack-label)" fontSize={8} fontWeight={500}
          fontFamily="system-ui, sans-serif">
          {viewMode === 'front' ? '正面' : '背面'}
        </text>
        </>


        {/* ── Left rail ── */}
        <rect x={4} y={RACK_HEADER_H} width={RACK_RAIL_W - 2}
          height={uHeight * U_PX_HEIGHT + 2}
          fill="var(--color-rack-rail-bg)" stroke="var(--color-rack-rail-stroke)" strokeWidth={1} />

        {/* ── Left U-number markers ── */}
        {uMarkers.map(m => (
          <text key={`ul-${m.label}`}
            x={8} y={m.y}
            fill="var(--color-rack-u-marker)" fontSize={9} fontFamily="monospace">
            {m.label}
          </text>
        ))}

        {/* ── U slot horizontal guide lines ── */}
        {Array.from({ length: uHeight + 1 }, (_, i) => (
          <line key={`ug-${i}`}
            x1={RACK_RAIL_W} y1={RACK_HEADER_H + i * U_PX_HEIGHT}
            x2={rackWidth - RACK_RAIL_W - 4} y2={RACK_HEADER_H + i * U_PX_HEIGHT}
            stroke="var(--color-rack-u-line)" strokeWidth={0.5} strokeDasharray="2 2"
          />
        ))}

        {/* ── Accessories ── */}
        {accessories.map(renderAccessory)}

        {/* ── PDU side strip ── */}
        {hasPdu && <PduSvg rackHeight={rackHeight} rackWidth={rackWidth} />}

        {/* ── Right rail ── */}
        <rect x={rackWidth - RACK_RAIL_W - 2} y={RACK_HEADER_H}
          width={RACK_RAIL_W - 2} height={uHeight * U_PX_HEIGHT + 2}
          fill="var(--color-rack-rail-bg)" stroke="var(--color-rack-rail-stroke)" strokeWidth={1} />

        {/* ── Right U-number markers ── */}
        {uMarkers.map(m => (
          <text key={`ur-${m.label}`}
            x={rackWidth - 10} y={m.y}
            fill="var(--color-rack-u-marker)" fontSize={9} fontFamily="monospace"
            textAnchor="end">
            {m.label}
          </text>
        ))}

        {/* ── Cable entry indicators ── */}
        <>
        <rect x={rackWidth / 2 - 20} y={4} width={40} height={6} rx={3}
          fill="var(--color-rack-rail-stroke)" opacity={0.6} />
        <rect x={rackWidth / 2 - 20} y={rackHeight - 10} width={40} height={6} rx={3}
          fill="var(--color-rack-rail-stroke)" opacity={0.6} />
        </>


        {/* ── Footer ── */}
        <>
        <rect x={2} y={rackHeight - RACK_FOOTER_H - 2} width={rackWidth - 4} height={RACK_FOOTER_H}
          fill="var(--color-rack-footer-bg)" />
        <text x={rackWidth / 2} y={rackHeight - 4} textAnchor="middle"
          fill="var(--color-rack-u-marker)" fontSize={8} fontFamily="system-ui">
          {uHeight}U
        </text>
        </>

      </svg>
    </div>
  )
}

export default RackNode
