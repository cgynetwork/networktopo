// Device category (from database)
export interface DeviceCategory {
  id: number
  name: string
  icon: string
  sort_order: number
}

// Database row types
export interface CategoryRow {
  id: number
  name: string
  icon: string
  sort_order: number
}

export interface VendorRow {
  id: number
  name: string
  logo_path: string | null
}

export interface DeviceRow {
  id: number
  category_id: number
  vendor_id: number
  model: string
  description: string
  ports_info: string
  image_path: string | null
  category_name: string
  vendor_name: string
}

// Vendor
export interface Vendor {
  id: number
  name: string
  logo?: string
}

// Device model (from database)
export interface DeviceModel {
  id: number
  category_id: number
  vendor_id: number
  model: string
  description: string
  ports_info: string
  image_path?: string
  category_name?: string
  vendor_name?: string
}

// V1.5.0: 互联网应用多图上传
export interface AppImageItem {
  id: string       // 唯一标识 (crypto.randomUUID())
  dataUrl: string  // base64 data URL
  offsetX: number  // viewBox 内 x 偏移
  offsetY: number  // viewBox 内 y 偏移
  scale: number    // 缩放因子 (0.15~3.0)
}

// Connection type
export type ConnectionType = 'ethernet' | 'fiber' | 'stack' | 'wireless' | 'tunnel'

// Animation style
export type AnimationStyle = 'none' | 'particle' | 'glow' | 'wave'

// Edge path style — how the line is drawn between nodes
export type PathStyle = 'adaptive' | 'straight' | 'step'

// Edge data
export interface EdgeData {
  connectionType: ConnectionType
  animationStyle: AnimationStyle
  direction: 'forward' | 'reverse'
  pathStyle?: PathStyle
  bandwidth?: string
  cableLength?: string       // V0.9.2: 线缆长度，如 "0.3M"、"5M"
  sourcePort?: string
  targetPort?: string
  label?: string
  // V0.2.1: Custom appearance
  strokeWidth?: number      // 线缆粗细 1-10px，默认 3.5
  strokeColor?: string      // 线缆颜色 hex，默认根据连接类型自动
  animSpeed?: number        // 动画速度 0.25-4，默认 1（倍数，值越大越慢）
  particleSize?: number     // 粒子大小 2-12px，默认 4.5
  effectColor?: string      // 特效颜色 hex，默认 #2196F3
  elbowOffset?: number       // 肘形连接线偏移量 10-400px，默认 50。用于区分多条并行肘形线缆
  elbowHorizontalOffset?: number  // 肘形连接线水平偏移 -200~200px，默认 0。左右调节肘形垂直段位置
  edgeDescription?: string   // 线缆业务说明，编辑后在鼠标悬浮1.5s后显示
  // V0.8.1: Port label drag offsets — user-dragged label positions relative to default anchor
  sourcePortOffsetX?: number  // 源端口标签水平拖拽偏移 (px)，默认 0
  sourcePortOffsetY?: number  // 源端口标签垂直拖拽偏移 (px)，默认 0
  targetPortOffsetX?: number  // 目标端口标签水平拖拽偏移 (px)，默认 0
  targetPortOffsetY?: number  // 目标端口标签垂直拖拽偏移 (px)，默认 0
  // V1.5.1: Interface IP labels
  sourceIp?: string
  targetIp?: string
  sourceIpOffsetX?: number
  sourceIpOffsetY?: number
  targetIpOffsetX?: number
  targetIpOffsetY?: number
}

// Node data
export interface NodeData {
  label: string
  device: DeviceModel
  customName?: string
  customImage?: string
  // V1.5.0: 互联网应用自定义业务图片（多图 + 自由缩放）
  appImages?: AppImageItem[]
  // @deprecated V1.5.0: migrated to appImages[0] on load
  appImage?: string
  appImageOffset?: { x: number; y: number }
  customCategory?: string
  customVendor?: string
  customDeviceModel?: string
  customPorts?: string
  customColor?: string
  description?: string
  ipAddress?: string
  // V0.9.0: Device stacking mode
  isStacked?: boolean
  // V1.3.0: SDWAN CPE tunnel ports
  hasTunnelPorts?: boolean
  tunnelPortCount?: number  // V1.5.1: tunnel 端口数量，默认 2
  // V0.9.1: Port numbering options
  portZeroBased?: boolean   // When true, ports start from GE0 instead of GE1
  portInterleaved?: boolean  // When true, ports are numbered column-major (alternating rows)
  // V0.9.3: Business description — shown on long-hover tooltip
  businessNote?: string
  // V0.11.0: Node grouping — nodes with same groupName belong to a logical group
  groupName?: string
}

// ── Rack Cabinet Types ─────────────────────────────────

/** Rack accessory type */
export type RackAccessoryType = 'cable-management' | 'blanking-panel' | 'pdu'

/** Rack accessory configuration (stored in RackNodeData, not as React Flow nodes) */
export interface RackAccessory {
  id: string
  type: RackAccessoryType
  uPosition: number   // 0-based starting U position from top
  uHeight: number     // height in U units (1 for cable mgmt/blind, variable for PDU)
  label?: string
}

/** Rack view mode — front (机柜正面) shows device faceplates, back (机柜背面) shows rear panels */
export type RackViewMode = 'front' | 'back'

/** Rack node data (for 'rackNode' type) */
export interface RackNodeData {
  uHeight: number
  label: string
  viewMode: RackViewMode
  accessories: RackAccessory[]
}

/** Rack device node data (for 'rackDeviceNode' type) */
export interface RackDeviceNodeData {
  device: DeviceModel
  customName?: string
  customColor?: string
  customCategory?: string
  customVendor?: string
  customDeviceModel?: string
  customPorts?: string
  customPortsRJ45?: number
  customPortsSFP?: number
  customPortsSFP28?: number
  portZeroBased?: boolean
  portInterleaved?: boolean
  businessNote?: string
  uHeight: number           // U slots occupied (default based on category, user-adjustable)
  uPosition?: number        // V1.1.2: current 1-based U position in rack (computed from node position.y)
  parentViewMode?: RackViewMode  // V1.1.1: synced from parent rack so child re-renders on toggle
  powerSupplyCount?: number  // V1.1.2: number of power supplies (editable, shown on back panel)
  description?: string
  ipAddress?: string
}

// Topo file format
export interface TopoFile {
  version: string
  nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    parentId?: string       // V1.1.0: rack parent-child relationship
    extent?: 'parent'       // V1.1.0: constrain child to parent bounds
    data: NodeData | RackNodeData | RackDeviceNodeData
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    sourceHandle: string
    targetHandle: string
    data: EdgeData
  }>
}

// ── Type-safe node/edge accessors ─────────────────────────

import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react'

/** All possible node data types */
export type AnyNodeData = NodeData | RackNodeData | RackDeviceNodeData

/** React Flow node typed with Topo node data */
export type TopoNode = RFNode

/** React Flow edge typed with Topo's EdgeData */
export type TopoEdge = RFEdge<EdgeData>

/** Safely extract device info from a node's data (avoid scattering `as any`) */
export function getDeviceFromNode(node: RFNode): DeviceModel | undefined {
  const data = node?.data as unknown as AnyNodeData | undefined
  if (!data) return undefined
  // Both NodeData and RackDeviceNodeData have a 'device' field
  return (data as NodeData | RackDeviceNodeData).device
}

/** Safely extract NodeData from a generic React Flow node */
export function getNodeData(node: RFNode): NodeData | undefined {
  const data = node?.data as unknown as AnyNodeData | undefined
  if (!data) return undefined
  // NodeData has 'device' but NOT 'uHeight' (unlike RackDeviceNodeData).
  // RackNodeData has no 'device' at all. This correctly distinguishes the three types.
  if ('device' in data && !('uHeight' in data)) {
    return data as NodeData
  }
  return undefined
}

/** Safely extract EdgeData from a generic React Flow edge */
export function getEdgeData(edge: RFEdge): EdgeData | undefined {
  return edge?.data as EdgeData | undefined
}
