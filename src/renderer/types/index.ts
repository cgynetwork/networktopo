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

// Connection type
export type ConnectionType = 'ethernet' | 'fiber'

// Animation style
export type AnimationStyle = 'none' | 'particle' | 'glow'

// Edge path style — how the line is drawn between nodes
export type PathStyle = 'adaptive' | 'straight' | 'step'

// Edge data
export interface EdgeData {
  connectionType: ConnectionType
  animationStyle: AnimationStyle
  direction: 'forward' | 'reverse'
  pathStyle?: PathStyle
  bandwidth?: string
  sourcePort?: string
  targetPort?: string
  label?: string
  // V0.2.1: Custom appearance
  strokeWidth?: number      // 线缆粗细 1-10px，默认 3.5
  strokeColor?: string      // 线缆颜色 hex，默认根据连接类型自动
  animSpeed?: number        // 动画速度 0.25-4，默认 1（倍数，值越大越慢）
  particleSize?: number     // 粒子大小 2-12px，默认 4.5
  effectColor?: string      // 特效颜色 hex，默认 #2196F3
  elbowOffset?: number       // 肘形连接线偏移量 10-250px，默认 50。用于区分多条并行肘形线缆
}

// Node data
export interface NodeData {
  label: string
  device: DeviceModel
  customName?: string
  customImage?: string
  customCategory?: string
  customVendor?: string
  customDeviceModel?: string
  customPorts?: string
  customColor?: string
}

// Topo file format
export interface TopoFile {
  version: string
  nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: NodeData
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

/** React Flow node typed with Topo's NodeData */
export type TopoNode = RFNode<NodeData>

/** React Flow edge typed with Topo's EdgeData */
export type TopoEdge = RFEdge<EdgeData>

/** Safely extract device info from a node's data (avoid scattering `as any`) */
export function getDeviceFromNode(node: RFNode): DeviceModel | undefined {
  const data = node?.data as NodeData | undefined
  return data?.device
}

/** Safely extract NodeData from a generic React Flow node */
export function getNodeData(node: RFNode): NodeData | undefined {
  return node?.data as NodeData | undefined
}

/** Safely extract EdgeData from a generic React Flow edge */
export function getEdgeData(edge: RFEdge): EdgeData | undefined {
  return edge?.data as EdgeData | undefined
}
