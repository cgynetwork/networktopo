import { Handle, Position } from '@xyflow/react'

// ── V0.8.0: Port-level connection handles ────────────────────────
// Replaces the old outer-frame handle distribution with handles
// placed directly on each individual port rectangle.
//
// Each port gets a source+target Handle pair positioned at the
// port's center coordinates (converted from SVG viewBox space to
// CSS pixel space via the measured svgOffset).
//
// Handle IDs are the port labels themselves (e.g. "GE1", "SFP3"),
// so onConnect can read connection.sourceHandle directly as the
// port label without any lookup.

/** Per-port information needed to render handles */
export interface PortHandleInfo {
  portLabel: string      // e.g. "GE1", "SFP3", "QSFP2"
  svgCenterX: number     // Port center X in SVG viewBox coordinates
  svgCenterY: number     // Port center Y in SVG viewBox coordinates
  isUsed: boolean        // Whether this port is already connected to an edge
  /** V0.9.0: Connection direction override. Defaults to Position.Top.
   *  STACK port at device bottom uses Position.Bottom to route downward. */
  position?: Position
}

interface ConnectionHandlesProps {
  portHandleInfos: PortHandleInfo[]
  visible: boolean          // Node is selected or hovered
  /** Pixel offset of the SVG container relative to the node's outer div */
  svgOffset: { left: number; top: number }
}

export default function ConnectionHandles({ portHandleInfos, visible, svgOffset }: ConnectionHandlesProps) {
  if (portHandleInfos.length === 0) return null

  return (
    <>
      {portHandleInfos.map((info) => {
        // Convert SVG viewBox coordinates to CSS pixel positions within the node
        const handleX = svgOffset.left + info.svgCenterX
        const handleY = svgOffset.top + info.svgCenterY

        // Used ports: always-visible filled dot
        // Available ports: semi-transparent dot, visible on hover/select
        const handleSize = info.isUsed ? 7 : 6

        // V0.8.3: React Flow's Position.Top places the connection point at the
        // top-center edge of the handle's bounding box. Since the handle is
        // centered on (handleX, handleY) via translate(-50%, -50%), the connection
        // lands at handleY - size/2. We compensate by shifting the handle down by
        // half its size so the connection point aligns with the port center.
        const adjustedTop = handleY + handleSize / 2
        const handleOpacity = info.isUsed ? 0.75 : (visible ? 0.8 : 0)
        const handleBg = info.isUsed
          ? 'var(--color-handle-target)'
          : 'var(--color-handle-source)'
        const handleBorder = info.isUsed
          ? 'var(--color-handle-target)'
          : 'var(--color-handle-border)'

        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          left: handleX,
          top: adjustedTop,
          width: handleSize,
          height: handleSize,
          background: visible || info.isUsed ? handleBg : 'transparent',
          border: visible || info.isUsed ? `1.5px solid ${handleBorder}` : '1.5px solid transparent',
          borderRadius: '50%',
          cursor: 'crosshair',
          zIndex: 10,
          opacity: handleOpacity,
          transition: 'opacity 0.15s, background 0.15s',
          transform: 'translate(-50%, -50%)',
        }

        const handlePosition = info.position ?? Position.Top

        return (
          <span key={info.portLabel}>
            {/* Source handle — outgoing connections */}
            <Handle
              type="source"
              position={handlePosition}
              id={info.portLabel}
              style={baseStyle}
            />
            {/* Target handle — incoming connections (same position, different type) */}
            <Handle
              type="target"
              position={handlePosition}
              id={info.portLabel}
              style={baseStyle}
            />
          </span>
        )
      })}
    </>
  )
}
