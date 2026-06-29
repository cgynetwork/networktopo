import { memo } from 'react'
import {
  BaseEdge,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  EdgeLabelRenderer,
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
  const customStrokeWidth = edgeData.strokeWidth ?? 3.5
  const defaultColor = isFiber ? 'var(--color-edge-fiber)' : 'var(--color-edge-ethernet)'
  const customColor = edgeData.strokeColor || defaultColor
  const effectColor = edgeData.effectColor || 'var(--color-edge-effect)'
  const animSpeed = edgeData.animSpeed ?? 2
  const baseParticleSize = edgeData.particleSize ?? 4.5
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
  const strokeDasharray = isFiber ? '12 6' : 'none'

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

      {/* Bandwidth label — centered on the edge */}
      {edgeData.bandwidth && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-2xs bg-surface/90 px-1 py-0.5 rounded border border-border text-text-secondary pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {edgeData.bandwidth}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Source port label — near source end */}
      {edgeData.sourcePort && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-2xs px-1 py-0.5 rounded border font-mono pointer-events-none"
            style={{
              backgroundColor: 'var(--color-port-source-bg)',
              color: 'var(--color-port-source-text)',
              borderColor: 'var(--color-port-source-border)',
              transform: `translate(-50%, -50%) translate(${srcPortX}px, ${srcPortY}px)`,
            }}
          >
            {edgeData.sourcePort}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Target port label — near target end */}
      {edgeData.targetPort && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-2xs px-1 py-0.5 rounded border font-mono pointer-events-none"
            style={{
              backgroundColor: 'var(--color-port-target-bg)',
              color: 'var(--color-port-target-text)',
              borderColor: 'var(--color-port-target-border)',
              transform: `translate(-50%, -50%) translate(${tgtPortX}px, ${tgtPortY}px)`,
            }}
          >
            {edgeData.targetPort}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(AnimatedEdge)
