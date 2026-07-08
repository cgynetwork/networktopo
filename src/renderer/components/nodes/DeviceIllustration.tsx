import { useTranslation } from 'react-i18next'
import { t } from '../../i18n'
import { parsePortsInfo, getPortLayout, type RenderedPort } from '../../utils/portParser'
import type { AppImageItem } from '../../types'

// ── Constants ──────────────────────────────────────────────────

/** Default SVG height — used when no explicit height is specified */
export const SVG_H_DEFAULT = 144

/** Minimum SVG height */
const SVG_H_MIN = 100

/** Port height categories */
const PORT_H_SMALL = 16   // copper RJ45
const PORT_H_MEDIUM = 18  // fiber SFP
const PORT_H_LARGE = 20   // QSFP

function getPortHeight(cat: RenderedPort['category']): number {
  switch (cat) {
    case 'qsfp': return PORT_H_LARGE
    case 'tenG': return PORT_H_MEDIUM
    case 'sfp':  return PORT_H_MEDIUM
    default:     return PORT_H_SMALL
  }
}

// ── V0.8.0: Shared device layout parameters ─────────────────────

/** Layout geometry for a device chassis, shared between SVG rendering and handle positioning */
export interface DeviceLayoutParams {
  bodyY: number
  bodyH: number
  panelX: number           // left-panel offset (0 for switch/server, >0 for firewall/AC)
  portPanelSvgW: number    // effective svgW passed to PortPanel (differs for AP)
  portPanelBodyY: number   // effective bodyY passed to PortPanel (differs for AP/server)
}

/**
 * Return the chassis layout parameters for a given device category.
 * These values MUST stay in sync with the corresponding SVG variant rendering.
 */
export function getDeviceLayoutParams(categoryName: string, svgW: number, svgH: number): DeviceLayoutParams {
  switch (categoryName) {
    case '交换机':
      return { bodyY: 8, bodyH: svgH - 16, panelX: 0, portPanelSvgW: svgW, portPanelBodyY: 8 }
    case '防火墙': {
      const leftPanelW = Math.round(svgW * 0.18)
      return { bodyY: 8, bodyH: svgH - 16, panelX: leftPanelW + 4, portPanelSvgW: svgW - leftPanelW - 4, portPanelBodyY: 8 }
    }
    case '无线控制器': {
      const leftPanelW = Math.round(svgW * 0.18)
      return { bodyY: 8, bodyH: svgH - 16, panelX: leftPanelW + 4, portPanelSvgW: svgW - leftPanelW - 4, portPanelBodyY: 8 }
    }
    case '无线接入点': {
      const bodyY = Math.round(svgH * 0.12)
      const bodyH = svgH - bodyY * 2
      const bodyW = Math.round(svgW * 0.64)
      const bodyX = Math.round(svgW * 0.18)
      return { bodyY, bodyH, panelX: bodyX, portPanelSvgW: bodyW, portPanelBodyY: bodyY + 18 }
    }
    case '服务器': {
      const rightPanelW = Math.round(svgW * 0.30)
      return { bodyY: 8, bodyH: svgH - 16, panelX: 0, portPanelSvgW: svgW - rightPanelW - 4, portPanelBodyY: 8 }
    }
    // V0.9.3: PC terminal — tower chassis with ports at bottom
    case '终端-PC': {
      const bodyW = Math.round(svgW * 0.72)
      const bodyX = (svgW - bodyW) / 2
      return { bodyY: 66, bodyH: svgH - 74, panelX: bodyX, portPanelSvgW: bodyW, portPanelBodyY: 66 }
    }
    // V0.9.3: Laptop terminal — ports on base
    case '终端-笔记本': {
      const lidH = Math.round(svgH * 0.55)
      const baseY = lidH + 14
      return { bodyY: baseY, bodyH: svgH - baseY - 8, panelX: 0, portPanelSvgW: svgW - 16, portPanelBodyY: baseY + 4 }
    }
    // V1.2.0: SDWAN — layout depends on device type (cloud vs appliance)
    case 'SDWAN':
      // Cloud-type SDWAN devices (no ports): full-SVG body, no panel offset
      return { bodyY: 0, bodyH: svgH, panelX: 0, portPanelSvgW: svgW, portPanelBodyY: 0 }
    default:
      return { bodyY: 8, bodyH: svgH - 16, panelX: 0, portPanelSvgW: svgW, portPanelBodyY: 8 }
  }
}

/** CSS variable names for port fill/stroke by category */
function getPortColors(cat: RenderedPort['category']): { fill: string; stroke: string } {
  switch (cat) {
    case 'copper':
      return { fill: 'var(--color-port-copper-fill)', stroke: 'var(--color-port-copper-stroke)' }
    case 'sfp':
      return { fill: 'var(--color-port-sfp-fill)', stroke: 'var(--color-port-sfp-stroke)' }
    case 'tenG':
      return { fill: 'var(--color-port-teng-fill)', stroke: 'var(--color-port-teng-stroke)' }
    case 'qsfp':
      return { fill: 'var(--color-port-qsfp-fill)', stroke: 'var(--color-port-qsfp-stroke)' }
    case 'mgmt':
      return { fill: 'var(--color-port-mgmt-fill)', stroke: 'var(--color-port-mgmt-stroke)' }
    case 'wlan':
      return { fill: 'var(--color-port-wlan-fill)', stroke: 'var(--color-port-wlan-stroke)' }
  }
}

// ── Port rendering ─────────────────────────────────────────────

/** Render a single port with label and LED indicator */
function PortRect({ port, isUsed }: { port: RenderedPort; isUsed?: boolean }) {
  const colors = getPortColors(port.category)
  const h = port.height  // use layout-computed height for proper vertical fit
  const y = port.y
  const fontSize = h >= 18 ? 4.5 : 4

  return (
    <g>
      {/* Port body */}
      <rect
        x={port.x}
        y={y}
        width={port.width}
        height={h}
        rx={1.5}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={0.6}
      />
      {/* Port label with sequential numbering — e.g. GE1, GE2, SFP1 */}
      <text
        x={port.x + port.width / 2}
        y={y + h / 2 + 1.5}
        fontSize={fontSize}
        fill="var(--color-port-label-text)"
        textAnchor="middle"
        fontFamily="'Microsoft YaHei', sans-serif"
        fontWeight={500}
      >
        {port.category === 'wlan' ? 'WLAN' : `${port.typeLabel}${port.portIndex}`}
      </text>
      {/* LED indicator — left side: green when connected, dim otherwise */}
      <circle
        cx={port.x + 2.5}
        cy={y + 2.5}
        r={1}
        fill={isUsed ? 'var(--color-port-led-link)' : 'var(--color-device-body-stroke)'}
        opacity={isUsed ? 1 : 0.5}
      />
      {/* LED indicator — right side (activity), skip for mgmt and wlan */}
      {port.category !== 'mgmt' && port.category !== 'wlan' && (
        <circle
          cx={port.x + port.width - 2.5}
          cy={y + 2.5}
          r={1}
          fill="var(--color-port-led-activity)"
          opacity={isUsed ? 1 : 0.6}
        />
      )}
    </g>
  )
}

/** Render the full port panel from parsed groups or precomputed ports */
function PortPanel({ portsInfo, ports: precomputedPorts, usedPorts, svgW, bodyH, bodyY, panelX = 0 }: {
  portsInfo: string
  ports?: RenderedPort[]
  usedPorts?: Set<string>
  svgW: number
  bodyH: number
  bodyY: number
  panelX?: number
}) {
  // Available height for ports: body height minus top bezel (~10px) and padding
  const availableH = Math.max(40, bodyH - 12)

  // Use precomputed ports when provided (avoids double-computation in DeviceNode)
  const ports = precomputedPorts ?? getPortLayout(parsePortsInfo(portsInfo), svgW - 24, availableH).ports

  if (ports.length === 0) {
    // Empty port panel — show blank faceplate
    return (
      <rect
        x={12 + panelX}
        y={bodyY + 6}
        width={svgW - 24}
        height={availableH}
        rx={3}
        fill="var(--color-device-secondary)"
        stroke="var(--color-device-body-stroke)"
        strokeWidth={0.5}
        strokeDasharray="3 2"
      />
    )
  }

  return (
    <g transform={`translate(${panelX}, ${bodyY + 6})`}>
      {ports.map((port, i) => {
        const portLabel = `${port.typeLabel}${port.portIndex}`
        return <PortRect key={`port-${i}`} port={port} isUsed={usedPorts?.has(portLabel)} />
      })}
    </g>
  )
}

// ── Chassis decorations ────────────────────────────────────────

/** Screw holes at corners of the chassis */
function ScrewHoles({ svgW, svgH }: { svgW: number; svgH: number }) {
  return (
    <g>
      {[
        [10, 10],
        [svgW - 10, 10],
        [10, svgH - 10],
        [svgW - 10, svgH - 10],
      ].map(([cx, cy], i) => (
        <g key={`screw-${i}`}>
          <circle cx={cx} cy={cy} r={3} fill="var(--color-device-secondary)" stroke="var(--color-device-body-stroke)" strokeWidth={0.5} />
          <line x1={cx - 1.2} y1={cy - 1.2} x2={cx + 1.2} y2={cy + 1.2} stroke="var(--color-device-body-stroke)" strokeWidth={0.4} />
        </g>
      ))}
    </g>
  )
}

/** LED status array at the top of the chassis */
function StatusLEDs({ svgW, accent }: { svgW: number; accent: string }) {
  const ledCount = Math.min(16, Math.floor((svgW - 32) / 14))
  const startX = (svgW - ledCount * 14) / 2
  return (
    <g>
      {Array.from({ length: ledCount }).map((_, i) => (
        <rect
          key={`led-${i}`}
          x={startX + i * 14}
          y="4"
          width="3"
          height="1.5"
          rx="0.5"
          fill={i % 3 === 0 ? accent : 'var(--color-device-led-green)'}
        />
      ))}
    </g>
  )
}

// ── Per-category enhanced SVGs ─────────────────────────────────

function SwitchSvg({ accent, portsInfo, ports, usedPorts, svgW, svgH, isStacked }: {
  accent: string; portsInfo: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number; isStacked?: boolean
}) {
  const { bodyY, bodyH, panelX, portPanelSvgW, portPanelBodyY } = getDeviceLayoutParams('交换机', svgW, svgH)
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sw-body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-device-body)" />
          <stop offset="100%" stopColor="var(--color-device-secondary)" />
        </linearGradient>
      </defs>
      {/* Chassis */}
      <rect x="4" y={bodyY} width={svgW - 8} height={bodyH} rx="4" fill="url(#sw-body-grad)" stroke="var(--color-device-body-stroke)" strokeWidth="1.5" />
      {/* Front bezel accent line */}
      <rect x="4" y={bodyY} width={svgW - 8} height="4" rx="4" fill={accent} opacity="0.6" />
      <ScrewHoles svgW={svgW} svgH={svgH} />
      <StatusLEDs svgW={svgW} accent={accent} />
      {/* Ports */}
      <PortPanel portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={portPanelSvgW} bodyH={bodyH} bodyY={portPanelBodyY} panelX={panelX} />
      {/* V0.9.0: STACK port */}
      {isStacked && <StackPort panelX={panelX} panelBodyW={portPanelSvgW} bodyY={bodyY} bodyH={bodyH} />}
    </svg>
  )
}

function FirewallSvg({ accent, portsInfo, ports, usedPorts, svgW, svgH, isStacked }: {
  accent: string; portsInfo: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number; isStacked?: boolean
}) {
  const { bodyY, bodyH, panelX, portPanelSvgW, portPanelBodyY } = getDeviceLayoutParams('防火墙', svgW, svgH)
  const leftPanelW = Math.round(svgW * 0.18)

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fw-body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-device-body)" />
          <stop offset="100%" stopColor="var(--color-device-secondary)" />
        </linearGradient>
      </defs>
      {/* Chassis */}
      <rect x="4" y={bodyY} width={svgW - 8} height={bodyH} rx="4" fill="url(#fw-body-grad)" stroke="var(--color-device-body-stroke)" strokeWidth="1.5" />
      {/* Left panel — security zone */}
      <rect x="4" y={bodyY} width={leftPanelW} height={bodyH} rx="4" fill={accent} opacity="0.35" />
      {/* Shield icon */}
      <path
        d={`M${leftPanelW / 2 + 4} ${bodyY + 16} L${leftPanelW / 2 + 12} ${bodyY + 20} L${leftPanelW / 2 + 12} ${bodyY + 34} C${leftPanelW / 2 + 12} ${bodyY + 42} ${leftPanelW / 2 + 4} ${bodyY + 46} ${leftPanelW / 2 + 4} ${bodyY + 46} C${leftPanelW / 2 + 4} ${bodyY + 46} ${leftPanelW / 2 - 4} ${bodyY + 42} ${leftPanelW / 2 - 4} ${bodyY + 34} L${leftPanelW / 2 - 4} ${bodyY + 20} Z`}
        fill={accent} opacity="0.9"
      />
      {/* Status LEDs under shield */}
      {[bodyY + 54, bodyY + 60, bodyY + 66].map((ly, i) => (
        <circle key={`fw-led-${i}`} cx={leftPanelW / 2 + 4} cy={ly} r="2" fill={i === 0 ? 'var(--color-device-led-green)' : accent} />
      ))}
      <ScrewHoles svgW={svgW} svgH={svgH} />
      <StatusLEDs svgW={svgW} accent={accent} />
      {/* Port zone — offset by left panel width */}
      <PortPanel portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={portPanelSvgW} bodyH={bodyH} bodyY={portPanelBodyY} panelX={panelX} />
      {/* V0.9.0: STACK port */}
      {isStacked && <StackPort panelX={panelX} panelBodyW={portPanelSvgW} bodyY={bodyY} bodyH={bodyH} />}
    </svg>
  )
}

function AcSvg({ accent, portsInfo, ports, usedPorts, svgW, svgH, isStacked }: {
  accent: string; portsInfo: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number; isStacked?: boolean
}) {
  const { bodyY, bodyH, panelX, portPanelSvgW, portPanelBodyY } = getDeviceLayoutParams('无线控制器', svgW, svgH)
  const leftPanelW = Math.round(svgW * 0.18)

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ac-body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-device-body)" />
          <stop offset="100%" stopColor="var(--color-device-secondary)" />
        </linearGradient>
      </defs>
      {/* Chassis */}
      <rect x="4" y={bodyY} width={svgW - 8} height={bodyH} rx="4" fill="url(#ac-body-grad)" stroke="var(--color-device-body-stroke)" strokeWidth="1.5" />
      <rect x="4" y={bodyY} width={leftPanelW} height={bodyH} rx="4" fill={accent} opacity="0.25" />
      {/* Wireless signal arcs */}
      <g transform={`translate(${leftPanelW / 2 + 4}, ${bodyY + 30})`}>
        <path d="M-14 0 Q0 -12 14 0" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        <path d="M-10 5 Q0 -5 10 5" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <path d="M-6 10 Q0 2 6 10" fill="none" stroke={accent} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
        <circle cx="0" cy="14" r="2.5" fill={accent} opacity="0.6" />
      </g>
      <ScrewHoles svgW={svgW} svgH={svgH} />
      <StatusLEDs svgW={svgW} accent={accent} />
      <PortPanel portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={portPanelSvgW} bodyH={bodyH} bodyY={portPanelBodyY} panelX={panelX} />
      {/* V0.9.0: STACK port */}
      {isStacked && <StackPort panelX={panelX} panelBodyW={portPanelSvgW} bodyY={bodyY} bodyH={bodyH} />}
    </svg>
  )
}

function ApSvg({ accent, portsInfo, ports, usedPorts, svgW, svgH, isStacked }: {
  accent: string; portsInfo: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number; isStacked?: boolean
}) {
  const { bodyY, bodyH, panelX, portPanelSvgW, portPanelBodyY } = getDeviceLayoutParams('无线接入点', svgW, svgH)
  const bodyX = Math.round(svgW * 0.18)
  const bodyW = Math.round(svgW * 0.64)

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ap-glow" cx="50%" cy="30%" r="40%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.15" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Signal glow */}
      <ellipse cx={svgW / 2} cy={bodyY + bodyH / 2} rx={bodyW * 0.7} ry={bodyH * 0.6} fill="url(#ap-glow)" />
      {/* Mounting bracket */}
      <rect x={svgW / 2 - 14} y="2" width="28" height="12" rx="3" fill="var(--color-device-body-stroke)" />
      {/* Main body */}
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx="8" fill="var(--color-device-body)" stroke="var(--color-device-body-stroke)" strokeWidth="1.5" />
      {/* Antennas */}
      {[bodyX + 19, bodyX + bodyW - 19].map((ax) => (
        <g key={`ant-${ax}`}>
          <path d={`M${ax} ${bodyY + 8} Q${ax - 5} ${bodyY - 2} ${ax} ${bodyY - 6}`} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <path d={`M${ax + 4} ${bodyY + 6} Q${ax + 10} ${bodyY - 4} ${ax + 4} ${bodyY - 8}`} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        </g>
      ))}
      {/* LED strip */}
      <rect x={bodyX + 14} y={bodyY + 12} width={bodyW - 28} height="3" rx="1" fill={accent} opacity="0.4" />
      {/* Downlink ports */}
      <PortPanel portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={portPanelSvgW} bodyH={bodyH - 18} bodyY={portPanelBodyY} panelX={panelX} />
      {/* V0.9.0: STACK port — centered on AP body */}
      {isStacked && <StackPort panelX={bodyX} panelBodyW={bodyW} bodyY={bodyY} bodyH={bodyH} />}
    </svg>
  )
}

function ServerSvg({ accent, portsInfo, ports, usedPorts, svgW, svgH, isStacked }: {
  accent: string; portsInfo: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number; isStacked?: boolean
}) {
  const { bodyY, bodyH, panelX, portPanelSvgW, portPanelBodyY } = getDeviceLayoutParams('服务器', svgW, svgH)
  const rightPanelW = Math.round(svgW * 0.30)
  const rightPanelX = svgW - rightPanelW - 4
  const driveBayW = Math.round(svgW * 0.32)

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sv-body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-device-body)" />
          <stop offset="100%" stopColor="var(--color-device-secondary)" />
        </linearGradient>
      </defs>
      {/* Chassis */}
      <rect x="4" y={bodyY} width={svgW - 8} height={bodyH} rx="4" fill="url(#sv-body-grad)" stroke="var(--color-device-body-stroke)" strokeWidth="1.5" />
      <ScrewHoles svgW={svgW} svgH={svgH} />
      {/* Front bezel — drive bays on left */}
      <rect x="9" y={bodyY + 8} width={driveBayW} height={bodyH - 16} rx="2" fill="var(--color-device-secondary)" stroke="var(--color-device-body-stroke)" strokeWidth="0.5" />
      {/* Drive slots — scaled to fit available height */}
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 3 }).map((_, col) => (
          <rect
            key={`drive-${row}-${col}`}
            x={14 + col * Math.floor(driveBayW / 3.5)}
            y={bodyY + 14 + row * Math.floor((bodyH - 30) / 4)}
            width={Math.floor(driveBayW / 4)}
            height={Math.floor((bodyH - 30) / 5)}
            rx="2"
            fill="var(--color-device-body)"
            stroke="var(--color-device-body-stroke)"
            strokeWidth="0.5"
          />
        ))
      )}
      {/* Drive LEDs */}
      {Array.from({ length: 4 }).map((_, row) => (
        <g key={`drive-leds-${row}`}>
          <circle cx={9 + driveBayW + 6} cy={bodyY + 22 + row * Math.floor((bodyH - 30) / 4)} r="1.5" fill="var(--color-device-led-green)" />
        </g>
      ))}
      {/* Status panel */}
      <circle cx={driveBayW + 18} cy={bodyY + 14} r="2" fill="var(--color-device-led-green)" />
      <circle cx={driveBayW + 18} cy={bodyY + 21} r="2" fill={accent} />
      <circle cx={driveBayW + 18} cy={bodyY + 28} r="2" fill="var(--color-device-led-green)" />
      {/* PSU indicators */}
      <rect x={driveBayW + 24} y={bodyY + 8} width="28" height="8" rx="1" fill="var(--color-device-secondary)" stroke="var(--color-device-body-stroke)" strokeWidth="0.4" />
      <text x={driveBayW + 38} y={bodyY + 14} fontSize="4" fill="var(--color-port-label-text)" textAnchor="middle">PSU1</text>
      <rect x={driveBayW + 60} y={bodyY + 8} width="28" height="8" rx="1" fill="var(--color-device-secondary)" stroke="var(--color-device-body-stroke)" strokeWidth="0.4" />
      <text x={driveBayW + 74} y={bodyY + 14} fontSize="4" fill="var(--color-port-label-text)" textAnchor="middle">PSU2</text>
      {/* V0.9.3: Right-side NIC panel */}
      <rect x={rightPanelX} y={bodyY + 8} width={rightPanelW} height={bodyH - 16} rx="2"
        fill="var(--color-device-secondary)" stroke="var(--color-device-body-stroke)" strokeWidth="0.5" />
      {/* NIC label */}
      <text x={rightPanelX + rightPanelW / 2} y={bodyY + 18} fontSize="4.5"
        fill="var(--color-port-label-text)" textAnchor="middle"
        fontFamily="'Microsoft YaHei', sans-serif">NIC</text>
      {/* NIC slot indicators */}
      {Array.from({ length: 4 }).map((_, i) => (
        <rect key={`nic-slot-${i}`}
          x={rightPanelX + 4}
          y={bodyY + 24 + i * Math.floor((bodyH - 38) / 4)}
          width={rightPanelW - 8}
          height={Math.floor((bodyH - 38) / 5)}
          rx="1.5"
          fill="var(--color-device-body)"
          stroke="var(--color-device-body-stroke)"
          strokeWidth="0.4" />
      ))}
      {/* NIC ports area */}
      <PortPanel portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={portPanelSvgW} bodyH={bodyH} bodyY={portPanelBodyY} panelX={panelX} />
      {/* V0.9.0: STACK port */}
      {isStacked && <StackPort panelX={panelX} panelBodyW={portPanelSvgW} bodyY={bodyY} bodyH={bodyH} />}
    </svg>
  )
}

// ── V0.9.3: PC Terminal SVG ──────────────────────────────────────

function PcSvg({ accent, portsInfo, ports, usedPorts, svgW, svgH }: {
  accent: string; portsInfo: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number
}) {
  const { bodyY, bodyH, panelX, portPanelSvgW, portPanelBodyY } = getDeviceLayoutParams('终端-PC', svgW, svgH)
  const bodyW = Math.round(svgW * 0.72)
  const bodyX = (svgW - bodyW) / 2

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pc-body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-device-body)" />
          <stop offset="100%" stopColor="var(--color-device-secondary)" />
        </linearGradient>
      </defs>
      {/* Tower body */}
      <rect x={bodyX} y={bodyY - 52} width={bodyW} height={bodyH + 52} rx="6" fill="url(#pc-body-grad)" stroke="var(--color-device-body-stroke)" strokeWidth="1.5" />
      {/* Front bezel accent */}
      <rect x={bodyX} y={bodyY - 52} width={bodyW} height="5" rx="5" fill={accent} opacity="0.5" />
      {/* Power LED */}
      <circle cx={bodyX + 14} cy={bodyY - 40} r="2" fill="var(--color-device-led-green)" />
      {/* Drive bay indicator */}
      <rect x={bodyX + 10} y={bodyY - 30} width={bodyW - 20} height="6" rx="1.5" fill="var(--color-device-secondary)" stroke="var(--color-device-body-stroke)" strokeWidth="0.4" />
      {/* Wireless antenna icon — left side of tower */}
      <g transform={`translate(${bodyX + 24}, ${bodyY - 10})`}>
        <path d="M-8 0 Q0 -8 8 0" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M-5 4 Q0 -1 5 4" fill="none" stroke={accent} strokeWidth="1.3" strokeLinecap="round" opacity="0.65" />
        <path d="M-2 8 Q0 5 2 8" fill="none" stroke={accent} strokeWidth="1" strokeLinecap="round" opacity="0.35" />
      </g>
      {/* Ethernet/LAN icon — right side */}
      <g transform={`translate(${bodyX + bodyW - 24}, ${bodyY - 12})`}>
        <rect x="-5" y="-4" width="10" height="8" rx="1" fill="none" stroke="var(--color-device-body-stroke)" strokeWidth="1.2" />
        <line x1="-3" y1="-1" x2="3" y2="-1" stroke="var(--color-device-body-stroke)" strokeWidth="0.8" />
        <line x1="-3" y1="1" x2="3" y2="1" stroke="var(--color-device-body-stroke)" strokeWidth="0.8" />
        <line x1="-3" y1="3" x2="3" y2="3" stroke="var(--color-device-body-stroke)" strokeWidth="0.8" />
      </g>
      {/* Port area */}
      <PortPanel portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={portPanelSvgW} bodyH={bodyH} bodyY={portPanelBodyY} panelX={panelX} />
    </svg>
  )
}

// ── V0.9.3: Laptop Terminal SVG ──────────────────────────────────

function LaptopSvg({ accent, portsInfo, ports, usedPorts, svgW, svgH }: {
  accent: string; portsInfo: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number
}) {
  const { bodyY, bodyH, panelX, portPanelSvgW, portPanelBodyY } = getDeviceLayoutParams('终端-笔记本', svgW, svgH)
  const lidH = Math.round(svgH * 0.55)
  const lidW = Math.round(svgW * 0.72)
  const lidX = (svgW - lidW) / 2
  const baseY = lidH + 10
  const baseH = svgH - baseY - 8

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      {/* Lid/screen panel */}
      <rect x={lidX} y={6} width={lidW} height={lidH} rx="5" fill="var(--color-device-body)" stroke="var(--color-device-body-stroke)" strokeWidth="1.2" />
      {/* Screen bezel */}
      <rect x={lidX + 8} y={12} width={lidW - 16} height={lidH - 14} rx="2" fill="var(--color-surface)" stroke="var(--color-device-body-stroke)" strokeWidth="0.5" opacity="0.6" />
      {/* Camera dot */}
      <circle cx={svgW / 2} cy={10} r="1.2" fill="var(--color-device-body-stroke)" />
      {/* Hinge */}
      <rect x={lidX + 10} y={baseY - 3} width={lidW - 20} height="4" rx="1" fill="var(--color-device-body-stroke)" opacity="0.5" />
      {/* Base/body */}
      <rect x={lidX + 4} y={baseY} width={lidW - 8} height={baseH} rx="3" fill="url(#pc-body-grad)" stroke="var(--color-device-body-stroke)" strokeWidth="1.2" />
      {/* Accent strip */}
      <rect x={lidX + 4} y={baseY} width={lidW - 8} height="3" rx="3" fill={accent} opacity="0.4" />
      {/* Power LED */}
      <circle cx={lidX + 16} cy={baseY + 8} r="1.5" fill="var(--color-device-led-green)" />
      {/* Wireless icon on base */}
      <g transform={`translate(${lidX + 40}, ${baseY + 12})`}>
        <path d="M-5 0 Q0 -5 5 0" fill="none" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M-3 3 Q0 0 3 3" fill="none" stroke={accent} strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      </g>
      {/* Port area on base */}
      <PortPanel portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={portPanelSvgW} bodyH={baseH} bodyY={portPanelBodyY} panelX={panelX} />
    </svg>
  )
}

// ── V1.2.0: SDWAN Node SVG (cloud server) ────────────────────

/** Render a single connection-point circle pair (outer ring + inner dot) */
function CpDot({ cx, cy, accent }: { cx: number; cy: number; accent: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill={accent} stroke={accent} strokeWidth={1} opacity={0.8} />
      <circle cx={cx} cy={cy} r={1.5} fill="var(--color-surface)" />
    </g>
  )
}

/** Simple screw-hole dots (no cross-lines) matching preview style */
function ScrewDots({ positions, r }: { positions: [number, number][]; r: number }) {
  return (
    <g>
      {positions.map(([cx, cy], i) => (
        <circle key={`sd-${i}`} cx={cx} cy={cy} r={r} fill="var(--color-device-secondary)" stroke="var(--color-device-body-stroke)" strokeWidth={0.5} />
      ))}
    </g>
  )
}

function SdwanNodeSvg({ accent, svgW, svgH }: {
  accent: string; portsInfo?: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number; isStacked?: boolean
}) {
  // Icon path bounds: 1195×1024 from user design. Scale to fill SVG with proportional padding.
  const origW = 1195, origH = 1024
  const padX = Math.round(svgW * 0.16)    // 32/200 in preview
  const padY = Math.round(svgH * 0.11)    // 16/144 in preview
  const labelH = 10
  const scale = Math.min((svgW - padX * 2) / origW, (svgH - padY - labelH) / origH)
  const tx = (svgW - origW * scale) / 2
  const ty = padY + (svgH - padY - labelH - origH * scale) / 2

  // CP positions: 15%/85% width, 50% height (from preview)
  const cpLX = Math.round(svgW * 0.15)
  const cpRX = Math.round(svgW * 0.85)
  const cpY = Math.round(svgH * 0.50)

  // Screw holes: 19%/81% width, 15%/90% height (from preview)
  const shR = Math.max(1.5, Math.round(svgW * 0.01))
  const shPositions: [number, number][] = [
    [Math.round(svgW * 0.19), Math.round(svgH * 0.15)],
    [Math.round(svgW * 0.81), Math.round(svgH * 0.15)],
    [Math.round(svgW * 0.19), Math.round(svgH * 0.90)],
    [Math.round(svgW * 0.81), Math.round(svgH * 0.90)],
  ]

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      {/* SD-WAN cloud node icon — user-provided path data */}
      <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
        <path d="M935.1 810.8h-16.1a21.6 21.6 0 0 1 0-42.7h17.9a213.2 213.2 0 0 0 216.9-209.1 210 210 0 0 0-146.1-197.6 20.2 20.2 0 0 1-14.2-22.5v-29.4a261 261 0 0 0-34.5-129.1 21.6 21.6 0 0 1 6-28.9 22.1 22.1 0 0 1 28.9 7.8 303.7 303.7 0 0 1 40 150.3v17.5a251.8 251.8 0 0 1 160.8 232 256.4 256.4 0 0 1-259.6 251.8zM275.7 810.8h-16.1a261 261 0 0 1-158.1-51.9 21.1 21.1 0 0 1-4.6-29.9 22.1 22.1 0 0 1 29.9-4.6 220.1 220.1 0 0 0 132.8 46h16.1a21.6 21.6 0 0 1 0 42.7zM56.5 701a20.2 20.2 0 0 1-17.9-11.5 243.1 243.1 0 0 1-38.6-130.5 250 250 0 0 1 159-229.8 178.3 178.3 0 0 1 180.1-175.5 183.8 183.8 0 0 1 89.1 23 317.1 317.1 0 0 1 115.3-127.3 328.1 328.1 0 0 1 321.7-13.8 21.1 21.1 0 0 1 9.2 28.5 21.6 21.6 0 0 1-28.9 9.2 281.7 281.7 0 0 0-128.7-30.3 275.7 275.7 0 0 0-136.4 36.3 21.1 21.1 0 0 1-16.1 13.8 21.6 21.6 0 0 1-18.8-3.7 137.9 137.9 0 0 0-85.5-28.9 135.1 135.1 0 0 0-137.9 132.3 108.4 108.4 0 0 0 0 11.5 20.7 20.7 0 0 1-14.2 21.6 210 210 0 0 0-144.3 196.2 204.9 204.9 0 0 0 31.7 109.4 19.3 19.3 0 0 1 2.8 15.6 22.5 22.5 0 0 1-9.2 13.8 25.3 25.3 0 0 1-11.5 3.2zM924.5 124.7a21.6 21.6 0 0 1-21.6-21.6 22.5 22.5 0 0 1 6-14.2 22.5 22.5 0 0 1 30.3 0 21.6 21.6 0 0 1 6.4 15.2 21.1 21.1 0 0 1-21.1 22.1z" fill={accent} fillOpacity={0.9} />
        <path d="M597.4 523.1a250.4 250.4 0 1 0 250.4 250 250.4 250.4 0 0 0-250.4-250zm0 464.6a214.6 214.6 0 1 1 214.6-214.6 214.6 214.6 0 0 1-214.6 214.6z" fill={accent} fillOpacity={0.65} />
        <path d="M597.4 559a212.3 212.3 0 0 0-70.8 7.8 280.3 280.3 0 0 0-79 175.5 275.7 275.7 0 0 0 106.1 242.6h15.2a171.9 171.9 0 0 0 57.4 0 229.8 229.8 0 0 1-142.9-241.2 235.7 235.7 0 0 1 114-184.7z" fill={accent} fillOpacity={0.45} />
        <path d="M597.4 559a212.3 212.3 0 0 1 70.8 7.8 280.3 280.3 0 0 1 79 175.5 275.7 275.7 0 0 1-106.1 242.6h-15.2a171.9 171.9 0 0 1-57.4 0 229.8 229.8 0 0 0 142.9-241.2 235.7 235.7 0 0 0-114-184.7z" fill={accent} fillOpacity={0.55} />
        <path d="M597.4 666a249.1 249.1 0 0 0 147.5-48.7 205.4 205.4 0 0 0-28.9-23 214.1 214.1 0 0 1-237.1 0 205.4 205.4 0 0 0-28.9 23 249.1 249.1 0 0 0 147.5 48.7zM597.4 881.1a248.6 248.6 0 0 1 147.5 46 179.2 179.2 0 0 1-28.9 23.4 214.1 214.1 0 0 0-237.1 0 179.2 179.2 0 0 1-28.9-23.4 248.6 248.6 0 0 1 147.5-46zM359.8 755.6h474.7v35.8H359.8z" fill={accent} fillOpacity={0.65} />
      </g>
      {/* Connection points */}
      <CpDot cx={cpLX} cy={cpY} accent={accent} />
      <CpDot cx={cpRX} cy={cpY} accent={accent} />
      {/* Screw holes */}
      <ScrewDots positions={shPositions} r={shR} />
      {/* Label */}
      <text x={svgW / 2} y={svgH - 6} textAnchor="middle" fontFamily="'Microsoft YaHei', sans-serif" fontSize="7" fontWeight="700" fill={accent} fillOpacity={0.8}>SD-WAN NODE</text>
    </svg>
  )
}

// ── V1.2.0: Internet Network SVG (globe) ─────────────────────

function InternetSvg({ accent, svgW, svgH }: {
  accent: string; portsInfo?: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number; isStacked?: boolean
}) {
  // Globe icon path bounds: ~1024×1024. Scale to fill SVG with proportional padding.
  const origW = 1024, origH = 1024
  const padX = Math.round(svgW * 0.22)   // 44/200 in preview
  const padY = Math.round(svgH * 0.07)   // 10/144 in preview
  const labelH = 10
  const scale = Math.min((svgW - padX * 2) / origW, (svgH - padY - labelH) / origH)
  const tx = (svgW - origW * scale) / 2
  const ty = padY + (svgH - padY - labelH - origH * scale) / 2

  // CP positions: 21%/79% width, 47% height (from preview)
  const cpLX = Math.round(svgW * 0.21)
  const cpRX = Math.round(svgW * 0.79)
  const cpY = Math.round(svgH * 0.47)

  // Screw holes: 24%/76% width, 12.5%/87.5% height (from preview)
  const shR = Math.max(1.5, Math.round(svgW * 0.01))
  const shPositions: [number, number][] = [
    [Math.round(svgW * 0.24), Math.round(svgH * 0.125)],
    [Math.round(svgW * 0.76), Math.round(svgH * 0.125)],
    [Math.round(svgW * 0.24), Math.round(svgH * 0.875)],
    [Math.round(svgW * 0.76), Math.round(svgH * 0.875)],
  ]

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      {/* Globe icon — adapted from user-provided design */}
      <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
        <path d="M975.9 310c17.6-19.2 27.2-43.9 27.2-69.9 0-57.5-46.8-104.3-104.3-104.3-12.3 0-24.4 2.2-36 6.7-91.2-88.2-211.1-136.8-337.9-136.8-70.2 0-138.4 15-202.6 44.5l-5.9 2.8C229.6 94.1 154.6 163.2 104.7 247.5 52.5 251.4 12 294.7 12 347c0 27 10.8 52.4 30.4 71.5-4.2 26.1-6.3 51.7-6.3 75.9 0 204.5 129.8 388.8 323.3 459.1 16.4 37.6 54.5 62.8 95.4 62.8 28.5 0 56-12.1 75.8-33.3 265.7-4.8 481.5-223.6 481.5-488.5 0-63.5-12.1-125.5-36.1-184.4zM808.8 187.7c-9.4 16-14.3 34-14.3 52.4 0 16.2 3.8 32.3 11.2 46.8-64.4 31.6-133.6 57.5-200.8 75.2-13.4-28.6-39.2-49.5-69.8-56.8-8-50.8-13.9-103.1-17.6-155.7 68.7 3.1 141.9-2.5 218.6-16.4 23.9 14.8 48.3 33.1 71.5 54.5zM809.1 353.5c-12.1 48.9-18.6 98.7-19.4 148-57.7 39.2-111.6 83-160.5 130.3-20.2-42.8-38.3-91.2-53.8-143.7 20.3-16.1 33.6-38.8 37.8-64.7 81.2 19.3 150.2-8.8 196.1-30zM618.4 85.8c-36 2.6-71.2 3-104.4 1.3-0.1-4.2-0.3-8.2-0.4-11.8 34.6-1.8 69.8 1.7 104.8 10.1v0.4zM511.8 357.2c27.6 0 50 22.5 50 50s-22.5 50-50 50-50-22.5-50-50 22.5-50 50-50zM425.1 81.2c8.3-2 16.7-3.6 25-5.1l4.6-0.8 0.5 18.1-4.6 0.6c-8.5 1.1-16.9 2.4-25.1 3.8l-19.5-3.3 19.1-3.1v-0.2zM319.8 129.2c6.2-3.5 12.7-6.9 19.1-10.1 23.9 8 62.9 18.7 116.1 25.2 2.5 39.1 7.6 98.3 17.9 165.2-34.9 13.6-59.3 44.3-64.8 81.2-36.4 1.2-71.9-0.2-104.7-4-30.9-119.6-38.4-218-43.5-257.7h-0.1zM261.8 168.2c3.5 48.4 2.4 121.5-19.5 208.5-10-1.9-20.8-4.5-32.7-7.8 1.8-7.8 2.7-14.8 2.7-21.5 0-30.8-14.6-60.2-39.2-79.2 24.5-38 55-72.3 88.7-99.8v-0.2zM66.8 347c0-25 20.4-45.4 45.4-45.4s45.3 20.4 45.3 45.4-20.4 45.4-45.3 45.4-45.4-20.4-45.4-45.4zM105.4 494.4c0-14.7 1.1-30.2 3.2-47.5 1.2 0.1 2.3 0.3 3.5 0.3 9.2 0 18.6-1.5 28.8-4.7l0.5 0.5c22.5 20.7 41.3 39.5 57.5 57.4-19.5 43.1-43.8 85.5-72.1 126.3-14.1-41.7-21.4-86.2-21.4-131.5v-0.8zM356.2 877.8c-85.3-37.6-156.4-103.2-200.6-185.5 33.6-44.6 62.8-91.5 86.7-139.5 81.4 107 120.9 213.3 139.8 284.9-11.7 12.5-20.5 26.2-25.8 41.2l-0.1-1.1zM270.7 489.1c5.6-14.3 10.8-28.4 15.4-42 42 5.4 84.8 7.2 131.3 5.3 17.6 36 53.2 58.3 93.4 58.3 2.2 0 4.4-0.1 6.5-0.3 18.7 62.1 40.9 118.7 66.1 168.3-37.6 40.9-72.5 85.4-103.6 132.4-8.6-2.3-16.8-3.4-25.1-3.4-5.3 0-10.7 0.5-16.5 1.6-17.4-82.7-64.9-203.1-161.9-321.2h-5.6zM455.7 963c-27.6 0-50-22.4-50-50s22.4-50 50-50 50 22.4 50 50-22.4 50-50 50zM544 912.2c0-0.1 0-0.2 0-0.2 0-25.4-1.8-49.8-18.7-68.8 25.5-38.2 57-74.5 86.4-107.8 31.7 50.7 62.4 93.8 102.3 128C663.6 890.6 608 907.4 544 912.2zM777.7 828.4c-44.3-34.5-84.1-81.4-118.4-139.6 40.9-40.9 85.6-79.2 133.1-113.8 8.8 90.6 34.2 159 49.6 193.4-18.9 21.9-40.5 42-64.2 60l-0.1 0zM884.7 708.9c-14.1-39.6-30.1-99.8-33-174.4 37.8-24.1 70.2-41.7 92.4-52.9 0.2 4.3 0.2 8.5 0.2 12.8 0 75.2-20.5 149.2-59.5 214.1l-0.1 0.4zM876.1 341.7c13.7 3.3 25.7 3.6 39.2 1.2 9.3 24.2 16.5 49 21.2 73.9-19.2 9.1-48.1 23.7-83.3 44.6 3.5-39.3 11.2-79.5 23-119.7h-0.1z" fill={accent} fillOpacity={0.85} />
      </g>
      {/* Connection points */}
      <CpDot cx={cpLX} cy={cpY} accent={accent} />
      <CpDot cx={cpRX} cy={cpY} accent={accent} />
      {/* Screw holes */}
      <ScrewDots positions={shPositions} r={shR} />
      {/* Label */}
      <text x={svgW / 2} y={svgH - 6} textAnchor="middle" fontFamily="'Microsoft YaHei', sans-serif" fontSize="7" fontWeight="700" fill={accent} fillOpacity={0.8}>WWW · INTERNET</text>
    </svg>
  )
}

// ── V1.2.0: Public Cloud SVG ─────────────────────────────────

function CloudSvg({ accent, svgW, svgH }: {
  accent: string; portsInfo?: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number; isStacked?: boolean
}) {
  // Chassis: 10%/14%/80%/72% of svgW×svgH, rx=6% of svgW (matching preview rx=12 in 200px)
  const cx = Math.round(svgW * 0.10)
  const cy = Math.round(svgH * 0.14)
  const cw = Math.round(svgW * 0.80)
  const ch = Math.round(svgH * 0.72)
  const crx = Math.round(svgW * 0.06)

  // Cloud icon center: 24% width, 39% height (from preview translate(48,56) in 200×144)
  const cloudCx = Math.round(svgW * 0.24)
  const cloudCy = Math.round(svgH * 0.39)

  // Server rack: 58% width center, 36% height (from preview translate(116,52))
  const rackW = Math.round(svgW * 0.18)   // 36/200
  const rackH = Math.round(svgH * 0.28)   // 40/144
  const rackX = Math.round(svgW * 0.58) - Math.round(rackW / 2)
  const rackY = Math.round(svgH * 0.36) - Math.round(svgH * 0.01)

  // CP positions: 11%/89% width, 50% height
  const cpLX = Math.round(svgW * 0.11)
  const cpRX = Math.round(svgW * 0.89)
  const cpY = Math.round(svgH * 0.50)

  // Screw holes: 14%/86% width, 19%/81% height
  const shR = Math.max(1.5, Math.round(svgW * 0.009))
  const shPositions: [number, number][] = [
    [Math.round(svgW * 0.14), Math.round(svgH * 0.19)],
    [Math.round(svgW * 0.86), Math.round(svgH * 0.19)],
    [Math.round(svgW * 0.14), Math.round(svgH * 0.81)],
    [Math.round(svgW * 0.86), Math.round(svgH * 0.81)],
  ]

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cloud-body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-cat-sdwan-cloud-light)" />
          <stop offset="100%" stopColor="var(--color-cat-sdwan-cloud-border)" />
        </linearGradient>
      </defs>
      {/* Chassis — large rounded rect, inset from edges */}
      <rect x={cx} y={cy} width={cw} height={ch} rx={crx} fill="url(#cloud-body-grad)" stroke={accent} strokeWidth={1.5} />
      {/* Accent top bar */}
      <rect x={cx} y={cy} width={cw} height={Math.round(svgH * 0.04)} rx={Math.round(svgH * 0.04)} fill={accent} opacity={0.35} />
      {/* Cloud icon (left) */}
      <g transform={`translate(${cloudCx}, ${cloudCy})`}>
        <ellipse cx="0" cy="14" rx="11" ry="10" fill={accent} opacity={0.2} stroke={accent} strokeWidth={0.8} />
        <ellipse cx="13" cy="5" rx="12" ry="13" fill={accent} opacity={0.2} stroke={accent} strokeWidth={0.8} />
        <ellipse cx="24" cy="14" rx="10" ry="10" fill={accent} opacity={0.2} stroke={accent} strokeWidth={0.8} />
        <rect x="-8" y="18" width="40" height="4" rx="2" fill={accent} opacity={0.3} />
      </g>
      {/* Server rack icon (right) */}
      <g transform={`translate(${rackX}, ${rackY})`}>
        <rect x="0" y="0" width={rackW} height={rackH} rx={Math.round(rackW * 0.08)} fill="var(--color-surface)" stroke={accent} strokeWidth={0.8} />
        {[0, 1, 2, 3].map((row) => {
          const ry = Math.round(rackH * 0.12) + row * Math.round(rackH * 0.22)
          return (
            <g key={`rack-slot-${row}`}>
              <rect x={Math.round(rackW * 0.11)} y={ry} width={Math.round(rackW * 0.78)} height={Math.round(rackH * 0.14)} rx={1} fill={accent} opacity={0.15} />
              <circle cx={Math.round(rackW * 0.22)} cy={ry + Math.round(rackH * 0.07)} r={1.5} fill="var(--color-device-led-green)" />
            </g>
          )
        })}
      </g>
      {/* Connection points */}
      <CpDot cx={cpLX} cy={cpY} accent={accent} />
      <CpDot cx={cpRX} cy={cpY} accent={accent} />
      {/* Screw holes */}
      <ScrewDots positions={shPositions} r={shR} />
      {/* Label */}
      <text x={svgW / 2} y={Math.round(svgH * 0.78)} textAnchor="middle" fontFamily="'Microsoft YaHei', sans-serif" fontSize="7" fontWeight="700" fill={accent} fillOpacity={0.8}>PUBLIC CLOUD</text>
    </svg>
  )
}

// ── V1.2.0: Data Center SVG (server cluster) ────────────────

function DataCenterSvg({ accent, svgW, svgH }: {
  accent: string; portsInfo?: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number; isStacked?: boolean
}) {
  // Chassis: 10%/11%/80%/67% of svgW×svgH, rx=4% of svgW (matching preview rx=8 in 200px)
  const cx = Math.round(svgW * 0.10)
  const cy = Math.round(svgH * 0.11)
  const cw = Math.round(svgW * 0.80)
  const ch = Math.round(svgH * 0.67)
  const crx = Math.round(svgW * 0.04)

  // 3 servers: each 19% width, 49% height, with 4% gap (from preview: 38×70, gap 8 in 200×144)
  const serverW = Math.round(svgW * 0.19)
  const serverH = Math.round(svgH * 0.49)
  const serverGap = Math.round(svgW * 0.04)
  const serverPadX = Math.round(svgW * 0.05)   // 10px padding inside chassis
  const startX = cx + serverPadX
  const startY = cy + Math.round(svgH * 0.08)  // 12px from chassis top in preview (12/144≈0.08)

  // 6 drive bays per server (fixed, matching preview)
  const DRIVE_COUNT = 6
  const driveX = Math.round(serverW * 0.105)       // 4/38
  const driveW = Math.round(serverW * 0.79)         // 30/38
  const driveH = Math.round(serverH * 0.10)         // 7/70
  const driveFirstY = Math.round(serverH * 0.07)    // 5/70
  const driveStepY = Math.round(serverH * 0.143)    // 10/70

  // CP positions: 11%/89% width, 44% height
  const cpLX = Math.round(svgW * 0.11)
  const cpRX = Math.round(svgW * 0.89)
  const cpY = Math.round(svgH * 0.44)

  // Screw holes: 14%/86% width, 17%/72% height
  const shR = Math.max(1.5, Math.round(svgW * 0.009))
  const shPositions: [number, number][] = [
    [Math.round(svgW * 0.14), Math.round(svgH * 0.17)],
    [Math.round(svgW * 0.86), Math.round(svgH * 0.17)],
    [Math.round(svgW * 0.14), Math.round(svgH * 0.72)],
    [Math.round(svgW * 0.86), Math.round(svgH * 0.72)],
  ]

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dc-body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-cat-sdwan-datacenter-light)" />
          <stop offset="100%" stopColor="var(--color-cat-sdwan-datacenter-border)" />
        </linearGradient>
      </defs>
      {/* Chassis */}
      <rect x={cx} y={cy} width={cw} height={ch} rx={crx} fill="url(#dc-body-grad)" stroke={accent} strokeWidth={1.2} />
      {/* 3 server racks side by side */}
      {[0, 1, 2].map((si) => {
        const sx = startX + si * (serverW + serverGap)
        return (
          <g key={`dc-server-${si}`} transform={`translate(${sx}, ${startY})`}>
            <rect x="0" y="0" width={serverW} height={serverH} rx={2} fill="var(--color-surface)" stroke={accent} strokeWidth={0.8} opacity={0.85} />
            {Array.from({ length: DRIVE_COUNT }).map((_, di) => (
              <g key={`drive-${di}`}>
                <rect x={driveX} y={driveFirstY + di * driveStepY} width={driveW} height={driveH} rx={1} fill={accent} opacity={0.12} stroke={accent} strokeWidth={0.4} />
                <circle cx={Math.round(serverW * 0.16)} cy={driveFirstY + di * driveStepY + Math.round(driveH * 0.5)} r={1} fill={si === 1 && di === 2 ? '#F59E0B' : 'var(--color-device-led-green)'} />
              </g>
            ))}
          </g>
        )
      })}
      {/* Connection points */}
      <CpDot cx={cpLX} cy={cpY} accent={accent} />
      <CpDot cx={cpRX} cy={cpY} accent={accent} />
      {/* Screw holes */}
      <ScrewDots positions={shPositions} r={shR} />
      {/* Label */}
      <text x={svgW / 2} y={Math.round(svgH * 0.86)} textAnchor="middle" fontFamily="'Microsoft YaHei', sans-serif" fontSize="7" fontWeight="700" fill={accent} fillOpacity={0.8}>DATA CENTER</text>
    </svg>
  )
}

// ── V1.5.0: Internet App SVG (multi-image + resize) ──

function InternetAppSvg({ accent, svgW, svgH, appImages }: {
  accent: string; svgW: number; svgH: number
  appImages?: AppImageItem[]
}) {
  const chassisX = Math.round(svgW * 0.10)   // 20/200
  const chassisY = Math.round(svgH * 0.14)   // 20/144
  const chassisW = Math.round(svgW * 0.80)   // 160/200
  const chassisH = Math.round(svgH * 0.72)   // 104/144
  const chassisRx = Math.round(svgW * 0.06)  // 12/200
  const cpY = Math.round(svgH * 0.50)        // 72/144
  const cpLX = Math.round(svgW * 0.11)       // 22/200
  const cpRX = Math.round(svgW * 0.89)       // 178/200

  // Image area: inside chassis with inset margins
  const imgAreaX = chassisX + 1
  const imgAreaY = chassisY + 7               // below accent bar
  const imgAreaW = chassisW - 2
  const imgAreaH = chassisH - 14              // space for label below
  const clipId = 'internetapp-img-clip'

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="internetapp-chassis-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-cat-sdwan-internetapp-light)" />
          <stop offset="100%" stopColor="var(--color-cat-sdwan-internetapp-border)" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={imgAreaX} y={imgAreaY} width={imgAreaW} height={imgAreaH} rx={Math.round(chassisRx * 0.5)} />
        </clipPath>
      </defs>
      {/* Chassis */}
      <rect x={chassisX} y={chassisY} width={chassisW} height={chassisH} rx={chassisRx}
        fill="url(#internetapp-chassis-grad)" stroke={accent} strokeWidth="1.5" />
      {/* Accent top bar */}
      <rect x={chassisX} y={chassisY} width={chassisW} height="5" rx="5" fill={accent} opacity="0.3" />
      {/* Image area */}
      <g clipPath={`url(#${clipId})`}>
        {appImages && appImages.length > 0 ? (
          appImages.map((item) => {
            const imgW = imgAreaW * item.scale
            const imgH = imgAreaH * item.scale
            const imgX = imgAreaX + item.offsetX
            const imgY = imgAreaY + item.offsetY
            return (
              <g key={item.id} data-image-id={item.id}>
                {/* Image */}
                <image
                  href={item.dataUrl}
                  x={imgX}
                  y={imgY}
                  width={imgW}
                  height={imgH}
                  preserveAspectRatio="xMidYMid meet"
                  className="internetapp-image nodrag"
                  data-image-id={item.id}
                  style={{ cursor: 'move' }}
                />
                {/* Resize handle — bottom-right corner */}
                <rect
                  x={imgX + imgW - 3}
                  y={imgY + imgH - 3}
                  width="6"
                  height="6"
                  rx="1"
                  fill="var(--color-surface)"
                  stroke={accent}
                  strokeWidth="0.8"
                  className="internetapp-resize-handle nodrag"
                  data-image-id={item.id}
                  style={{ cursor: 'nwse-resize' }}
                />
              </g>
            )
          })
        ) : (
          <g>
            {/* Dashed placeholder border */}
            <rect x={imgAreaX + 8} y={imgAreaY + 8} width={imgAreaW - 16} height={imgAreaH - 16}
              rx="4" fill="none" stroke={accent} strokeWidth="0.8" strokeDasharray="4 3" opacity="0.4" />
            {/* Upload icon — arrow into box */}
            <g transform={`translate(${svgW / 2}, ${chassisY + chassisH / 2 - 4})`} opacity="0.3">
              <rect x="-7" y="-6" width="14" height="12" rx="2" fill="none" stroke={accent} strokeWidth="0.8" />
              <path d="M-3,0 L0,-4 L3,0" fill="none" stroke={accent} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="0" y1="-4" x2="0" y2="4" stroke={accent} strokeWidth="0.8" strokeLinecap="round" />
            </g>
            <text x={svgW / 2} y={chassisY + chassisH / 2 + 14} textAnchor="middle"
              fontFamily="'Microsoft YaHei', sans-serif" fontSize="5.5" fill={accent} opacity="0.35">
              {t('propertyPanel.uploadAppImage')}
            </text>
          </g>
        )}
      </g>
      {/* Label */}
      <text x={svgW / 2} y={Math.round(svgH * 0.84)} textAnchor="middle" fontFamily="'Microsoft YaHei', sans-serif"
        fontSize="8" fontWeight="700" fill={accent}>{t('propertyPanel.internetApp')}</text>
      {/* CP dots */}
      <CpDot cx={cpLX} cy={cpY} accent={accent} />
      <CpDot cx={cpRX} cy={cpY} accent={accent} />
      {/* Screw holes */}
      <ScrewDots positions={[
        [Math.round(svgW * 0.14), Math.round(svgH * 0.19)],
        [Math.round(svgW * 0.86), Math.round(svgH * 0.19)],
        [Math.round(svgW * 0.14), Math.round(svgH * 0.81)],
        [Math.round(svgW * 0.86), Math.round(svgH * 0.81)],
      ]} r={2} />
    </svg>
  )
}

// ── V1.2.0: SDWAN Device SVG (firewall-like with ports) ─────

function SdwanDeviceSvg({ accent, portsInfo, ports, usedPorts, svgW, svgH, isStacked, hasTunnelPorts, tunnelPortCount }: {
  accent: string; portsInfo: string; ports?: RenderedPort[]; usedPorts?: Set<string>; svgW: number; svgH: number; isStacked?: boolean; hasTunnelPorts?: boolean; tunnelPortCount?: number
}) {
  // SDWAN appliance uses firewall-like chassis with left panel + port area
  const bodyY = 8, bodyH = svgH - 16
  const leftPanelW = Math.round(svgW * 0.18)
  const panelX = leftPanelW + 4
  const portPanelSvgW = svgW - leftPanelW - 4
  const portPanelBodyY = 8
  const iconCx = leftPanelW / 2 + 4

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sdw-body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-device-body)" />
          <stop offset="100%" stopColor="var(--color-device-secondary)" />
        </linearGradient>
      </defs>
      {/* Chassis */}
      <rect x="4" y={bodyY} width={svgW - 8} height={bodyH} rx="4" fill="url(#sdw-body-grad)" stroke="var(--color-device-body-stroke)" strokeWidth="1.5" />
      {/* Left panel — SDWAN branding */}
      <rect x="4" y={bodyY} width={leftPanelW} height={bodyH} rx="4" fill={accent} opacity="0.35" />
      {/* SDWAN hub/spoke icon */}
      <g transform={`translate(${iconCx}, ${bodyY + 28})`}>
        <circle cx="0" cy="0" r="6" fill={accent} opacity="0.9" />
        <circle cx="0" cy="0" r="2.5" fill={accent} opacity="0.5" />
        {[-8, 0, 8].map((dy, i) => (
          <g key={`spoke-${i}`}>
            <line x1="6" y1="0" x2="12" y2={dy} stroke={accent} strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="12.5" cy={dy} r="2" fill={accent} opacity="0.5" />
          </g>
        ))}
      </g>
      {/* Left panel label */}
      <text x={iconCx} y={bodyY + 54} textAnchor="middle" fontFamily="'Microsoft YaHei', sans-serif" fontSize="4.5" fontWeight="700" fill={accent} fillOpacity="0.8">SD</text>
      <text x={iconCx} y={bodyY + 62} textAnchor="middle" fontFamily="'Microsoft YaHei', sans-serif" fontSize="4.5" fontWeight="700" fill={accent} fillOpacity="0.8">WAN</text>
      {/* Status LEDs in left panel */}
      {[bodyY + 72, bodyY + 78, bodyY + 84].map((ly, i) => (
        <circle key={`sdw-led-${i}`} cx={iconCx} cy={ly} r="2" fill={i === 0 ? 'var(--color-device-led-green)' : accent} opacity={i === 0 ? 1 : 0.5} />
      ))}
      <ScrewHoles svgW={svgW} svgH={svgH} />
      <StatusLEDs svgW={svgW} accent={accent} />
      {/* Port zone */}
      <PortPanel portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={portPanelSvgW} bodyH={bodyH} bodyY={portPanelBodyY} panelX={panelX} />
      {hasTunnelPorts && <TunnelPorts panelX={panelX} panelBodyW={portPanelSvgW} bodyY={bodyY} bodyH={bodyH} hasStack={!!isStacked} count={tunnelPortCount || 2} />}
      {isStacked && <StackPort panelX={panelX} panelBodyW={portPanelSvgW} bodyY={bodyY} bodyH={bodyH} />}
    </svg>
  )
}

// ── Dispatcher ──────────────────────────────────────────────────

// ── V0.9.0: STACK port rendering ──────────────────────────────

/** Render the STACK port at a consistent position inside the chassis */
function StackPort({ panelX, panelBodyW, bodyY, bodyH }: {
  panelX: number; panelBodyW: number; bodyY: number; bodyH: number
}) {
  const stackW = Math.max(64, panelBodyW * 0.42)
  const stackH = 16
  const stackX = panelX + (panelBodyW - stackW) / 2
  const stackY = bodyY + bodyH - 18

  return (
    <g>
      {/* STACK port body */}
      <rect
        x={stackX}
        y={stackY}
        width={stackW}
        height={stackH}
        rx={2}
        fill="var(--color-port-stack-fill)"
        stroke="var(--color-port-stack-stroke)"
        strokeWidth={1.5}
      />
      {/* Port label */}
      <text
        x={stackX + stackW / 2}
        y={stackY + stackH / 2 + 1.5}
        fontSize={5.5}
        fill="var(--color-port-stack-stroke)"
        textAnchor="middle"
        fontFamily="'Microsoft YaHei', sans-serif"
        fontWeight={700}
      >
        STACK
      </text>
    </g>
  )
}

// ── V1.3.0: Tunnel port rendering (for SDWAN CPE devices) ─────

function TunnelPorts({ panelX, panelBodyW, bodyY, bodyH, hasStack, count = 2 }: {
  panelX: number; panelBodyW: number; bodyY: number; bodyH: number; hasStack?: boolean; count?: number
}) {
  const tunnelCount = Math.max(1, count)
  // Auto-scale: fit all ports in available width
  const baseTunnelW = 22, baseTunnelGap = 8
  const naturalW = tunnelCount * baseTunnelW + (tunnelCount - 1) * baseTunnelGap
  const scale = naturalW > panelBodyW * 0.9 ? (panelBodyW * 0.9) / naturalW : 1
  const tunnelW = Math.max(14, Math.round(baseTunnelW * scale))
  const tunnelH = 14
  const tunnelGap = Math.max(4, Math.round(baseTunnelGap * scale))
  const maxPerRow = tunnelCount <= 2 ? 2 : Math.min(tunnelCount, 4)
  const rows = Math.ceil(tunnelCount / maxPerRow)
  const rowHeight = tunnelH + 4

  return (
    <g>
      {Array.from({ length: tunnelCount }).map((_, i) => {
        const row = Math.floor(i / maxPerRow)
        const countInRow = row === rows - 1 ? tunnelCount - row * maxPerRow : maxPerRow
        const colInRow = i - row * maxPerRow
        const totalW = countInRow * tunnelW + (countInRow - 1) * tunnelGap
        const startX = panelX + (panelBodyW - totalW) / 2
        const tx = startX + colInRow * (tunnelW + tunnelGap)
        const baseY = hasStack
          ? bodyY + bodyH - 28 - (rows - row) * rowHeight
          : bodyY + bodyH - 10 - (rows - row) * rowHeight
        return (
          <g key={`tunnel-${i}`}>
            {/* Tunnel port body */}
            <rect x={tx} y={baseY} width={tunnelW} height={tunnelH} rx={2.5}
              fill="var(--color-port-tunnel-fill)" stroke="var(--color-port-tunnel-stroke)" strokeWidth={1.5} />
            {/* Tunnel port glow effect */}
            <rect x={tx + 1} y={baseY + 1} width={tunnelW - 2} height={tunnelH - 2} rx={1.5}
              fill="var(--color-port-tunnel-glow)" opacity={0.6} />
            {/* Tunnel port label */}
            <text x={tx + tunnelW / 2} y={baseY + tunnelH / 2 + 1.5}
              fontSize={3.5} fill="var(--color-port-tunnel-stroke)" textAnchor="middle"
              fontFamily="'Microsoft YaHei', sans-serif" fontWeight={700}>
              {`TUN${i + 1}`}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ── V1.2.0: SDWAN model-to-SVG mapping ───────────────────────

/** Determine which SVG illustration to render for an SDWAN device based on its model name. */
function getSdwanSvgType(model: string): string {
  if (model === '互联网应用') return 'internetapp'
  // Backward compat: old model names from V1.3.0
  if (model === '国内互联网应用' || model === '国际互联网应用') return 'internetapp'
  if (model.includes('互联网')) return 'internet'
  if (model.includes('VPC') || model.includes('VNet') || model.includes('AWS') || model.includes('Azure') || model.includes('云')) return 'cloud'
  if (model.includes('数据中心') || model.includes('灾备') || model.includes('DC')) return 'datacenter'
  if (model.includes('AR') || model.includes('MSR') || model.includes('CPE')) return 'device'
  return 'node' // default: SD-WAN Hub/Edge node
}

interface DeviceIllustrationProps {
  categoryName: string
  accent: string
  portsInfo: string
  /** V0.8.0: Precomputed port layout — avoids double-computation in DeviceNode */
  ports?: RenderedPort[]
  /** V0.8.0: Port labels that are already connected to an edge */
  usedPorts?: Set<string>
  svgW: number
  svgH: number
  /** V0.9.0: Device stacking mode */
  isStacked?: boolean
  /** V1.3.0: SDWAN CPE tunnel ports */
  hasTunnelPorts?: boolean
  /** V1.5.1: Tunnel port count (default 2) */
  tunnelPortCount?: number
  /** V1.2.0: Device model name — used to pick the correct SVG within the SDWAN category */
  deviceModel?: string
  /** V1.5.0: Internet App custom images (multi-image + resize) */
  appImages?: AppImageItem[]
}

export default function DeviceIllustration({ categoryName, accent, portsInfo, ports, usedPorts, svgW, svgH, isStacked, hasTunnelPorts, deviceModel, appImages, tunnelPortCount }: DeviceIllustrationProps) {
  const { t } = useTranslation()
  // V1.2.0: SDWAN category uses model-based dispatch for different visual types
  if (categoryName === 'SDWAN') {
    const svgType = deviceModel ? getSdwanSvgType(deviceModel) : 'node'
    switch (svgType) {
      case 'internet': return <InternetSvg accent={accent} svgW={svgW} svgH={svgH} />
      case 'cloud': return <CloudSvg accent={accent} svgW={svgW} svgH={svgH} />
      case 'datacenter': return <DataCenterSvg accent={accent} svgW={svgW} svgH={svgH} />
      case 'internetapp': return <InternetAppSvg accent={accent} svgW={svgW} svgH={svgH} appImages={appImages} />
      case 'device': return <SdwanDeviceSvg accent={accent} portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={svgW} svgH={svgH} isStacked={isStacked} hasTunnelPorts={hasTunnelPorts} tunnelPortCount={tunnelPortCount} />
      default: return <SdwanNodeSvg accent={accent} svgW={svgW} svgH={svgH} />
    }
  }
  switch (categoryName) {
    case '交换机': return <SwitchSvg accent={accent} portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={svgW} svgH={svgH} isStacked={isStacked} />
    case '防火墙': return <FirewallSvg accent={accent} portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={svgW} svgH={svgH} isStacked={isStacked} />
    case '无线控制器': return <AcSvg accent={accent} portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={svgW} svgH={svgH} isStacked={isStacked} />
    case '无线接入点': return <ApSvg accent={accent} portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={svgW} svgH={svgH} isStacked={isStacked} />
    case '服务器': return <ServerSvg accent={accent} portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={svgW} svgH={svgH} isStacked={isStacked} />
    case '终端-PC': return <PcSvg accent={accent} portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={svgW} svgH={svgH} />
    case '终端-笔记本': return <LaptopSvg accent={accent} portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={svgW} svgH={svgH} />
    default: return <SwitchSvg accent={accent} portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={svgW} svgH={svgH} isStacked={isStacked} />
  }
}
