// Port parsing utility — shared between SVG rendering and connection auto-labeling
// Parses ports_info strings like "48×25GE+6×100GE" into typed port groups
//
// V0.7.4: Three display-category port labeling for canvas rendering
//   GE   (网络端口) — GE / FE / PoE / PoE+ / 2.5GE / 5GE,        visualWidth = 20
//   SFP  (千兆光纤) — SFP only (NOT SFP+),                         visualWidth = 20
//   QSFP (万兆光纤) — SFP+ / QSFP / 10GE / 25GE / 40GE / 100GE,   visualWidth = 24–28
//   MGMT (管理口)   — Console / MGMT,                              visualWidth = 18
//
// Internal categories (color + row height) remain: copper | sfp | tenG | qsfp | mgmt

export interface ParsedPortGroup {
  count: number
  type: string
  /** Three-tier classification: copper | sfp | tenG (QSFP resolves to qsfp separately) */
  category: 'copper' | 'sfp' | 'tenG' | 'qsfp' | 'mgmt'
}

/** Metadata for rendering a port type in the enhanced SVG illustration */
export interface PortTypeMetadata {
  abbreviation: string      // Short label shown on the port, e.g. "GE", "25G", "SFP+"
  category: 'copper' | 'sfp' | 'tenG' | 'qsfp' | 'mgmt'
  /** Visual width of this port type in the SVG layout (relative units) */
  visualWidth: number
}

/** A single port positioned for rendering */
export interface RenderedPort {
  type: string
  typeLabel: string
  category: 'copper' | 'sfp' | 'tenG' | 'qsfp' | 'mgmt'
  portIndex: number   // 1-based within its type group
  x: number
  y: number
  width: number
  height: number
}

/**
 * Classify a port type into the three-tier system:
 *   copper — GE / FE / 2.5GE / 5GE / PoE  (RJ45 电口)
 *   sfp    — SFP only, NOT SFP+  (千兆光纤)
 *   tenG   — SFP+ / 10GE / 25GE / 40GE / 100GE  (万兆光纤)
 *   qsfp   — QSFP variants  (高速端口)
 *   mgmt   — Console / MGMT  (管理口)
 *
 * Copper tested first — combo types like "GE/SFP+" contain GE, so they stay copper.
 * SFP+ is tested before plain SFP to correctly classify as 万兆光纤.
 */
export function classifyPortTypeV2(type: string): 'copper' | 'sfp' | 'tenG' | 'qsfp' | 'mgmt' {
  const trimmed = type.trim()
  // 网络端口 → copper (test first — combo ports like GE/SFP+ match here via GE)
  if (/\b(GE|FE|2\.?5GE|5GE|PoE)\b/.test(trimmed)) return 'copper'
  // QSFP → qsfp
  if (/\bQSFP/.test(trimmed)) return 'qsfp'
  // SFP+ → tenG (万兆光纤, test before plain SFP)
  if (/\bSFP\+/.test(trimmed)) return 'tenG'
  // 10GE/25GE/40GE/100GE → tenG (万兆光纤)
  if (/\b(10GE|25GE|40GE|100GE)\b/.test(trimmed)) return 'tenG'
  // SFP (plain only, not SFP+) → sfp (千兆光纤)
  if (/\bSFP\b/.test(trimmed)) return 'sfp'
  // Console / MGMT → mgmt
  if (/\b(CONSOLE|MGMT|Console|Mgmt|console|mgmt)\b/.test(trimmed)) return 'mgmt'
  return 'copper'
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
      category: classifyPortTypeV2(type),
    })
  }

  return groups
}

/**
 * Summarise total port counts by the three-tier category system.
 */
export function getPortSummary(parsed: ParsedPortGroup[]): {
  copperCount: number; sfpCount: number; tenGCount: number; qsfpCount: number; mgmtCount: number
} {
  let copperCount = 0, sfpCount = 0, tenGCount = 0, qsfpCount = 0, mgmtCount = 0
  for (const g of parsed) {
    switch (g.category) {
      case 'copper': copperCount += g.count; break
      case 'sfp':    sfpCount += g.count; break
      case 'tenG':   tenGCount += g.count; break
      case 'qsfp':   qsfpCount += g.count; break
      case 'mgmt':   mgmtCount += g.count; break
    }
  }
  return { copperCount, sfpCount, tenGCount, qsfpCount, mgmtCount }
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
 * List every individual port as a numbered label matching the SVG canvas rendering.
 * Uses display abbreviations (GE / SFP / QSFP) with sequential numbering
 * per abbreviation, matching DeviceIllustration's PortRect labels.
 *
 * Example: "8×GE+4×PoE+2×SFP" → ["GE1", "GE2", …, "GE12", "SFP1", "SFP2"]
 * Returns empty array for invalid input.
 */
export function listAllPorts(portsInfo: string): string[] {
  const groups = parsePortsInfo(portsInfo)
  const ports: string[] = []
  const counter: Record<string, number> = {}
  for (const g of groups) {
    const meta = getPortTypeMetadata(g.type)
    const abbr = meta.abbreviation
    for (let i = 1; i <= g.count; i++) {
      counter[abbr] = (counter[abbr] || 0) + 1
      ports.push(`${abbr}${counter[abbr]}`)
    }
  }
  return ports
}

// ── Enhanced port metadata for V0.7.0 realistic rendering ─────

/** Get the rendering metadata for a given port type string */
export function getPortTypeMetadata(type: string): PortTypeMetadata {
  const t = type.trim()

  // V0.7.4: Three display-category port labels
  //   GE   (网络端口) — GE / FE / PoE / PoE+ / 2.5GE / 5GE
  //   SFP  (千兆光纤) — SFP only
  //   QSFP (万兆光纤) — SFP+ / QSFP / 10GE / 25GE / 40GE / 100GE
  //   MGMT (管理口)   — Console / MGMT
  // Visual widths and internal categories remain differentiated for physical appearance.

  // QSFP / QSFP+ / QSFP28 — large high-speed fiber (widest, 28)
  if (/\bQSFP/.test(t)) {
    return { abbreviation: 'QSFP', category: 'qsfp', visualWidth: 28 }
  }

  // 100GE / 40GE / 25GE / 10GE — 万兆光纤 (wider, 24)
  if (/\b(100GE|40GE|25GE|10GE)\b/.test(t)) {
    return { abbreviation: 'QSFP', category: 'tenG', visualWidth: 24 }
  }

  // SFP+ — 万兆光纤 (test BEFORE plain SFP; \bSFP\+ does not match inside QSFP)
  if (/\bSFP\+/.test(t)) {
    return { abbreviation: 'QSFP', category: 'tenG', visualWidth: 24 }
  }

  // SFP (plain only, not SFP+) — 千兆光纤
  if (/\bSFP\b/.test(t)) {
    return { abbreviation: 'SFP', category: 'sfp', visualWidth: 20 }
  }

  // GE / FE / 2.5GE / 5GE / PoE — 网络端口 (copper RJ45)
  if (/\b(GE|FE|2\.?5GE|5GE|PoE)\b/.test(t)) {
    return { abbreviation: 'GE', category: 'copper', visualWidth: 20 }
  }

  // Console / MGMT — 管理口
  if (/\b(CONSOLE|MGMT|Console|Mgmt|console|mgmt)\b/.test(t)) {
    return { abbreviation: 'MGMT', category: 'mgmt', visualWidth: 18 }
  }

  // Default: copper
  return { abbreviation: 'GE', category: 'copper', visualWidth: 20 }
}

// ── V0.7.2: Split outer/inner row layout engine (count-driven) ──

/**
 * Determine the maximum ports per row for the outer group based on total count.
 *
 * Rules:
 *   ≤12  → max 12 per row (single row)
 *   >12, ≤16 → max 8 per row
 *   >16, ≤24 → max 12 per row
 *   >24, ≤48 → max 24 per row
 *   >48      → max 24 per row
 */
function determineMaxPerRow(total: number): number {
  if (total <= 12) return 12
  if (total <= 16) return 8
  if (total <= 24) return 12
  return 24
}

interface FlatPort {
  group: ParsedPortGroup
  idxInGroup: number
  meta: PortTypeMetadata
}

interface RowItem {
  port: FlatPort
  x: number  // offset within the row (before centering)
  w: number  // rendered width (may be scaled down)
}

/**
 * Position items within a single row, compressing gaps when the row
 * overflows available width. Port widths are scaled only as a last resort.
 *
 * Returns positioned items with x values relative to row start.
 * The caller centers the row within the panel by computing a row-level offset.
 */
function positionRow(
  items: FlatPort[],
  usableW: number,
  portGap: number,
  groupGap: number,
): RowItem[] {
  if (items.length === 0) return []

  // Calculate natural widths, broken down by fiber vs copper
  let totalPortW = 0
  let totalGapW = 0
  let fiberW = 0
  let copperW = 0
  for (let i = 0; i < items.length; i++) {
    const cat = items[i].meta.category
    totalPortW += items[i].meta.visualWidth
    if (cat === 'sfp' || cat === 'tenG' || cat === 'qsfp') {
      fiberW += items[i].meta.visualWidth
    } else {
      copperW += items[i].meta.visualWidth
    }
    if (i > 0) {
      const sameGroup = items[i].group.type === items[i - 1].group.type
      totalGapW += sameGroup ? portGap : groupGap
    }
  }
  const naturalW = totalPortW + totalGapW

  // Compression strategy (V0.7.3):
  //   Step 1: squeeze gaps
  //   Step 2: only compress copper ports — fiber stays at full visualWidth
  //   Step 3: if copper at MIN_PORT_WIDTH still overflows, clamp copper at MIN
  //           and let row overflow slightly — fiber ports NEVER scale
  //   All-fiber rows: only compress gaps, never scale ports
  let gapScale = 1
  let copperScale = 1  // only ever applies to copper ports

  if (naturalW > usableW && items.length > 0) {
    // Step 1: compress gaps
    if (totalGapW > 0) {
      const maxGapSpace = Math.max(0, usableW - totalPortW)
      gapScale = Math.max(0, maxGapSpace / totalGapW)
    }

    // Step 2: if still overflowing after gap compression
    const compressedW = totalPortW + totalGapW * gapScale
    if (compressedW > usableW) {
      if (copperW > 0 && fiberW > 0) {
        // Mixed row: only compress copper, fiber stays at full visualWidth
        const availForCopper = usableW - fiberW - totalGapW * gapScale
        const desired = availForCopper / copperW
        const MIN_COPPER_SCALE = 14 / 20  // MIN_PORT_WIDTH(14) / copper visualWidth(20)
        // Clamp copper scale at MIN — never touch fiber widths
        copperScale = Math.max(MIN_COPPER_SCALE, Math.min(1, desired))
      } else if (fiberW > 0 && copperW === 0) {
        // All-fiber row: never scale ports, only compress gaps further
        if (totalGapW > 0) {
          gapScale = Math.max(0, (usableW - totalPortW) / totalGapW)
        }
        // copperScale stays at 1 (no copper to scale, fiber never scaled)
      } else {
        // All-copper row: uniform scaling is fine
        copperScale = usableW / naturalW
        gapScale = copperScale
      }
    }
  }

  // Compute final row width for centering
  let finalW = 0
  for (let i = 0; i < items.length; i++) {
    const cat = items[i].meta.category
    const isFiber = cat === 'sfp' || cat === 'tenG' || cat === 'qsfp'
    // Fiber ports ALWAYS at full width; copper ports use copperScale
    const s = isFiber ? 1 : copperScale
    finalW += items[i].meta.visualWidth * s
    if (i > 0) {
      const sameGroup = items[i].group.type === items[i - 1].group.type
      const gap = sameGroup ? portGap : groupGap
      finalW += gap * gapScale
    }
  }

  // Clamp offsetX ≥ 0 to prevent ports from rendering outside the SVG viewBox
  // (negative x would be clipped by overflow:hidden, looking like compression)
  const offsetX = Math.max(0, (usableW - finalW) / 2)
  const result: RowItem[] = []
  let cursorX = 0

  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      const sameGroup = items[i].group.type === items[i - 1].group.type
      const gap = sameGroup ? portGap : groupGap
      cursorX += gap * gapScale
    }
    const cat = items[i].meta.category
    const isFiber = cat === 'sfp' || cat === 'tenG' || cat === 'qsfp'
    // Fiber ports ALWAYS at full width; copper ports use copperScale
    const s = isFiber ? 1 : copperScale
    const w = items[i].meta.visualWidth * s
    result.push({ port: items[i], x: offsetX + cursorX, w })
    cursorX += w
  }

  return result
}

/**
 * Fill rows from a flat port list — count-driven with width compression.
 *
 * Row count is determined by maxPerRow (the user-defined rule).
 * Items are distributed evenly across rows so no row exceeds maxPerRow.
 * Within each row, positionRow compresses gaps / scales ports if they
 * overflow the available width.
 */
function fillRows(
  items: FlatPort[],
  usableW: number,
  maxPerRow: number,
  portGap: number,
  groupGap: number,
): RowItem[][] {
  if (items.length === 0) return []

  // Count-driven row count
  const numRows = Math.ceil(items.length / maxPerRow)

  // Distribute items evenly across rows
  const rows: RowItem[][] = []
  let idx = 0
  for (let r = 0; r < numRows; r++) {
    const remaining = items.length - idx
    const remainingRows = numRows - r
    const take = Math.min(maxPerRow, Math.ceil(remaining / remainingRows))
    const rowItems = items.slice(idx, idx + take)
    rows.push(positionRow(rowItems, usableW, portGap, groupGap))
    idx += take
  }

  return rows
}

/**
 * Build fiber port rows with sub-category separation (V0.7.2).
 *
 * SFP (千兆光纤), tenG (万兆光纤), and QSFP ports each get their own row group,
 * stacked vertically in order: SFP → tenG → QSFP.
 * Within each sub-category, rows are filled using count-driven maxPerRow rules.
 */
function buildFiberRows(
  sfpItems: FlatPort[],
  tenGItems: FlatPort[],
  qsfpItems: FlatPort[],
  usableW: number,
  portGap: number,
  groupGap: number,
): RowItem[][] {
  const rows: RowItem[][] = []
  if (sfpItems.length > 0) {
    rows.push(...fillRows(sfpItems, usableW, determineMaxPerRow(sfpItems.length), portGap, groupGap))
  }
  if (tenGItems.length > 0) {
    rows.push(...fillRows(tenGItems, usableW, determineMaxPerRow(tenGItems.length), portGap, groupGap))
  }
  if (qsfpItems.length > 0) {
    rows.push(...fillRows(qsfpItems, usableW, determineMaxPerRow(qsfpItems.length), portGap, groupGap))
  }
  return rows
}

/**
 * Compute a 2D port layout that fits within the given SVG dimensions.
 *
 * V0.7.0 algorithm (side-by-side):
 *   1. Separate ports into copper, fiber (sfp+tenG+qsfp), and mgmt groups.
 *   2. When both copper and fiber exist: lay them out side-by-side horizontally —
 *      copper on the left, fiber on the right. Each side fills rows independently
 *      within its allocated width using strict max-per-row rules.
 *   3. When fiber count > copper count, the sides swap: fiber left, copper right
 *      (fiber-primary device).
 *   4. When only one type exists: fill the full width with max-per-row rules.
 *   5. Mgmt ports always go at the bottom, full width.
 *   6. Port widths / gaps are compressed only when a row overflows the
 *      available width; the count-based row structure is never broken.
 *
 * Returns an array of positioned individual ports ready to render.
 */
export function getPortLayout(
  groups: ParsedPortGroup[],
  availableWidth: number,
  availableHeight: number,
): { ports: RenderedPort[]; rows: number } {
  const ports: RenderedPort[] = []

  if (groups.length === 0) return { ports, rows: 0 }

  // Layout constants
  const PORT_GAP = 3
  const GROUP_GAP = 10
  const H_MARGIN = 12
  const ROW_GAP = 5
  const SIDE_GAP = 10  // horizontal gap between left and right port groups

  const usableW = availableWidth - H_MARGIN * 2
  if (usableW <= 0) return { ports, rows: 0 }

  // ── 1. Separate into copper / fiber sub-categories / mgmt ──
  const copperGroups = groups.filter(g => g.category === 'copper')
  const sfpGroups = groups.filter(g => g.category === 'sfp')
  const tenGgroups = groups.filter(g => g.category === 'tenG')
  const qsfpGroups = groups.filter(g => g.category === 'qsfp')
  const mgmtGroups = groups.filter(g => g.category === 'mgmt')

  const copperTotal = copperGroups.reduce((s, g) => s + g.count, 0)
  const sfpTotal = sfpGroups.reduce((s, g) => s + g.count, 0)
  const tenGTotal = tenGgroups.reduce((s, g) => s + g.count, 0)
  const qsfpTotal = qsfpGroups.reduce((s, g) => s + g.count, 0)
  const fiberTotal = sfpTotal + tenGTotal + qsfpTotal

  // ── 2. Flatten with metadata ──
  const flatten = (grps: ParsedPortGroup[]): FlatPort[] => {
    const items: FlatPort[] = []
    for (const g of grps) {
      const meta = getPortTypeMetadata(g.type)
      for (let i = 0; i < g.count; i++) {
        items.push({ group: g, idxInGroup: i, meta })
      }
    }
    return items
  }

  const copperItems = flatten(copperGroups)
  const sfpItems = flatten(sfpGroups)
  const tenGItems = flatten(tenGgroups)
  const qsfpItems = flatten(qsfpGroups)
  const mgmtItems = flatten(mgmtGroups)

  const hasBoth = copperTotal > 0 && fiberTotal > 0

  // ── 3. Build main port rows (copper + fiber) ──
  let mainRows: RowItem[][] = []

  if (hasBoth) {
    // ── Side-by-side layout ──
    // Default: copper left, fiber right
    // When fiber > copper: swap → fiber left, copper right (fiber-primary device)
    const fiberIsLeft = fiberTotal > copperTotal

    // V0.7.4: Allocate width proportionally to each side's total visual width
    // (not port count). Fiber ports are physically wider (visualWidth 24–28)
    // than copper ports (visualWidth 20), so count-based allocation systematically
    // starves the fiber side and causes ports to overflow the viewBox.
    const copperVisualW = copperItems.reduce((s, p) => s + p.meta.visualWidth, 0)
    const fiberVisualW = sfpItems.reduce((s, p) => s + p.meta.visualWidth, 0) +
                         tenGItems.reduce((s, p) => s + p.meta.visualWidth, 0) +
                         qsfpItems.reduce((s, p) => s + p.meta.visualWidth, 0)
    const leftVisualW = fiberIsLeft ? fiberVisualW : copperVisualW
    const rightVisualW = fiberIsLeft ? copperVisualW : fiberVisualW
    const totalVisualW = leftVisualW + rightVisualW
    const leftShareW = totalVisualW > 0
      ? Math.floor((usableW - SIDE_GAP) * leftVisualW / totalVisualW)
      : Math.floor((usableW - SIDE_GAP) / 2)
    const rightShareW = usableW - SIDE_GAP - leftShareW

    // Build rows for each side.
    // Fiber side uses buildFiberRows to separate SFP / tenG / QSFP into distinct row groups.
    let leftRows: RowItem[][]
    let rightRows: RowItem[][]

    if (fiberIsLeft) {
      leftRows = buildFiberRows(sfpItems, tenGItems, qsfpItems, leftShareW, PORT_GAP, GROUP_GAP)
      rightRows = fillRows(copperItems, rightShareW, determineMaxPerRow(copperTotal), PORT_GAP, GROUP_GAP)
    } else {
      leftRows = fillRows(copperItems, leftShareW, determineMaxPerRow(copperTotal), PORT_GAP, GROUP_GAP)
      rightRows = buildFiberRows(sfpItems, tenGItems, qsfpItems, rightShareW, PORT_GAP, GROUP_GAP)
    }

    // Align both sides to the same row grid
    const maxRows = Math.max(leftRows.length, rightRows.length)
    const rightBaseX = leftShareW + SIDE_GAP

    for (let r = 0; r < maxRows; r++) {
      // Vertically center the shorter side within the combined row space
      const leftIdx = leftRows.length >= maxRows
        ? r
        : r - Math.floor((maxRows - leftRows.length) / 2)
      const rightIdx = rightRows.length >= maxRows
        ? r
        : r - Math.floor((maxRows - rightRows.length) / 2)

      const row: RowItem[] = []

      if (leftIdx >= 0 && leftIdx < leftRows.length) {
        for (const item of leftRows[leftIdx]) {
          // item.x is already centered within leftShareW
          row.push(item)
        }
      }
      if (rightIdx >= 0 && rightIdx < rightRows.length) {
        for (const item of rightRows[rightIdx]) {
          // Offset right-side items past the left portion + gap
          row.push({ ...item, x: rightBaseX + item.x })
        }
      }

      if (row.length > 0) {
        mainRows.push(row)
      }
    }
  } else {
    // ── Single-type layout: use full width ──
    if (copperTotal > 0) {
      const maxPerRow = determineMaxPerRow(copperTotal)
      mainRows = fillRows(copperItems, usableW, maxPerRow, PORT_GAP, GROUP_GAP)
    } else if (fiberTotal > 0) {
      // Fiber-only: separate sub-categories into distinct row groups
      mainRows = buildFiberRows(sfpItems, tenGItems, qsfpItems, usableW, PORT_GAP, GROUP_GAP)
    }
  }

  // ── 4. Mgmt rows (full width, always at bottom) ──
  const mgmtRows = fillRows(mgmtItems, usableW, mgmtItems.length || 1, PORT_GAP, GROUP_GAP)

  // ── 5. Combine all rows for vertical distribution ──
  const allRows = [...mainRows, ...mgmtRows]
  const numRows = allRows.length
  if (numRows === 0) return { ports, rows: 0 }

  // ── 6. Vertical distribution ──
  // V0.7.3: Per-row minimum heights based on port categories.
  // Fiber ports require taller rows (18–20) than copper (16).
  const ROW_HEIGHT_BY_CATEGORY: Record<string, number> = {
    copper: 16,
    sfp: 18,
    tenG: 18,
    qsfp: 20,
    mgmt: 14,
  }

  // Compute per-row heights: each row gets at least its category minimum
  const rowHeights: number[] = allRows.map(row => {
    let minH = 16 // default copper minimum
    for (const item of row) {
      const cat = item.port.meta.category
      minH = Math.max(minH, ROW_HEIGHT_BY_CATEGORY[cat] || 16)
    }
    return minH
  })

  // Total minimum height needed for all rows + gaps
  const totalMinH = rowHeights.reduce((s, h) => s + h, 0) + (numRows - 1) * ROW_GAP

  // If minimum height fits, distribute extra space proportionally.
  // If it overflows (shouldn't with proper SVG sizing), use minimum heights.
  if (totalMinH <= availableHeight) {
    const extraSpace = availableHeight - totalMinH
    const extraPerRow = Math.floor(extraSpace / numRows)
    for (let ri = 0; ri < rowHeights.length; ri++) {
      rowHeights[ri] = Math.min(20, rowHeights[ri] + extraPerRow)
    }
  }

  const totalPanelH = rowHeights.reduce((s, h) => s + h, 0) + (numRows - 1) * ROW_GAP
  const topOffset = Math.floor((availableHeight - totalPanelH) / 2)

  // V0.7.4: Sequential port numbering per display abbreviation across all rows.
  // E.g. 8×GE + 4×PoE → GE1..GE12 (not GE1..GE8 + GE1..GE4).
  const displayCounter: Record<string, number> = {}

  let currentY = topOffset
  for (let ri = 0; ri < allRows.length; ri++) {
    const row = allRows[ri]
    const rowH = rowHeights[ri]
    if (row.length === 0) continue

    for (const item of row) {
      const abbr = item.port.meta.abbreviation
      displayCounter[abbr] = (displayCounter[abbr] || 0) + 1
      ports.push({
        type: item.port.group.type,
        typeLabel: abbr,
        category: item.port.meta.category,
        portIndex: displayCounter[abbr],
        x: H_MARGIN + item.x,
        y: currentY,
        width: item.w,
        height: rowH,
      })
    }
    currentY += rowH + ROW_GAP
  }

  return { ports, rows: numRows }
}

/**
 * Quick estimate of the number of layout rows needed for the given port groups.
 * Used by DeviceNode to compute SVG height before the full layout runs.
 *
 * V0.7.2: Accounts for fiber sub-category separation (SFP / tenG / QSFP each get
 * their own row group) and side-by-side layout when both copper and fiber exist.
 */
export function countLayoutRows(groups: ParsedPortGroup[]): number {
  const copperTotal = groups.filter(g => g.category === 'copper').reduce((s, g) => s + g.count, 0)
  const sfpTotal = groups.filter(g => g.category === 'sfp').reduce((s, g) => s + g.count, 0)
  const tenGTotal = groups.filter(g => g.category === 'tenG').reduce((s, g) => s + g.count, 0)
  const qsfpTotal = groups.filter(g => g.category === 'qsfp').reduce((s, g) => s + g.count, 0)
  const mgmtTotal = groups.filter(g => g.category === 'mgmt').reduce((s, g) => s + g.count, 0)
  const fiberTotal = sfpTotal + tenGTotal + qsfpTotal

  const rowsFor = (n: number) => n > 0 ? Math.ceil(n / determineMaxPerRow(n)) : 0

  if (copperTotal > 0 && fiberTotal > 0) {
    // Side-by-side: rows = max(copper rows, fiber rows) + mgmt rows
    const fiberRows = rowsFor(sfpTotal) + rowsFor(tenGTotal) + rowsFor(qsfpTotal)
    return Math.max(rowsFor(copperTotal), fiberRows) + rowsFor(mgmtTotal)
  }
  // Single-type or fiber-only
  return rowsFor(copperTotal) + rowsFor(sfpTotal) + rowsFor(tenGTotal) + rowsFor(qsfpTotal) + rowsFor(mgmtTotal)
}

// ── V0.7.1: Modular port editing helpers ──────────────────────

/**
 * Compose three modular port counts into a ports_info string.
 * Only non-zero counts are included.
 *
 * Example: composePortsInfo(8, 4, 2) → "8×GE+4×SFP+2×10GE"
 *          composePortsInfo(24, 0, 0) → "24×GE"
 *          composePortsInfo(0, 0, 0)  → ""
 */
export function composePortsInfo(rj45: number, sfp: number, tenG: number): string {
  const parts: string[] = []
  if (rj45 > 0) parts.push(`${rj45}×GE`)
  if (sfp > 0) parts.push(`${sfp}×SFP`)
  if (tenG > 0) parts.push(`${tenG}×10GE`)
  return parts.join('+')
}

/**
 * Parse a ports_info string into the three modular counts.
 * Used for loading old-format data (DB templates / customPorts strings)
 * into the new three-field editing UI.
 *
 * Mapping rules:
 *   copper (GE/FE/PoE/etc.)          → rj45
 *   sfp (SFP only, not SFP+)         → sfp
 *   tenG (SFP+/10GE/25GE/40GE/100GE) → tenG
 *   qsfp                             → tenG (grouped under 万兆光纤 for editing)
 *   mgmt                             → ignored (not user-editable)
 */
export function parseModularPorts(portsInfo: string): { rj45: number; sfp: number; tenG: number } {
  const groups = parsePortsInfo(portsInfo)
  let rj45 = 0, sfp = 0, tenG = 0
  for (const g of groups) {
    switch (g.category) {
      case 'copper': rj45 += g.count; break
      case 'sfp':    sfp += g.count; break
      case 'tenG':
      case 'qsfp':   tenG += g.count; break
      // mgmt → ignored (management ports are not user-configurable)
    }
  }
  return { rj45, sfp, tenG }
}
