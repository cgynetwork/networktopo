// ── Rack Cabinet Constants ────────────────────────────────

/** Pixels per 1U (1 rack unit = 1.75 inches, ~28px gives good visual proportion) */
export const U_PX_HEIGHT = 28

/** Rack top header height (px) — contains rack name/title */
export const RACK_HEADER_H = 36

/** Rack bottom footer height (px) */
export const RACK_FOOTER_H = 16

/** Left U-marker rail width (px) */
export const RACK_RAIL_W = 40

/** Rack total width in front (正面) mode — shows device faceplates */
export const RACK_FRONT_W = 320

/** Rack total width in back (背面) mode — shows device rear panels */
export const RACK_BACK_W = 320

// Legacy aliases for backward compatibility
/** @deprecated Use RACK_FRONT_W */
export const RACK_COMPACT_W = RACK_FRONT_W
/** @deprecated Use RACK_BACK_W */
export const RACK_DETAIL_W = RACK_BACK_W

/** Interior content area width (front mode) — space for device faceplates */
export const RACK_CONTENT_W_FRONT = RACK_FRONT_W - RACK_RAIL_W - 8

/** Interior content area width (back mode) — space for device rear panels */
export const RACK_CONTENT_W_BACK = RACK_BACK_W - RACK_RAIL_W - 8

// Legacy aliases
/** @deprecated Use RACK_CONTENT_W_FRONT */
export const RACK_CONTENT_W_COMPACT = RACK_CONTENT_W_FRONT
/** @deprecated Use RACK_CONTENT_W_BACK */
export const RACK_CONTENT_W_DETAIL = RACK_CONTENT_W_BACK

// ── Rack Size Definitions ──────────────────────────────────

export interface RackSizeDef {
  uHeight: number
  /** Translation key suffix — one of 'wallMount', 'small', 'medium', 'standard', 'large' */
  labelKey: string
}

/** Standard rack sizes available in sidebar */
export const RACK_SIZES: RackSizeDef[] = [
  { uHeight: 6, labelKey: 'wallMount' },
  { uHeight: 9, labelKey: 'wallMount' },
  { uHeight: 12, labelKey: 'wallMount' },
  { uHeight: 18, labelKey: 'small' },
  { uHeight: 22, labelKey: 'small' },
  { uHeight: 27, labelKey: 'medium' },
  { uHeight: 32, labelKey: 'medium' },
  { uHeight: 36, labelKey: 'medium' },
  { uHeight: 42, labelKey: 'standard' },
  { uHeight: 45, labelKey: 'large' },
  { uHeight: 47, labelKey: 'large' },
]

/**
 * Build a localized rack size label.
 * Usage: getRackSizeLabel(size, t) where t is the i18next t function
 */
export function getRackSizeLabel(size: RackSizeDef, t: (key: string, options?: Record<string, unknown>) => string): string {
  return t(`sidebar.rackSizes.${size.labelKey}`, { u: size.uHeight })
}

// ── Default U-Height by Category ───────────────────────────

/** Default U-height for each device category when placed in a rack */
export const DEFAULT_U_HEIGHTS: Record<string, number> = {
  '防火墙': 1,
  '交换机': 1,
  '无线控制器': 1,
  '无线接入点': 1,
  '服务器': 2,
  '终端-PC': 1,
  '终端-笔记本': 1,
  '配线架': 1,
  '超融合': 2,
  '存储': 2,
  '运营商光猫': 1,
  'SDWAN': 1,
}

// ── Utility Functions ──────────────────────────────────────

/** Compute total rack node height from U count */
export function getRackHeight(uHeight: number): number {
  return RACK_HEADER_H + uHeight * U_PX_HEIGHT + RACK_FOOTER_H
}

/** Get rack node width based on view mode */
export function getRackNodeWidth(viewMode: 'front' | 'back'): number {
  return viewMode === 'front' ? RACK_FRONT_W : RACK_BACK_W
}

/** Get interior content area width */
export function getRackContentWidth(viewMode: 'front' | 'back'): number {
  return viewMode === 'front' ? RACK_CONTENT_W_FRONT : RACK_CONTENT_W_BACK
}

/** Get default U-height for a device by category name */
export function getDefaultUHeight(categoryName: string): number {
  return DEFAULT_U_HEIGHTS[categoryName] ?? 1
}

/** Occupied slot descriptor */
export interface OccupiedSlot {
  uPosition: number  // 0-based U position from top of rack
  uHeight: number    // number of U slots occupied
}

/**
 * Find the first contiguous free U-slot range that fits the needed height.
 * Returns the 0-based starting U position, or -1 if no space available.
 */
export function findFreeUSlot(
  totalU: number,
  neededU: number,
  occupiedSlots: OccupiedSlot[],
): number {
  const occupied = new Array<boolean>(totalU).fill(false)
  for (const slot of occupiedSlots) {
    for (let i = slot.uPosition; i < slot.uPosition + slot.uHeight && i < totalU; i++) {
      occupied[i] = true
    }
  }
  // Find first contiguous range of neededU free slots
  let consecutive = 0
  for (let i = 0; i < totalU; i++) {
    if (!occupied[i]) {
      consecutive++
      if (consecutive >= neededU) {
        return i - neededU + 1
      }
    } else {
      consecutive = 0
    }
  }
  return -1
}

/**
 * Snap a relative Y position (within the rack content area) to the nearest U slot.
 * Returns the snapped Y offset from the rack's content top.
 */
export function snapToUSlot(
  relativeY: number,
  deviceUHeight: number,
  totalU: number,
): number {
  // Convert relativeY to U position (relativeY is from top of content area)
  const rawU = (relativeY - RACK_HEADER_H) / U_PX_HEIGHT
  const snappedU = Math.max(0, Math.min(totalU - deviceUHeight, Math.round(rawU)))
  return RACK_HEADER_H + snappedU * U_PX_HEIGHT
}

/**
 * Convert a U position (0-based) to pixel offset within the rack (from rack top-left).
 * This is the Y position for a child node relative to the rack.
 */
export function uPositionToPixelY(uPosition: number): number {
  return RACK_HEADER_H + uPosition * U_PX_HEIGHT
}

/**
 * Get the bounds of a rack node in flow coordinates.
 */
export function getRackBounds(
  rackPosition: { x: number; y: number },
  uHeight: number,
  viewMode: 'front' | 'back',
): { x: number; y: number; width: number; height: number } {
  return {
    x: rackPosition.x,
    y: rackPosition.y,
    width: getRackNodeWidth(viewMode),
    height: getRackHeight(uHeight),
  }
}

/**
 * Check if a flow position is inside a rack node's bounds.
 */
export function isPositionInRack(
  flowX: number,
  flowY: number,
  rackNode: { position: { x: number; y: number }; data: { uHeight: number; viewMode?: 'front' | 'back' } },
): boolean {
  const bounds = getRackBounds(
    rackNode.position,
    rackNode.data.uHeight,
    rackNode.data.viewMode ?? 'front',
  )
  return (
    flowX >= bounds.x &&
    flowX <= bounds.x + bounds.width &&
    flowY >= bounds.y &&
    flowY <= bounds.y + bounds.height
  )
}

/**
 * Get the list of occupied slots from rack child nodes and accessories.
 */
export function getOccupiedSlots(
  childDevices: Array<{ uPosition: number; uHeight: number }>,
  accessories: Array<{ uPosition: number; uHeight: number }>,
): OccupiedSlot[] {
  return [
    ...childDevices.map(d => ({ uPosition: d.uPosition, uHeight: d.uHeight })),
    ...accessories.map(a => ({ uPosition: a.uPosition, uHeight: a.uHeight })),
  ]
}

/**
 * Compute the U position from a child node's relative Y within the rack.
 */
export function pixelYToUPosition(relativeY: number): number {
  return Math.round((relativeY - RACK_HEADER_H) / U_PX_HEIGHT)
}

/**
 * Clamp a device's Y position so its full height stays strictly within the rack's U-range.
 * Returns the clamped Y offset from rack top-left.
 *
 * This prevents devices from visually overflowing the rack boundary when placed near
 * the bottom — React Flow's `extent: 'parent'` only constrains the top-left corner.
 */
export function clampDeviceInRack(
  relativeY: number,
  deviceUHeight: number,
  totalU: number,
): number {
  const minY = RACK_HEADER_H  // top of content area
  const maxY = RACK_HEADER_H + (totalU - deviceUHeight) * U_PX_HEIGHT  // bottommost valid position
  return Math.max(minY, Math.min(relativeY, maxY))
}

/**
 * Compute the 1-based display U position from a child node's relative Y within the rack.
 * Follows EIA-310-D: U1 is at the bottom, highest U at the top.
 * For a 42U rack: top slot displays as U42, bottom slot as U1.
 *
 * @param relativeY - child node's Y offset from rack top-left
 * @param totalU - total U height of the rack
 */
export function pixelYToUDisplay(relativeY: number, totalU: number): number {
  return totalU - pixelYToUPosition(relativeY)
}

/**
 * Migrate old viewMode values to the new front/back scheme.
 * V1.1.0 used 'compact'/'detail'; V1.1.2 uses 'front'/'back'.
 * Call this on all nodes after loading a .topo file.
 */
export function migrateViewMode(viewMode: string | undefined): 'front' | 'back' {
  if (viewMode === 'compact') return 'front'
  if (viewMode === 'detail') return 'back'
  if (viewMode === 'front' || viewMode === 'back') return viewMode
  return 'front' // default for unknown/missing
}
