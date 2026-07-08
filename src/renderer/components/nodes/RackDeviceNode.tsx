import { useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { t } from '../../i18n'
import { type NodeProps } from '@xyflow/react'
import type { RackDeviceNodeData } from '../../types'
import { U_PX_HEIGHT, RACK_HEADER_H, RACK_RAIL_W, RACK_FRONT_W, RACK_BACK_W } from '../../utils/rackUtils'

// ── Category Colors (same as DeviceNode) ──────────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; accent: string; light: string }> = {
  '防火墙':     { bg: 'var(--color-cat-firewall-bg)', border: 'var(--color-cat-firewall-border)', accent: 'var(--color-cat-firewall-accent)', light: 'var(--color-cat-firewall-light)' },
  '交换机':     { bg: 'var(--color-cat-switch-bg)',   border: 'var(--color-cat-switch-border)',   accent: 'var(--color-cat-switch-accent)',   light: 'var(--color-cat-switch-light)' },
  '无线控制器': { bg: 'var(--color-cat-ac-bg)',       border: 'var(--color-cat-ac-border)',       accent: 'var(--color-cat-ac-accent)',       light: 'var(--color-cat-ac-light)' },
  '无线接入点': { bg: 'var(--color-cat-ap-bg)',       border: 'var(--color-cat-ap-border)',       accent: 'var(--color-cat-ap-accent)',       light: 'var(--color-cat-ap-light)' },
  '服务器':     { bg: 'var(--color-cat-server-bg)',   border: 'var(--color-cat-server-border)',   accent: 'var(--color-cat-server-accent)',   light: 'var(--color-cat-server-light)' },
  '终端-PC':   { bg: 'var(--color-cat-pc-bg)',       border: 'var(--color-cat-pc-border)',       accent: 'var(--color-cat-pc-accent)',       light: 'var(--color-cat-pc-light)' },
  '终端-笔记本': { bg: 'var(--color-cat-laptop-bg)',   border: 'var(--color-cat-laptop-border)',   accent: 'var(--color-cat-laptop-accent)',   light: 'var(--color-cat-laptop-light)' },
  '配线架':     { bg: 'var(--color-cat-patch-bg)',    border: 'var(--color-cat-patch-border)',    accent: 'var(--color-cat-patch-accent)',    light: 'var(--color-cat-patch-light)' },
  '超融合':     { bg: 'var(--color-cat-hyper-bg)',    border: 'var(--color-cat-hyper-border)',    accent: 'var(--color-cat-hyper-accent)',    light: 'var(--color-cat-hyper-light)' },
  '存储':       { bg: 'var(--color-cat-storage-bg)',  border: 'var(--color-cat-storage-border)',  accent: 'var(--color-cat-storage-accent)',  light: 'var(--color-cat-storage-light)' },
  '运营商光猫': { bg: 'var(--color-cat-ont-bg)',      border: 'var(--color-cat-ont-border)',      accent: 'var(--color-cat-ont-accent)',      light: 'var(--color-cat-ont-light)' },
  'SDWAN':      { bg: 'var(--color-cat-sdwan-bg)', border: 'var(--color-cat-sdwan-border)', accent: 'var(--color-cat-sdwan-accent)', light: 'var(--color-cat-sdwan-light)' },
}
const DEFAULT_COLOR = { bg: 'var(--color-cat-default-bg)', border: 'var(--color-cat-default-border)', accent: 'var(--color-cat-default-accent)', light: 'var(--color-cat-default-light)' }

// ── Category Icon Map ─────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  'firewall': '🛡️', 'switch': '🔀', 'ac': '📡', 'ap': '📶',
  'server': '🖥️', 'pc': '🖥️', 'laptop': '💻',
  'patch-panel': '🔌', 'hyper-converged': '🗄️', 'storage': '💾', 'ont': '📟',
  'sdwan': '🔷',
}

function getCategoryIcon(iconName: string): string {
  return CATEGORY_ICONS[iconName] || '📦'
}

// ── Power Supply Visual SVG ───────────────────────────────

/** Render power supply blocks for the back panel */
function PowerSupplyBlocks({ count, maxWidth, height }: { count: number; maxWidth: number; height: number }) {
  const actualCount = Math.max(0, Math.min(count, 4))
  if (actualCount === 0) {
    return (
      <text x={maxWidth / 2} y={height / 2 + 4} textAnchor="middle"
        fill="var(--color-text-secondary)" fontSize={11} fontFamily="system-ui">
        {t('propertyPanel.noPSU')}
      </text>
    )
  }

  const blockW = Math.min(56, (maxWidth - 16) / actualCount - 8)
  const blockH = Math.min(48, height - 24)
  const totalW = actualCount * (blockW + 8) - 8
  const startX = (maxWidth - totalW) / 2
  const startY = (height - blockH) / 2

  return (
    <g>
      {Array.from({ length: actualCount }, (_, i) => (
        <g key={i}>
          {/* PSU body */}
          <rect
            x={startX + i * (blockW + 8)}
            y={startY}
            width={blockW}
            height={blockH}
            rx={3}
            fill="var(--color-rack-psu-bg)"
            stroke="var(--color-rack-psu-stroke)"
            strokeWidth={1}
          />
          {/* PSU indicator LED */}
          <circle
            cx={startX + i * (blockW + 8) + blockW - 8}
            cy={startY + 8}
            r={3}
            fill="var(--color-rack-psu-led)"
          />
          {/* PSU label */}
          <text
            x={startX + i * (blockW + 8) + blockW / 2}
            y={startY + blockH / 2 + 5}
            textAnchor="middle"
            fill="var(--color-text-primary)"
            fontSize={10}
            fontWeight={600}
            fontFamily="system-ui"
          >
            PSU{i + 1}
          </text>
          {/* AC inlet icon */}
          <rect
            x={startX + i * (blockW + 8) + blockW / 2 - 6}
            y={startY + blockH - 14}
            width={12}
            height={7}
            rx={1}
            fill="var(--color-rack-psu-inlet)"
            stroke="var(--color-rack-psu-stroke)"
            strokeWidth={0.5}
          />
        </g>
      ))}
    </g>
  )
}

// ── RackDeviceNode ────────────────────────────────────────

const RackDeviceNode = function RackDeviceNode({ id, data, selected, parentId }: NodeProps) {
  const nodeData = data as unknown as RackDeviceNodeData
  const { device, uHeight, customName, customColor, powerSupplyCount } = nodeData
  const { t } = useTranslation()

  // ── DEBUG: render cycle tracking ──────────────────────
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  if (renderCountRef.current <= 5 || renderCountRef.current % 10 === 0) {
    console.log(`[DEBUG RackDeviceNode] render #${renderCountRef.current} — id: ${id}, parentViewMode: ${nodeData.parentViewMode}`)
  }
  if (renderCountRef.current > 100) {
    console.error(`[DEBUG RackDeviceNode] ⚠️ RENDER LOOP DETECTED! ${renderCountRef.current} renders for ${id}`)
  }

  const [isHovered, setIsHovered] = useState(false)

  // ── Read parent rack viewMode from own data (synced by onNodeDoubleClick) ──
  const rackViewMode = nodeData.parentViewMode ?? 'front'

  // ── Compute dimensions ──────────────────────────────────
  const isFront = rackViewMode === 'front'
  const rackW = isFront ? RACK_FRONT_W : RACK_BACK_W
  const nodeWidth = rackW - RACK_RAIL_W - 12  // fill rack content area
  const nodeHeight = uHeight * U_PX_HEIGHT

  // ── Category display ────────────────────────────────────
  const categoryName = customName || device.category_name || '交换机'
  const vendorName = device.vendor_name || ''
  const colors = CATEGORY_COLORS[categoryName] || DEFAULT_COLOR
  const displayName = customName || device.model
  const categoryIcon = getCategoryIcon(device.category_name || 'switch')

  // ── U position (1-based) computed from node position ─────
  // nodeData.uPosition is set by App.tsx when the node is created/moved;
  // fall back to computing from the React Flow internal position (relative to parent)
  const uDisplay = nodeData.uPosition ?? 1

  // ── Power supply count (default 1, min 0, max 4) ────────
  const psuCount = powerSupplyCount ?? 1

  // ── Handle mouse events ─────────────────────────────────
  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  // ── Shared border/selection styling ─────────────────────
  const borderStyle = selected
    ? '2px solid var(--color-edge-selected)'
    : `1px solid ${colors.border}`
  const shadowStyle = selected
    ? 'var(--color-node-shadow-selected)'
    : '0 1px 2px rgba(0,0,0,0.06)'

  // ═══════════════════════════════════════════════════════════
  // FRONT MODE: Device Faceplate (机柜正面)
  // ═══════════════════════════════════════════════════════════
  if (isFront) {
    return (
      <div
        className="rack-device-faceplate"
        style={{
          width: nodeWidth,
          height: nodeHeight,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 3,
          border: borderStyle,
          backgroundColor: 'var(--color-surface)',
          boxShadow: shadowStyle,
          cursor: 'default',
          overflow: 'hidden',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Category color stripe */}
        <div style={{
          width: 4,
          height: '100%',
          backgroundColor: colors.accent,
          flexShrink: 0,
        }} />

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '2px 8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minWidth: 0,
        }}>
          {/* Top row: icon + name */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}>
            <span style={{ fontSize: 12 }}>{categoryIcon}</span>
            <span className="truncate">{displayName}</span>
          </div>
          {/* Bottom row: vendor + model + U badge */}
          {nodeHeight >= 40 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 9,
              color: 'var(--color-text-secondary)',
              marginTop: 1,
            }}>
              <span className="truncate">{vendorName}{vendorName && device.model ? ` · ${device.model}` : device.model}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {/* U position indicator */}
                <span style={{
                  backgroundColor: 'var(--color-select-bg)',
                  color: 'var(--color-select-border)',
                  padding: '0 4px',
                  borderRadius: 2,
                  fontWeight: 700,
                  fontSize: 8,
                }}>
                  U{uDisplay}
                </span>
                {/* U height badge */}
                <span style={{
                  backgroundColor: colors.light,
                  color: colors.accent,
                  padding: '0 4px',
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: 8,
                }}>{uHeight}U</span>
              </div>
            </div>
          )}
          {/* Single-line for very small devices (1U) */}
          {nodeHeight < 40 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              marginTop: 1,
            }}>
              <span style={{
                backgroundColor: 'var(--color-select-bg)',
                color: 'var(--color-select-border)',
                padding: '0 3px',
                borderRadius: 2,
                fontWeight: 700,
                fontSize: 7,
                flexShrink: 0,
              }}>
                U{uDisplay}
              </span>
              <span style={{
                backgroundColor: colors.light,
                color: colors.accent,
                padding: '0 3px',
                borderRadius: 2,
                fontWeight: 600,
                fontSize: 7,
                flexShrink: 0,
              }}>{uHeight}U</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // BACK MODE: Device Rear Panel (机柜背面)
  // ═══════════════════════════════════════════════════════════
  const svgW = Math.max(140, nodeWidth - 24)
  const svgH = Math.max(60, nodeHeight - 30)

  return (
    <div
      className="rack-device-back"
      style={{
        width: nodeWidth,
        height: nodeHeight,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        border: borderStyle,
        backgroundColor: 'var(--color-surface)',
        boxShadow: shadowStyle,
        cursor: 'default',
        overflow: 'hidden',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        backgroundColor: customColor || colors.light,
        borderBottom: `1px solid ${colors.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10 }}>{categoryIcon}</span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{displayName}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{
            fontSize: 8,
            color: 'var(--color-text-secondary)',
            backgroundColor: colors.bg,
            padding: '1px 4px',
            borderRadius: 2,
          }}>
            U{uDisplay}
          </span>
          <span style={{
            fontSize: 8,
            color: 'var(--color-text-secondary)',
            backgroundColor: colors.bg,
            padding: '1px 4px',
            borderRadius: 2,
          }}>
            {uHeight}U
          </span>
        </div>
      </div>

      {/* Power supply visualization area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 8px',
        minHeight: 0,
      }}>
        {nodeHeight >= 40 ? (
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ display: 'block' }}
          >
            {/* Rear panel background */}
            <rect x={1} y={1} width={svgW - 2} height={svgH - 2} rx={3}
              fill="var(--color-rack-back-bg)" stroke="var(--color-border)" strokeWidth={0.5} />

            {/* Power supply blocks */}
            <PowerSupplyBlocks count={psuCount} maxWidth={svgW} height={svgH} />

            {/* Section label */}
            <text x={8} y={12} fill="var(--color-text-secondary)" fontSize={7} fontFamily="system-ui">
              {t('propertyPanel.psuModule')}
            </text>
          </svg>
        ) : (
          /* Compact back for 1U devices */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 9,
            color: 'var(--color-text-secondary)',
          }}>
            <span>🔌</span>
            <span>{t('propertyPanel.psuCountLabel', { n: psuCount })}</span>
          </div>
        )}
      </div>

      {/* Footer info bar */}
      {nodeHeight >= 40 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 8px',
          borderTop: '1px solid var(--color-border)',
          fontSize: 8,
          color: 'var(--color-text-secondary)',
          flexShrink: 0,
        }}>
          <span>{vendorName} {device.model}</span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
            🔌 {t('propertyPanel.psuCountLabel', { n: psuCount })}
          </span>
        </div>
      )}
    </div>
  )
}

export default RackDeviceNode
