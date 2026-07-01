import { memo, useState, useRef, useCallback } from 'react'
import {
  BaseEdge,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
  type Position,
} from '@xyflow/react'
import type { EdgeData, PathStyle } from '../../types'

// ── Path generator: produces path + label position for any style ──
function generatePath(
  style: PathStyle,
  sx: number, sy: number,
  tx: number, ty: number,
  sp: Position, tp: Position,
  elbowOffset: number,
): { path: string; labelX: number; labelY: number } {
  switch (style) {
    case 'straight': {
      const [p, lx, ly] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty })
      return { path: p, labelX: lx, labelY: ly }
    }
    case 'step': {
      const [p, lx, ly] = getSmoothStepPath({ sourceX: sx, sourceY: sy, sourcePosition: sp, targetX: tx, targetY: ty, targetPosition: tp, offset: elbowOffset })
      return { path: p, labelX: lx, labelY: ly }
    }
    case 'adaptive':
    default: {
      const [p, lx, ly] = getBezierPath({ sourceX: sx, sourceY: sy, sourcePosition: sp, targetX: tx, targetY: ty, targetPosition: tp })
      return { path: p, labelX: lx, labelY: ly }
    }
  }
}

function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style = {},
}: EdgeProps) {
  const edgeData = (data || {}) as EdgeData
  const connectionType = edgeData.connectionType || 'ethernet'
  const animationStyle = edgeData.animationStyle || 'particle'
  const direction = edgeData.direction || 'forward'
  const pathStyle = edgeData.pathStyle || 'adaptive'

  // ── Custom appearance (V0.2.1) ──────────────────────────────
  const isFiber = connectionType === 'fiber'
  const isStack = connectionType === 'stack'
  const isWireless = connectionType === 'wireless'
  const customStrokeWidth = edgeData.strokeWidth ?? (isStack ? 7 : 3.5)
  const defaultColor = isStack
    ? 'var(--color-edge-stack)'
    : isWireless
      ? 'var(--color-edge-wireless)'
      : isFiber
        ? 'var(--color-edge-fiber)'
        : 'var(--color-edge-ethernet)'
  const customColor = edgeData.strokeColor || defaultColor
  const effectColor = edgeData.effectColor || (isStack ? 'var(--color-edge-stack-effect)' : isWireless ? 'var(--color-edge-wireless-effect)' : 'var(--color-edge-effect)')
  const animSpeed = edgeData.animSpeed ?? (isStack ? 1.5 : 2)
  const baseParticleSize = edgeData.particleSize ?? (isStack ? 5.5 : 4.5)
  const elbowOffset = edgeData.elbowOffset ?? 50

  // ── Generate visual edge path (always source → target) ──────
  const { path: edgePath, labelX, labelY } = generatePath(
    pathStyle, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, elbowOffset,
  )

  // ── Generate animation path (respects direction) ─────────────
  // When reversed, call the path function with swapped source/target
  // to generate a correct SVG path from target back to source.
  let animPath: string
  if (direction === 'reverse') {
    animPath = generatePath(
      pathStyle, targetX, targetY, sourceX, sourceY, targetPosition, sourcePosition, elbowOffset,
    ).path
  } else {
    animPath = edgePath
  }

  // ── Line style ──────────────────────────────────────────────
  const strokeColor = selected ? 'var(--color-edge-selected)' : customColor
  const strokeWidth = selected ? customStrokeWidth + 0.5 : customStrokeWidth
  const strokeDasharray = isFiber ? '12 6' : isWireless ? '8 4' : 'none'

  const animDuration = String(animSpeed)

  // ── Port label positions ───────────────────────────────────
  // Source port: offset from source toward center
  const dxS = labelX - sourceX
  const dyS = labelY - sourceY
  const distS = Math.sqrt(dxS * dxS + dyS * dyS)
  const portOffset = Math.min(28, distS * 0.15)
  const srcPortX = distS > 0 ? sourceX + (dxS / distS) * portOffset : sourceX + 28
  const srcPortY = distS > 0 ? sourceY + (dyS / distS) * portOffset : sourceY

  // Target port: offset from target toward center
  const dxT = labelX - targetX
  const dyT = labelY - targetY
  const distT = Math.sqrt(dxT * dxT + dyT * dyT)
  const tgtPortX = distT > 0 ? targetX + (dxT / distT) * portOffset : targetX - 28
  const tgtPortY = distT > 0 ? targetY + (dyT / distT) * portOffset : targetY

  // ── V0.8.1: Draggable port label offsets ──────────────────
  const { setEdges } = useReactFlow()

  // Source port label drag state
  const [srcOffset, setSrcOffset] = useState({
    x: edgeData.sourcePortOffsetX ?? 0,
    y: edgeData.sourcePortOffsetY ?? 0,
  })
  const [srcDragging, setSrcDragging] = useState(false)
  const srcDragRef = useRef({ startMX: 0, startMY: 0, baseOX: 0, baseOY: 0, curOX: 0, curOY: 0 })

  // Target port label drag state
  const [tgtOffset, setTgtOffset] = useState({
    x: edgeData.targetPortOffsetX ?? 0,
    y: edgeData.targetPortOffsetY ?? 0,
  })
  const [tgtDragging, setTgtDragging] = useState(false)
  const tgtDragRef = useRef({ startMX: 0, startMY: 0, baseOX: 0, baseOY: 0, curOX: 0, curOY: 0 })

  const handleSrcMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    srcDragRef.current = {
      startMX: e.clientX, startMY: e.clientY,
      baseOX: srcOffset.x, baseOY: srcOffset.y,
      curOX: srcOffset.x, curOY: srcOffset.y,
    }
    setSrcDragging(true)
    const onMouseMove = (e2: MouseEvent) => {
      const dx = e2.clientX - srcDragRef.current.startMX
      const dy = e2.clientY - srcDragRef.current.startMY
      const nx = srcDragRef.current.baseOX + dx
      const ny = srcDragRef.current.baseOY + dy
      srcDragRef.current.curOX = nx
      srcDragRef.current.curOY = ny
      setSrcOffset({ x: nx, y: ny })
    }
    const onMouseUp = () => {
      setSrcDragging(false)
      const fx = srcDragRef.current.curOX
      const fy = srcDragRef.current.curOY
      setEdges((eds) => eds.map((edge) => {
        if (edge.id === id) {
          return { ...edge, data: { ...edge.data, sourcePortOffsetX: fx, sourcePortOffsetY: fy } }
        }
        return edge
      }))
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [id, setEdges, srcOffset.x, srcOffset.y])

  const handleTgtMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    tgtDragRef.current = {
      startMX: e.clientX, startMY: e.clientY,
      baseOX: tgtOffset.x, baseOY: tgtOffset.y,
      curOX: tgtOffset.x, curOY: tgtOffset.y,
    }
    setTgtDragging(true)
    const onMouseMove = (e2: MouseEvent) => {
      const dx = e2.clientX - tgtDragRef.current.startMX
      const dy = e2.clientY - tgtDragRef.current.startMY
      const nx = tgtDragRef.current.baseOX + dx
      const ny = tgtDragRef.current.baseOY + dy
      tgtDragRef.current.curOX = nx
      tgtDragRef.current.curOY = ny
      setTgtOffset({ x: nx, y: ny })
    }
    const onMouseUp = () => {
      setTgtDragging(false)
      const fx = tgtDragRef.current.curOX
      const fy = tgtDragRef.current.curOY
      setEdges((eds) => eds.map((edge) => {
        if (edge.id === id) {
          return { ...edge, data: { ...edge.data, targetPortOffsetX: fx, targetPortOffsetY: fy } }
        }
        return edge
      }))
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [id, setEdges, tgtOffset.x, tgtOffset.y])

  return (
    <>
      {/* Base line — thick and clearly colored */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />

      {/* Particle flow — particles moving along the line */}
      {animationStyle === 'particle' && (
        <>
          <circle r={baseParticleSize} fill={effectColor} opacity="0.9">
            <animateMotion
              dur={`${animDuration}s`}
              repeatCount="indefinite"
              path={animPath}
              rotate="auto"
            />
          </circle>
          <circle r={baseParticleSize * 0.78} fill={effectColor} opacity="0.55">
            <animateMotion
              dur={`${animDuration}s`}
              repeatCount="indefinite"
              begin="0.6s"
              path={animPath}
              rotate="auto"
            />
          </circle>
          <circle r={baseParticleSize * 0.67} fill={effectColor} opacity="0.35">
            <animateMotion
              dur={`${animDuration}s`}
              repeatCount="indefinite"
              begin="1.2s"
              path={animPath}
              rotate="auto"
            />
          </circle>
        </>
      )}

      {/* Glow band animation */}
      {animationStyle === 'glow' && (
        <>
          <defs>
            <filter id={`glowBlur-${id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={customStrokeWidth * 0.7} />
            </filter>
          </defs>
          <path
            d={animPath}
            fill="none"
            stroke={effectColor}
            strokeWidth={customStrokeWidth * 2.3}
            strokeLinecap="round"
            opacity="0.5"
            strokeDasharray={`${customStrokeWidth * 8.5} ${customStrokeWidth * 57}`}
            filter={`url(#glowBlur-${id})`}
          >
            <animate
              attributeName="stroke-dashoffset"
              from={String(customStrokeWidth * 66)}
              to="0"
              dur={`${animDuration}s`}
              repeatCount="indefinite"
            />
          </path>
        </>
      )}

      {/* V0.9.3: Wave animation — flowing signal-wave icons for wireless edges */}
      {animationStyle === 'wave' && (
        <>
          {/* Primary wave — largest amplitude, full opacity */}
          <g>
            <animateMotion
              dur={`${animDuration * 1.5}s`}
              repeatCount="indefinite"
              path={animPath}
              rotate="auto"
            />
            <path
              d="M-8 0 Q-4 -6 0 0 Q4 -5 8 0"
              fill="none"
              stroke={effectColor}
              strokeWidth={Math.max(2, customStrokeWidth * 0.55)}
              strokeLinecap="round"
              opacity="0.85"
            />
          </g>
          {/* Secondary wave — medium amplitude, staggered */}
          <g>
            <animateMotion
              dur={`${animDuration * 1.5}s`}
              repeatCount="indefinite"
              begin="0.5s"
              path={animPath}
              rotate="auto"
            />
            <path
              d="M-5 0 Q-2 -4 0 0 Q2 -3 5 0"
              fill="none"
              stroke={effectColor}
              strokeWidth={Math.max(1.5, customStrokeWidth * 0.4)}
              strokeLinecap="round"
              opacity="0.55"
            />
          </g>
          {/* Tertiary wave — smallest, further staggered */}
          <g>
            <animateMotion
              dur={`${animDuration * 1.5}s`}
              repeatCount="indefinite"
              begin="0.3s"
              path={animPath}
              rotate="auto"
            />
            <path
              d="M-3 0 Q-1 -2 0 0 Q1 -2 3 0"
              fill="none"
              stroke={effectColor}
              strokeWidth={Math.max(1, customStrokeWidth * 0.3)}
              strokeLinecap="round"
              opacity="0.35"
            />
          </g>
        </>
      )}

      {/* Bandwidth label — SVG text with outline halo rendered after BaseEdge so it
          paints above the edge path (V0.8.4). paintOrder="stroke fill" renders the
          stroke behind the fill, creating a halo that ensures text readability
          regardless of cable color or position underneath. */}
      {edgeData.bandwidth && (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fill="var(--color-text-secondary)"
          stroke="var(--color-canvas)"
          strokeWidth={3.5}
          paintOrder="stroke fill"
          strokeLinecap="round"
          strokeLinejoin="round"
          fontFamily="'Microsoft YaHei', -apple-system, sans-serif"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {edgeData.bandwidth}
        </text>
      )}

      {/* Cable length label — below bandwidth, same halo style (V0.9.2) */}
      {edgeData.cableLength && (
        <text
          x={labelX}
          y={labelY + (edgeData.bandwidth ? 13 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fill="var(--color-text-secondary)"
          stroke="var(--color-canvas)"
          strokeWidth={3.5}
          paintOrder="stroke fill"
          strokeLinecap="round"
          strokeLinejoin="round"
          fontFamily="'Microsoft YaHei', -apple-system, sans-serif"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {edgeData.cableLength}
        </text>
      )}

      {/* Source port label — near source end, draggable (V0.8.1) */}
      {edgeData.sourcePort && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-2xs px-1 py-0.5 rounded border font-mono select-none"
            style={{
              backgroundColor: 'var(--color-port-source-bg)',
              color: 'var(--color-port-source-text)',
              borderColor: 'var(--color-port-source-border)',
              cursor: srcDragging ? 'grabbing' : 'grab',
              pointerEvents: 'all',
              transform: `translate(-50%, -50%) translate(${srcPortX + srcOffset.x}px, ${srcPortY + srcOffset.y}px)`,
            }}
            onMouseDown={handleSrcMouseDown}
          >
            {edgeData.sourcePort}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Target port label — near target end, draggable (V0.8.1) */}
      {edgeData.targetPort && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-2xs px-1 py-0.5 rounded border font-mono select-none"
            style={{
              backgroundColor: 'var(--color-port-target-bg)',
              color: 'var(--color-port-target-text)',
              borderColor: 'var(--color-port-target-border)',
              cursor: tgtDragging ? 'grabbing' : 'grab',
              pointerEvents: 'all',
              transform: `translate(-50%, -50%) translate(${tgtPortX + tgtOffset.x}px, ${tgtPortY + tgtOffset.y}px)`,
            }}
            onMouseDown={handleTgtMouseDown}
          >
            {edgeData.targetPort}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(AnimatedEdge)
