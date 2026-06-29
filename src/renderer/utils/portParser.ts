// Port parsing utility — shared between SVG rendering and connection auto-labeling
// Parses ports_info strings like "48×25GE+6×100GE" into typed port groups

export interface ParsedPortGroup {
  count: number
  type: string
  category: 'small' | 'large'   // small = 网络端口 (RJ45); large = 光纤端口 (SFP/QSFP)
}

/**
 * Classify a port type as 网络端口 (small) or 光纤端口 (large).
 * — 网络端口: GE / FE / 2.5GE / 5GE / PoE  (RJ45 电口)
 * — 光纤端口: SFP / SFP+ / QSFP / 10GE / 25GE / 40GE / 100GE  (光口)
 *
 * Tests "small" first — combo types like "GE/SFP+" contain GE, so they stay 网络端口.
 */
function classifyPortType(type: string): 'small' | 'large' {
  const trimmed = type.trim()
  // 网络端口 → small (test first — combo ports like GE/SFP+ match here via GE)
  if (/\b(GE|FE|2\.?5GE|5GE|PoE)\b/.test(trimmed)) return 'small'
  // 光纤端口 → large
  if (/\b(SFP\+?|QSFP\d*|10GE|25GE|40GE|100GE)\b/.test(trimmed)) return 'large'
  return 'small'
}

/**
 * Parse a ports_info string into an array of port groups.
 * Format: "COUNT×TYPE+COUNT×TYPE+..."
 * Separator: `+` followed by a digit then `×` (not `+` inside type names like "PoE+" or "SFP+").
 * Returns empty array for empty/falsy input. Never throws.
 *
 * Examples:
 *   "8×GE+2×SFP"          → [{count:8, type:"GE", cat:"small"}, {count:2, type:"SFP", cat:"large"}]
 *   "48×25GE+6×100GE"     → [{count:48, type:"25GE", cat:"large"}, {count:6, type:"100GE", cat:"large"}]
 *   "24×GE PoE++4×SFP+"   → [{count:24, type:"GE PoE+", cat:"small"}, {count:4, type:"SFP+", cat:"large"}]
 *   "48×GE/SFP++6×QSFP+"  → [{count:48, type:"GE/SFP+", cat:"small"}, {count:6, type:"QSFP+", cat:"large"}]
 */
export function parsePortsInfo(portsInfo: string): ParsedPortGroup[] {
  if (!portsInfo || typeof portsInfo !== 'string') return []

  const trimmed = portsInfo.trim()
  if (!trimmed) return []

  // Split on `+` that is immediately followed by a digit then `×`
  // This preserves `+` inside type names (PoE+, SFP+, QSFP+)
  const segments = trimmed.split(/\+(?=\d+×)/)

  const groups: ParsedPortGroup[] = []

  for (const seg of segments) {
    const match = seg.match(/^(\d+)\s*×\s*(.+)$/)
    if (!match) continue

    const count = parseInt(match[1], 10)
    const type = match[2].trim()

    if (count <= 0 || !type) continue

    groups.push({
      count,
      type,
      category: classifyPortType(type),
    })
  }

  return groups
}

/**
 * Summarise total port counts by category.
 */
export function getPortSummary(parsed: ParsedPortGroup[]): { smallCount: number; largeCount: number } {
  let smallCount = 0
  let largeCount = 0
  for (const g of parsed) {
    if (g.category === 'small') smallCount += g.count
    else largeCount += g.count
  }
  return { smallCount, largeCount }
}

/**
 * Generate a human-readable default port label for connection auto-assignment.
 * Uses the first (primary) port group, e.g. "48×25GE" or "24×GE PoE+".
 * Returns empty string for unparseable input.
 */
export function getDefaultPortLabel(portsInfo: string): string {
  const groups = parsePortsInfo(portsInfo)
  if (groups.length === 0) return ''
  // Return the first port group as the label
  const g = groups[0]
  return `${g.count}×${g.type}`
}

/**
 * List every individual port as a numbered label.
 * Example: "8×GE+2×SFP" → ["GE 1", "GE 2", …, "GE 8", "SFP 1", "SFP 2"]
 * Ports are numbered 1..count within each group, in parse order (small groups first typically).
 * Returns empty array for invalid input.
 */
export function listAllPorts(portsInfo: string): string[] {
  const groups = parsePortsInfo(portsInfo)
  const ports: string[] = []
  for (const g of groups) {
    for (let i = 1; i <= g.count; i++) {
      ports.push(`${g.type} ${i}`)
    }
  }
  return ports
}
