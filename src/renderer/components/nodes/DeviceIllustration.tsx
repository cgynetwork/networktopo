import { parsePortsInfo, getPortLayout, type RenderedPort } from '../../utils/portParser'

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
      return { bodyY, bodyH, panelX: 0, portPanelSvgW: bodyW, portPanelBodyY: bodyY + 18 }
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
  const { bodyY, bodyH, portPanelSvgW, portPanelBodyY } = getDeviceLayoutParams('无线接入点', svgW, svgH)
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
      <PortPanel portsInfo={portsInfo} ports={ports} usedPorts={usedPorts} svgW={portPanelSvgW} bodyH={bodyH - 18} bodyY={portPanelBodyY} />
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
}

export default function DeviceIllustration({ categoryName, accent, portsInfo, ports, usedPorts, svgW, svgH, isStacked }: DeviceIllustrationProps) {
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
