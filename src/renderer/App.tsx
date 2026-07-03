import { useCallback, useEffect, useMemo, useState, useRef, DragEvent } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  addEdge,
  BackgroundVariant,
  ReactFlowProvider,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Sidebar from './components/Sidebar/Sidebar'
import PropertyPanel from './components/PropertyPanel/PropertyPanel'
import Toolbar from './components/Toolbar/Toolbar'
import ToastContainer from './components/Toast/ToastContainer'
import ConfirmDialog from './components/ConfirmDialog/ConfirmDialog'
import CanvasContextMenu from './components/CanvasContextMenu'
import type { ContextMenuState } from './components/CanvasContextMenu'
import PromptDialog from './components/PromptDialog/PromptDialog'
import RackDevicePickerModal from './components/RackDevicePickerModal'
import DeviceNode from './components/nodes/DeviceNode'
import RackNode from './components/nodes/RackNode'
import RackDeviceNode from './components/nodes/RackDeviceNode'
import AnimatedEdge from './components/edges/AnimatedEdge'
import type { DeviceRow, EdgeData, PathStyle, RackNodeData, RackDeviceNodeData, RackViewMode } from './types'
import { getDeviceFromNode, getNodeData } from './types'
import { getDefaultPortLabel, listAllPorts } from './utils/portParser'
import {
  RACK_HEADER_H, RACK_RAIL_W, U_PX_HEIGHT,
  getRackNodeWidth, getRackHeight, getDefaultUHeight,
  findFreeUSlot, snapToUSlot, isPositionInRack, getOccupiedSlots,
  uPositionToPixelY, pixelYToUPosition, clampDeviceInRack,
  pixelYToUDisplay, migrateViewMode,
} from './utils/rackUtils'
import { useHistory } from './hooks/useHistory'
import { useGifExport } from './hooks/useGifExport'
import { useFileOperations } from './hooks/useFileOperations'
import { useTheme } from './context/ThemeContext'
import { useToast } from './context/ToastContext'
import { DragStateContext } from './context/DragStateContext'
import { DemoModeContext } from './context/DemoModeContext'

// Custom node and edge types for React Flow
const nodeTypes = {
  deviceNode: DeviceNode,
  rackNode: RackNode,
  rackDeviceNode: RackDeviceNode,
}

const edgeTypes = {
  animated: AnimatedEdge,
}

// Default edge data
const defaultEdgeData: EdgeData = {
  connectionType: 'ethernet',
  animationStyle: 'particle',
  direction: 'forward',
  pathStyle: 'adaptive',
}

// Initial empty canvas
const initialNodes: Node[] = []
const initialEdges: Edge[] = []

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const selectedCount = useMemo(() => nodes.filter(n => n.selected).length, [nodes])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const toggleDemoMode = useCallback(() => setIsDemoMode(prev => !prev), [])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [templateList, setTemplateList] = useState<{ name: string; file: string }[]>([])
  const [viewportZoom, setViewportZoom] = useState(1)
  // V1.1.1: Drag hover highlight — track which rack a device is being dragged over
  const [dragOverRackId, setDragOverRackId] = useState<string | null>(null)
  const dragOverRackIdRef = useRef<string | null>(null)
  // V1.1.1: Device picker modal for adding devices to rack via context menu
  const [rackDevicePicker, setRackDevicePicker] = useState<{ rackId: string } | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()

  // ── Canvas search ────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return nodes.filter(n => {
      const data = getNodeData(n)
      if (!data) return false
      return (
        data.customName?.toLowerCase().includes(q) ||
        data.device?.model?.toLowerCase().includes(q) ||
        data.device?.vendor_name?.toLowerCase().includes(q) ||
        data.device?.category_name?.toLowerCase().includes(q) ||
        data.description?.toLowerCase().includes(q) ||
        data.ipAddress?.toLowerCase().includes(q) ||
        data.businessNote?.toLowerCase().includes(q)
      )
    })
  }, [nodes, searchQuery])

  const handleSearchSelect = useCallback((nodeId: string) => {
    if (!rfInstance) return
    const node = nodesRef.current.find(n => n.id === nodeId)
    if (!node) return
    // Clear all selections, select this node, and zoom to it
    setNodes((nds) => nds.map(n => ({ ...n, selected: n.id === nodeId })))
    setSelectedNode(node)
    setSelectedEdge(null)
    setPanelCollapsed(false)
    setSearchOpen(false)
    setSearchQuery('')
    // Zoom to node with animation
    rfInstance.fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 0.4 })
  }, [rfInstance, setNodes])

  // ── Confirmation dialogs ──────────────────────────────────
  const [showNewConfirm, setShowNewConfirm] = useState(false)
  const [showOpenConfirm, setShowOpenConfirm] = useState(false)
  const [showAutoSaveRecover, setShowAutoSaveRecover] = useState<string | null>(null) // stores the content to recover

  // ── Prompt dialog (replaces window.prompt) ─────────────────
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptTitle, setPromptTitle] = useState('')
  const [promptMessage, setPromptMessage] = useState('')
  const [promptDefaultValue, setPromptDefaultValue] = useState('')
  const promptResolveRef = useRef<((value: string | null) => void) | null>(null)

  const showPrompt = useCallback((title: string, message?: string, defaultValue?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      promptResolveRef.current = resolve
      setPromptTitle(title)
      setPromptMessage(message || '')
      setPromptDefaultValue(defaultValue || '')
      setPromptOpen(true)
    })
  }, [])

  // ── Context menu state (unified: edge + node) ────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // ── Clipboard for copy/paste ──────────────────────────────
  interface ClipboardItem { position: { x: number; y: number }; data: Record<string, unknown> }
  const clipboardRef = useRef<ClipboardItem[]>([])
  const [hasClipboard, setHasClipboard] = useState(false)

  // ── Undo/Redo history ────────────────────────────────────
  const history = useHistory()
  const isDraggingRef = useRef(false)
  // Debounce slider edits: only snapshot once per continuous change
  const sliderSnapshotRef = useRef<Map<string, string>>(new Map())
  const sliderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── File tracking (auto-save + recent files) ─────────────
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // ── Connection ──────────────────────────────────────────
  const isValidConnection = useCallback(
    (connection: Connection) => {
      // Prevent self-connections
      if (connection.source === connection.target) return false
      // V0.9.0: STACK port can only connect to STACK port
      const srcIsStack = connection.sourceHandle === 'STACK'
      const tgtIsStack = connection.targetHandle === 'STACK'
      if (srcIsStack !== tgtIsStack) return false
      // V1.3.0: TUNNEL port can only connect to CP-LEFT/CP-RIGHT (SDWAN Node)
      const srcIsTunnel = connection.sourceHandle?.startsWith('TUNNEL-')
      const tgtIsTunnel = connection.targetHandle?.startsWith('TUNNEL-')
      const srcIsCp = connection.sourceHandle?.startsWith('CP-')
      const tgtIsCp = connection.targetHandle?.startsWith('CP-')
      if ((srcIsTunnel && !tgtIsCp) || (tgtIsTunnel && !srcIsCp)) return false
      // V0.9.3: WLAN port can only connect to WLAN port or Wireless AP
      const srcIsWlan = connection.sourceHandle === 'WLAN'
      const tgtIsWlan = connection.targetHandle === 'WLAN'
      if (srcIsWlan || tgtIsWlan) {
        // WLAN-to-WLAN is allowed
        if (srcIsWlan && tgtIsWlan) return true
        // One end is WLAN, the other must be a wireless AP
        const otherNodeId = srcIsWlan ? connection.target : connection.source
        const otherNode = nodesRef.current.find(n => n.id === otherNodeId)
        const otherDevice = getDeviceFromNode(otherNode!)
        if (otherDevice?.category_name !== '无线接入点') return false
        return true
      }
      return true
    },
    [],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      console.log('[onConnect] connection created:', connection)
      // V0.8.0: Extract port labels from handle IDs when using port-level handles.
      // New handle IDs are the port labels themselves (e.g. "GE1", "SFP3").
      // Old handle IDs follow the pattern "side-type-n" (e.g. "top-src-0") — fall back.
      const isPortHandle = (id?: string | null): id is string =>
        !!id && !id.includes('-src-') && !id.includes('-tgt-')

      // Prefer handle ID as port label; fall back to auto-assign for old-format handles
      let sourcePort = isPortHandle(connection.sourceHandle) ? connection.sourceHandle : ''
      let targetPort = isPortHandle(connection.targetHandle) ? connection.targetHandle : ''

      // Fallback: auto-assign first available port when handle ID is old-format
      if (!sourcePort || !targetPort) {
        const srcNode = nodesRef.current.find(n => n.id === connection.source)
        const tgtNode = nodesRef.current.find(n => n.id === connection.target)
        const srcDevice = getDeviceFromNode(srcNode!)
        const tgtDevice = getDeviceFromNode(tgtNode!)
        if (!sourcePort && srcDevice?.ports_info) {
          const srcData = getNodeData(srcNode!)
          sourcePort = listAllPorts(srcDevice.ports_info, {
            zeroBased: srcData?.portZeroBased,
            interleaved: srcData?.portInterleaved,
          })[0] || getDefaultPortLabel(srcDevice.ports_info)
        }
        if (!targetPort && tgtDevice?.ports_info) {
          const tgtData = getNodeData(tgtNode!)
          targetPort = listAllPorts(tgtDevice.ports_info, {
            zeroBased: tgtData?.portZeroBased,
            interleaved: tgtData?.portInterleaved,
          })[0] || getDefaultPortLabel(tgtDevice.ports_info)
        }
      }

      history.pushSnapshot(nodesRef.current, edges)

      // V0.9.0: Auto-detect STACK-to-STACK connection
      const isStackConnection = connection.sourceHandle === 'STACK' && connection.targetHandle === 'STACK'
      // V1.3.0: Auto-detect TUNNEL-to-CP connection
      const isTunnelConnection = (!!connection.sourceHandle?.startsWith('TUNNEL-')) || (!!connection.targetHandle?.startsWith('TUNNEL-'))
      // V0.9.3: Auto-detect WLAN connection
      const isWirelessConnection = connection.sourceHandle === 'WLAN' || connection.targetHandle === 'WLAN'

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'animated',
            data: {
              ...defaultEdgeData,
              sourcePort,
              targetPort,
              ...(isStackConnection ? { connectionType: 'stack', pathStyle: 'step' as PathStyle } : {}),
              ...(isTunnelConnection ? { connectionType: 'tunnel' as EdgeData['connectionType'], pathStyle: 'step' as PathStyle } : {}),
              ...(isWirelessConnection ? { connectionType: 'wireless' as EdgeData['connectionType'], animationStyle: 'wave' as EdgeData['animationStyle'] } : {}),
            },
          },
          eds
        )
      )
      setIsDirty(true)
    },
    [setEdges, edges, history],
  )

  // ── Selection ───────────────────────────────────────────
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node)
      setSelectedEdge(null)
      setPanelCollapsed(false)
    },
    [],
  )

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge)
      setSelectedNode(null)
      setPanelCollapsed(false)
    },
    [],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
    setPanelCollapsed(true)
    setContextMenu(null)
  }, [])

  // ── Canvas background right-click context menu ────────────
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      event.preventDefault()
      // Check hasClipboard from ref (real-time, not stale state)
      const canPaste = clipboardRef.current.length > 0
      setHasClipboard(canPaste)
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'canvas',
        id: '',
      })
    },
    [],
  )

  // ── Selection change (multi-select tracking) ──────────────
  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      // Use React Flow's callback params — they come from Zustand store, always in sync
      const count = selNodes.length
      if (count === 1) {
        setSelectedNode(selNodes[0])
        setSelectedEdge(null)
        setPanelCollapsed(false)
      } else if (count > 1) {
        setSelectedNode(null)
        setSelectedEdge(null)
        setPanelCollapsed(false)
      } else if (selEdges.length > 0) {
        setSelectedEdge(selEdges[0])
        setSelectedNode(null)
        setPanelCollapsed(false)
      } else {
        setSelectedNode(null)
        setSelectedEdge(null)
        setPanelCollapsed(true)
      }
    },
    [],
  )

  // ── Edge right-click context menu ─────────────────────────
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'edge',
        id: edge.id,
      })
    },
    [],
  )

  // ── Node right-click context menu ─────────────────────────
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      // Check selection via refs (synced from React state) rather than callback's
      // `node.selected` which may be stale from React Flow's internal userNode ref
      const currentNodes = nodesRef.current
      const selectedNodes = currentNodes.filter(n => n.selected)
      const isMultiSelect = selectedNodes.length > 1
      const clickedNodeIsSelected = selectedNodes.some(n => n.id === node.id)
      if (isMultiSelect && clickedNodeIsSelected) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          type: 'batch',
          id: '',
        })
      } else {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          type: 'node',
          id: node.id,
          nodeType: node.type,
        })
      }
    },
    [],
  )

  // ── Selection overlay right-click (multi-select nodes) ─────
  // React Flow v12 renders a NodesSelection overlay on top of selected nodes
  // which intercepts contextmenu events. We must handle this separately.
  const onSelectionContextMenu = useCallback(
    (event: React.MouseEvent, selNodes: Node[]) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'batch',
        id: '',
      })
    },
    [],
  )

  const handleDeleteEdge = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'edge') return
    history.pushSnapshot(nodesRef.current, edges)
    setEdges((eds) => eds.filter((e) => e.id !== contextMenu.id))
    setSelectedEdge(null)
    setContextMenu(null)
    setIsDirty(true)
  }, [contextMenu, setEdges, edges, history])

  const handleDeleteNode = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'node') return
    const nodeId = contextMenu.id
    history.pushSnapshot(nodesRef.current, edges)
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
    setContextMenu(null)
    setIsDirty(true)
  }, [contextMenu, setNodes, setEdges, edges, history])

  const handleDeleteBatch = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'batch') return
    const selectedNodes = nodesRef.current.filter(n => n.selected)
    const selectedEdges = edgesRef.current.filter(e => e.selected)
    if (selectedNodes.length > 0 || selectedEdges.length > 0) {
      history.pushSnapshot(nodesRef.current, edgesRef.current)
      setNodes((nds) => nds.filter(n => !n.selected))
      setEdges((eds) => eds.filter(e => !e.selected))
      setSelectedNode(null)
      setSelectedEdge(null)
      setContextMenu(null)
      setIsDirty(true)
    }
  }, [contextMenu, setNodes, setEdges, history])

  // ── Ungroup single node ─────────────────────────────────
  const handleUngroupNode = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'node') return
    const nodeId = contextMenu.id
    const node = nodesRef.current.find(n => n.id === nodeId)
    if (!node) return
    const data = getNodeData(node)
    if (!data?.groupName) return
    history.pushSnapshot(nodesRef.current, edges)
    setNodes((nds) => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, groupName: undefined } } : n
    ))
    setIsDirty(true)
    setContextMenu(null)
    toast.showToast('已取消分组', 'info')
  }, [contextMenu, setNodes, edges, history, toast])

  // ── Ungroup batch (selected nodes) ──────────────────────
  const handleUngroupBatch = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'batch') return
    const selectedNodes = nodesRef.current.filter(n => n.selected)
    const groupedCount = selectedNodes.filter(n => {
      const data = getNodeData(n)
      return !!data?.groupName
    }).length
    if (groupedCount === 0) return
    history.pushSnapshot(nodesRef.current, edges)
    setNodes((nds) => nds.map(n =>
      n.selected ? { ...n, data: { ...n.data, groupName: undefined } } : n
    ))
    setIsDirty(true)
    setContextMenu(null)
    toast.showToast(`已取消分组（${groupedCount} 台设备）`, 'info')
  }, [contextMenu, setNodes, edges, history, toast])

  // ── V1.1.1: Add device to rack via context menu ──────────
  const handleAddDeviceToRack = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'node') return
    const rackId = contextMenu.id
    setContextMenu(null)
    setRackDevicePicker({ rackId })
  }, [contextMenu])

  // ── V1.1.1: Confirm adding device from picker ────────────
  const handlePickDeviceForRack = useCallback((device: DeviceRow, rackId: string) => {
    const currentNodes = nodesRef.current
    const targetRack = currentNodes.find(n => n.id === rackId)
    if (!targetRack) return
    const rackData = targetRack.data as unknown as RackNodeData
    const targetUHeight = getDefaultUHeight(device.category_name)

    // Collect occupied slots
    const childNodes = currentNodes.filter(n => n.parentId === rackId)
    const occupiedSlots = getOccupiedSlots(
      childNodes.map(n => ({
        uPosition: pixelYToUPosition(n.position.y),
        uHeight: (n.data as unknown as RackDeviceNodeData).uHeight || 1,
      })),
      rackData.accessories || [],
    )

    const freeU = findFreeUSlot(rackData.uHeight, targetUHeight, occupiedSlots)
    if (freeU < 0) {
      toast.showToast('机柜空间不足，无法放入该设备', 'warning')
      setRackDevicePicker(null)
      return
    }

    history.pushSnapshot(currentNodes, edges)
    const newNode: Node = {
      id: `device-${Date.now()}`,
      type: 'rackDeviceNode',
      parentId: rackId,
      extent: 'parent' as const,
      position: {
        x: RACK_RAIL_W + 4,
        y: uPositionToPixelY(freeU),
      },
      data: {
        device,
        customName: '',
        uHeight: targetUHeight,
        uPosition: rackData.uHeight - freeU,
        parentViewMode: rackData.viewMode,
        powerSupplyCount: 1,
      } as unknown as Record<string, unknown>,
    }
    setNodes((nds) => [...nds, newNode])
    setIsDirty(true)
    setRackDevicePicker(null)
    toast.showToast(`已添加 ${device.vendor_name} ${device.model} 到 ${rackData.label}`, 'success')
  }, [edges, history, setNodes, toast])

  // ── Copy node (single selection) ──────────────────────────
  const handleCopyNode = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'node') return
    const node = nodesRef.current.find(n => n.id === contextMenu.id)
    if (!node) return
    clipboardRef.current = [{
      position: { ...node.position },
      data: JSON.parse(JSON.stringify(node.data)),
    }]
    setHasClipboard(true)
    setContextMenu(null)
  }, [contextMenu])

  // ── Copy batch (multi-selection) ──────────────────────────
  const handleCopyBatch = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'batch') return
    const selectedNodes = nodesRef.current.filter(n => n.selected)
    if (selectedNodes.length === 0) return
    clipboardRef.current = selectedNodes.map(n => ({
      position: { ...n.position },
      data: JSON.parse(JSON.stringify(n.data)),
    }))
    setHasClipboard(true)
    setContextMenu(null)
  }, [contextMenu])

  // ── Paste nodes from clipboard ───────────────────────────
  const doPaste = useCallback(() => {
    if (clipboardRef.current.length === 0) return
    history.pushSnapshot(nodesRef.current, edges)
    const offset = { x: 50, y: 50 }
    const newNodes: Node[] = clipboardRef.current.map((item, i) => ({
      id: `device-${Date.now()}-${i}`,
      type: 'deviceNode' as const,
      position: {
        x: item.position.x + offset.x,
        y: item.position.y + offset.y,
      },
      data: JSON.parse(JSON.stringify(item.data)),
      selected: true,
    }))
    setNodes((nds) => [
      ...nds.map(n => ({ ...n, selected: false })),
      ...newNodes,
    ])
    setIsDirty(true)
    setContextMenu(null)
  }, [setNodes, edges, history])

  // ── Duplicate selected nodes (Ctrl+D) ────────────────────
  const doDuplicate = useCallback(() => {
    const selectedNodes = nodesRef.current.filter(n => n.selected)
    if (selectedNodes.length === 0) return
    history.pushSnapshot(nodesRef.current, edges)
    const newNodes: Node[] = selectedNodes.map((node, i) => ({
      id: `device-${Date.now()}-${i}`,
      type: 'deviceNode' as const,
      position: {
        x: node.position.x + 30,
        y: node.position.y + 30,
      },
      data: JSON.parse(JSON.stringify(node.data)),
      selected: true,
    }))
    setNodes((nds) => [
      ...nds.map(n => ({ ...n, selected: false })),
      ...newNodes,
    ])
    setIsDirty(true)
  }, [setNodes, edges, history])

  // ── Edge path style change ───────────────────────────────
  const handleEdgePathStyle = useCallback(
    (style: PathStyle) => {
      if (!contextMenu || contextMenu.type !== 'edge') return
      const edgeId = contextMenu.id
      history.pushSnapshot(nodesRef.current, edges)
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === edgeId) {
            return { ...edge, data: { ...edge.data, pathStyle: style } }
          }
          return edge
        })
      )
      // Update selectedEdge if it's the same one
      setSelectedEdge((prev) => {
        if (prev && prev.id === edgeId) {
          return { ...prev, data: { ...prev.data, pathStyle: style } }
        }
        return prev
      })
      setContextMenu(null)
      setIsDirty(true)
    },
    [contextMenu, setEdges, edges, history],
  )

  // ── Topology templates ────────────────────────────────────
  const refreshTemplateList = useCallback(async () => {
    try {
      const list = await window.electronAPI.listTemplates()
      setTemplateList(list)
    } catch { /* ignore */ }
  }, [])

  const handleSaveAsTemplate = useCallback(async () => {
    const name = await showPrompt('保存拓扑模板', '请输入模板名称：', '')
    if (!name || !name.trim()) return
    if (!rfInstance) {
      toast.showToast('画布未就绪，请稍后重试', 'error')
      return
    }
    try {
      const flow = rfInstance.toObject()
      const topoFile = { version: '1.0.0', nodes: flow.nodes, edges: flow.edges, viewport: flow.viewport }
      const result = await window.electronAPI.saveTemplate(name.trim(), JSON.stringify(topoFile, null, 2))
      if (result.success) {
        toast.showToast(`模板「${result.name}」已保存`, 'success')
        refreshTemplateList()
      } else {
        toast.showToast(`保存失败：${result.error}`, 'error')
      }
    } catch (err: any) {
      toast.showToast(`保存模板失败：${err.message}`, 'error')
    }
  }, [rfInstance, refreshTemplateList, toast, showPrompt])

  const handleLoadTemplate = useCallback(async (templateName: string) => {
    try {
      const content = await window.electronAPI.loadTemplate(templateName)
      const topoFile = JSON.parse(content)
      const loadedNodes = (topoFile.nodes || []).map((n: Node) => {
        const data = n.data as Record<string, unknown> | undefined
        if (data && 'viewMode' in data) {
          data.viewMode = migrateViewMode(data.viewMode as string | undefined)
        }
        if (data && 'parentViewMode' in data) {
          data.parentViewMode = migrateViewMode(data.parentViewMode as string | undefined)
        }
        return { ...n, type: n.type || 'deviceNode', data }
      })
      const loadedEdges = (topoFile.edges || []).map((e: Edge) => ({ ...e, type: e.type || 'animated', data: { ...defaultEdgeData, ...e.data } }))
      history.pushSnapshot(nodesRef.current, edges)
      setNodes(loadedNodes)
      setEdges(loadedEdges)
      setIsDirty(true)
      history.clearHistory()
      toast.showToast(`已加载模板「${templateName}」`, 'success')
      setContextMenu(null)
    } catch (err: any) {
      toast.showToast(`加载模板失败：${err.message}`, 'error')
    }
  }, [setNodes, setEdges, edges, history, toast])

  const handleDeleteTemplate = useCallback(async (templateName: string) => {
    try {
      await window.electronAPI.deleteTemplate(templateName)
      toast.showToast(`模板「${templateName}」已删除`, 'info')
      refreshTemplateList()
    } catch (err: any) {
      toast.showToast(`删除失败：${err.message}`, 'error')
    }
  }, [refreshTemplateList, toast])

  const handleImportTemplate = useCallback(async () => {
    try {
      const result = await window.electronAPI.importTemplate()
      if (result.success) {
        toast.showToast(`已导入模板「${result.name}」`, 'success')
        refreshTemplateList()
      } else if (!result.canceled) {
        toast.showToast(`导入失败：${result.error || '未知错误'}`, 'error')
      }
    } catch (err: any) {
      toast.showToast(`导入模板失败：${err.message}`, 'error')
    }
  }, [refreshTemplateList, toast])

  // Load template list on mount
  useEffect(() => { refreshTemplateList() }, [refreshTemplateList])

  // ── Drag & Drop from Sidebar ────────────────────────────
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'

    // V1.1.1: Detect which rack (if any) is under cursor for hover highlight
    if (event.dataTransfer.types.includes('application/topo-device') && rfInstance && reactFlowWrapper.current) {
      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
      const hoveredRack = nodesRef.current.find((n) => {
        if (n.type !== 'rackNode') return false
        const rd = n.data as unknown as RackNodeData
        return isPositionInRack(position.x, position.y, {
          position: n.position,
          data: { uHeight: rd.uHeight, viewMode: rd.viewMode },
        })
      })
      const newId = hoveredRack?.id ?? null
      if (dragOverRackIdRef.current !== newId) {
        dragOverRackIdRef.current = newId
        setDragOverRackId(newId)
      }
    } else {
      if (dragOverRackIdRef.current !== null) {
        dragOverRackIdRef.current = null
        setDragOverRackId(null)
      }
    }
  }, [rfInstance])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (!reactFlowWrapper.current || !rfInstance) return

      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      // ── Case 1: Drop a rack cabinet ──────────────────────
      const rackDataStr = event.dataTransfer.getData('application/topo-rack')
      if (rackDataStr) {
        const rackSize: { uHeight: number; label: string } = JSON.parse(rackDataStr)
        const rackWidth = getRackNodeWidth('front')
        const newNode: Node = {
          id: `rack-${Date.now()}`,
          type: 'rackNode',
          position: {
            x: position.x - rackWidth / 2,
            y: position.y - RACK_HEADER_H,
          },
          data: {
            uHeight: rackSize.uHeight,
            label: rackSize.label,
            viewMode: 'front' as const,
            accessories: [],
          } as unknown as Record<string, unknown>,
        }
        history.pushSnapshot(nodesRef.current, edges)
        setNodes((nds) => [...nds, newNode])
        setIsDirty(true)
        return
      }

      // ── Case 2: Drop a device (standalone or into rack) ──
      const deviceDataStr = event.dataTransfer.getData('application/topo-device')
      if (!deviceDataStr) return

      const device: DeviceRow = JSON.parse(deviceDataStr)

      // Check if drop position is inside any rack
      const currentNodes = nodesRef.current
      const targetRack = currentNodes.find((n) => {
        if (n.type !== 'rackNode') return false
        const rackData = n.data as unknown as RackNodeData
        return isPositionInRack(position.x, position.y, {
          position: n.position,
          data: { uHeight: rackData.uHeight, viewMode: rackData.viewMode },
        })
      })

      if (targetRack) {
        // ── Place device inside the rack ───────────────────
        const rackData = targetRack.data as unknown as RackNodeData
        const targetUHeight = getDefaultUHeight(device.category_name)

        // Collect occupied slots from existing child devices and accessories
        const childNodes = currentNodes.filter((n) => n.parentId === targetRack.id)
        const occupiedSlots = getOccupiedSlots(
          childNodes.map((n) => ({
            uPosition: pixelYToUPosition(n.position.y),
            uHeight: (n.data as unknown as RackDeviceNodeData).uHeight || 1,
          })),
          rackData.accessories || [],
        )

        const freeU = findFreeUSlot(rackData.uHeight, targetUHeight, occupiedSlots)
        if (freeU < 0) {
          toast.showToast('机柜空间不足，无法放入该设备', 'warning')
          return
        }

        history.pushSnapshot(currentNodes, edges)
        const newNode: Node = {
          id: `device-${Date.now()}`,
          type: 'rackDeviceNode',
          parentId: targetRack.id,
          extent: 'parent' as const,
          position: {
            x: RACK_RAIL_W + 4,
            y: uPositionToPixelY(freeU),
          },
          data: {
            device,
            customName: '',
            uHeight: targetUHeight,
            uPosition: rackData.uHeight - freeU,
            parentViewMode: rackData.viewMode,
            powerSupplyCount: 1,
          } as unknown as Record<string, unknown>,
        }
        setNodes((nds) => [...nds, newNode])
        setIsDirty(true)
        return
      }

      // ── Case 3: Drop as standalone device on canvas ─────
      const newNode: Node = {
        id: `device-${Date.now()}`,
        type: 'deviceNode',
        position: {
          x: position.x - 90,
          y: position.y - 30,
        },
        data: {
          device,
          customName: '',
        },
      }

      history.pushSnapshot(currentNodes, edges)
      setNodes((nds) => [...nds, newNode])
      setIsDirty(true)
    },
    [rfInstance, setNodes, edges, history, toast],
  )

  // ── Double-click node ──────────────────────────────────
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'rackNode') return
      console.log('[DEBUG onNodeDoubleClick] START — node.id:', node.id)
      const rackData = node.data as unknown as RackNodeData
      console.log('[DEBUG onNodeDoubleClick] rackData:', { uHeight: rackData.uHeight, viewMode: rackData.viewMode, label: rackData.label })
      const newMode: RackViewMode = rackData.viewMode === 'front' ? 'back' : 'front'
      console.log('[DEBUG onNodeDoubleClick] newMode:', newMode)
      try {
        history.pushSnapshot(nodesRef.current, edges)
        console.log('[DEBUG onNodeDoubleClick] pushSnapshot done, calling setNodes...')
        setNodes((nds) => {
          console.log('[DEBUG onNodeDoubleClick] setNodes updater — nds count:', nds.length)
          const updated = nds.map((n) => {
            // Toggle the rack node's viewMode
            if (n.id === node.id) {
              console.log('[DEBUG onNodeDoubleClick] toggling rack node:', n.id)
              return {
                ...n,
                data: { ...n.data, viewMode: newMode } as unknown as Record<string, unknown>,
              }
            }
            // Sync parentViewMode to all child devices so they re-render
            if (n.parentId === node.id && n.type === 'rackDeviceNode') {
              console.log('[DEBUG onNodeDoubleClick] syncing child node:', n.id)
              return {
                ...n,
                data: { ...n.data, parentViewMode: newMode } as unknown as Record<string, unknown>,
              }
            }
            return n
          })
          console.log('[DEBUG onNodeDoubleClick] setNodes updater — done, returning', updated.length, 'nodes')
          return updated
        })
        setIsDirty(true)
        console.log('[DEBUG onNodeDoubleClick] DONE')
      } catch (err) {
        console.error('[DEBUG onNodeDoubleClick] ERROR:', err)
      }
    },
    [setNodes, edges, history],
  )

  // ── U-slot snapping on drag stop ────────────────────────
  const onNodeDragStop = useCallback(
    (_event: any, node: Node) => {
      if (node.type !== 'rackDeviceNode' || !node.parentId) return

      const parentRack = nodesRef.current.find(n => n.id === node.parentId)
      if (!parentRack || parentRack.type !== 'rackNode') return

      const rackData = parentRack.data as unknown as RackNodeData
      const deviceData = node.data as unknown as RackDeviceNodeData
      const deviceUHeight = deviceData.uHeight || 1

      // Snap Y to nearest U slot and clamp within rack boundaries
      let snappedY = snapToUSlot(node.position.y, deviceUHeight, rackData.uHeight)
      // Extra safety: clamp device so its full height stays inside rack
      snappedY = clampDeviceInRack(snappedY, deviceUHeight, rackData.uHeight)

      // Check for slot conflicts with other devices in the same rack
      const snappedU = pixelYToUPosition(snappedY)
      const siblings = nodesRef.current.filter(
        n => n.parentId === node.parentId && n.id !== node.id,
      )
      const occupiedSlots = getOccupiedSlots(
        siblings.map(n => ({
          uPosition: pixelYToUPosition(n.position.y),
          uHeight: (n.data as unknown as RackDeviceNodeData).uHeight || 1,
        })),
        rackData.accessories || [],
      )

      // Check if the snapped position overlaps with occupied slots
      const occupied = new Array<boolean>(rackData.uHeight).fill(false)
      for (const slot of occupiedSlots) {
        for (let i = slot.uPosition; i < slot.uPosition + slot.uHeight && i < rackData.uHeight; i++) {
          occupied[i] = true
        }
      }
      let conflict = false
      for (let i = snappedU; i < snappedU + deviceUHeight && i < rackData.uHeight; i++) {
        if (occupied[i]) { conflict = true; break }
      }

      if (conflict) {
        // Bounce back to original position (don't update)
        return
      }

      // Only update if position actually changed
      if (Math.abs(node.position.x - RACK_RAIL_W - 4) > 2 || Math.abs(node.position.y - snappedY) > 2) {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                position: { x: RACK_RAIL_W + 4, y: snappedY },
                data: {
                  ...n.data,
                  uPosition: pixelYToUDisplay(snappedY, rackData.uHeight),
                } as unknown as Record<string, unknown>,
              }
            }
            return n
          }),
        )
        setIsDirty(true)
      }
    },
    [setNodes],
  )

  // ── Node data update ────────────────────────────────────
  const updateNodeData = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      history.pushSnapshot(nodesRef.current, edges)
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const merged = { ...node, data: { ...node.data, ...newData } }
            return merged
          }
          // If a rack node's viewMode changed, sync parentViewMode to all its children
          if ('viewMode' in newData && node.parentId === nodeId && node.type === 'rackDeviceNode') {
            return {
              ...node,
              data: { ...node.data, parentViewMode: newData.viewMode } as unknown as Record<string, unknown>,
            }
          }
          return node
        })
      )
      // Sync selectedNode so PropertyPanel shows real-time updates
      setSelectedNode((prev) => {
        if (prev && prev.id === nodeId) {
          return { ...prev, data: { ...prev.data, ...newData } }
        }
        return prev
      })
      setIsDirty(true)
    },
    [setNodes, edges, history],
  )

  // ── Edge data update ────────────────────────────────────
  const updateEdgeData = useCallback(
    (edgeId: string, newData: Partial<EdgeData>) => {
      // Debounce continuous slider changes: only snapshot first change per burst
      const snapshotKey = 'edge-' + edgeId
      const existing = sliderSnapshotRef.current
      if (!existing.has(snapshotKey)) {
        history.pushSnapshot(nodesRef.current, edges)
        existing.set(snapshotKey, snapshotKey)
        if (sliderTimerRef.current) clearTimeout(sliderTimerRef.current)
        sliderTimerRef.current = setTimeout(() => {
          sliderSnapshotRef.current.clear()
        }, 400)
      }
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === edgeId) {
            return { ...edge, data: { ...edge.data, ...newData } }
          }
          return edge
        })
      )
      setIsDirty(true)
    },
    [setEdges, edges, history],
  )

  // ── Alignment & Distribution ──────────────────────────────
  // Grid snap helper (matches React Flow snapGrid={[10, 10]})
  const snapToGridPoint = (val: number): number => Math.round(val / 10) * 10

  const handleAlignLeft = useCallback(() => {
    const currentNodes = nodesRef.current
    const selected = currentNodes.filter(n => n.selected)
    if (selected.length < 2) return
    const minX = Math.min(...selected.map(n => n.position.x))
    history.pushSnapshot(currentNodes, edges)
    setNodes((nds) => nds.map(n =>
      n.selected ? { ...n, position: { ...n.position, x: snapToGridPoint(minX) } } : n
    ))
    setIsDirty(true)
  }, [setNodes, edges, history])

  const handleAlignHorizontalCenter = useCallback(() => {
    const currentNodes = nodesRef.current
    const selected = currentNodes.filter(n => n.selected)
    if (selected.length < 2) return
    const avgX = selected.reduce((sum, n) => sum + n.position.x, 0) / selected.length
    history.pushSnapshot(currentNodes, edges)
    setNodes((nds) => nds.map(n =>
      n.selected ? { ...n, position: { ...n.position, x: snapToGridPoint(avgX) } } : n
    ))
    setIsDirty(true)
  }, [setNodes, edges, history])

  const handleAlignRight = useCallback(() => {
    const currentNodes = nodesRef.current
    const selected = currentNodes.filter(n => n.selected)
    if (selected.length < 2) return
    const maxX = Math.max(...selected.map(n => n.position.x))
    history.pushSnapshot(currentNodes, edges)
    setNodes((nds) => nds.map(n =>
      n.selected ? { ...n, position: { ...n.position, x: snapToGridPoint(maxX) } } : n
    ))
    setIsDirty(true)
  }, [setNodes, edges, history])

  const handleAlignTop = useCallback(() => {
    const currentNodes = nodesRef.current
    const selected = currentNodes.filter(n => n.selected)
    if (selected.length < 2) return
    const minY = Math.min(...selected.map(n => n.position.y))
    history.pushSnapshot(currentNodes, edges)
    setNodes((nds) => nds.map(n =>
      n.selected ? { ...n, position: { ...n.position, y: snapToGridPoint(minY) } } : n
    ))
    setIsDirty(true)
  }, [setNodes, edges, history])

  const handleAlignVerticalCenter = useCallback(() => {
    const currentNodes = nodesRef.current
    const selected = currentNodes.filter(n => n.selected)
    if (selected.length < 2) return
    const avgY = selected.reduce((sum, n) => sum + n.position.y, 0) / selected.length
    history.pushSnapshot(currentNodes, edges)
    setNodes((nds) => nds.map(n =>
      n.selected ? { ...n, position: { ...n.position, y: snapToGridPoint(avgY) } } : n
    ))
    setIsDirty(true)
  }, [setNodes, edges, history])

  const handleAlignBottom = useCallback(() => {
    const currentNodes = nodesRef.current
    const selected = currentNodes.filter(n => n.selected)
    if (selected.length < 2) return
    const maxY = Math.max(...selected.map(n => n.position.y))
    history.pushSnapshot(currentNodes, edges)
    setNodes((nds) => nds.map(n =>
      n.selected ? { ...n, position: { ...n.position, y: snapToGridPoint(maxY) } } : n
    ))
    setIsDirty(true)
  }, [setNodes, edges, history])

  const handleDistributeHorizontal = useCallback(() => {
    const currentNodes = nodesRef.current
    const selected = currentNodes.filter(n => n.selected)
    if (selected.length < 3) return
    const sorted = [...selected].sort((a, b) => a.position.x - b.position.x)
    const minX = sorted[0].position.x
    const maxX = sorted[sorted.length - 1].position.x
    const spacing = (maxX - minX) / (sorted.length - 1)
    history.pushSnapshot(currentNodes, edges)
    setNodes((nds) => nds.map(n => {
      if (!n.selected) return n
      const idx = sorted.findIndex(s => s.id === n.id)
      return { ...n, position: { ...n.position, x: snapToGridPoint(minX + idx * spacing) } }
    }))
    setIsDirty(true)
  }, [setNodes, edges, history])

  const handleDistributeVertical = useCallback(() => {
    const currentNodes = nodesRef.current
    const selected = currentNodes.filter(n => n.selected)
    if (selected.length < 3) return
    const sorted = [...selected].sort((a, b) => a.position.y - b.position.y)
    const minY = sorted[0].position.y
    const maxY = sorted[sorted.length - 1].position.y
    const spacing = (maxY - minY) / (sorted.length - 1)
    history.pushSnapshot(currentNodes, edges)
    setNodes((nds) => nds.map(n => {
      if (!n.selected) return n
      const idx = sorted.findIndex(s => s.id === n.id)
      return { ...n, position: { ...n.position, y: snapToGridPoint(minY + idx * spacing) } }
    }))
    setIsDirty(true)
  }, [setNodes, edges, history])

  // ── File Operations ──────────────────────────────────────
  const {
    handleNew,
    clearCanvas,
    handleNewSave,
    handleNewDiscard,
    handleNewCancel,
    handleSave,
    handleSaveAs,
    handleOpen,
    doOpen,
    handleOpenByPath,
    handleExportPNG,
    handleExportPDF,
  } = useFileOperations({
    rfInstance,
    currentFilePath,
    isDirty,
    nodes,
    edges,
    setNodes,
    setEdges,
    setCurrentFilePath,
    setIsDirty,
    setShowOpenConfirm,
    setShowNewConfirm,
    setSelectedNode,
    setSelectedEdge,
    setPanelCollapsed,
    containerRef: reactFlowWrapper,
    history,
    toast,
    defaultEdgeData,
  })

  // ── GIF export (Electron capturePage for animation preservation) ──
  const { isExportingGIF, handleExportGIF } = useGifExport({
    containerRef: reactFlowWrapper,
    toast,
  })

  // ── Menu action listener ────────────────────────────────
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuAction((rawAction) => {
      // Support both string and object payloads (for openRecent with filePath)
      const action = typeof rawAction === 'string' ? rawAction : rawAction.action
      const filePath = typeof rawAction === 'object' ? rawAction.filePath : undefined

      switch (action) {
        case 'new':
          handleNew()
          break
        case 'open':
          handleOpen()
          break
        case 'save':
          handleSave()
          break
        case 'saveAs':
          handleSaveAs()
          break
        case 'openRecent':
          if (filePath) handleOpenByPath(filePath)
          break
        case 'exportPNG':
          handleExportPNG()
          break
        case 'exportPDF':
          handleExportPDF()
          break
        case 'exportGIF':
          handleExportGIF()
          break
        case 'zoomIn':
          rfInstance?.zoomIn()
          break
        case 'zoomOut':
          rfInstance?.zoomOut()
          break
        case 'fitView':
          rfInstance?.fitView()
          break
        case 'toggleSidebar':
          setSidebarCollapsed(v => !v)
          break
        case 'deleteSelected':
          if (rfInstance) {
            const selectedNodes = rfInstance.getNodes().filter(n => n.selected)
            const selectedEdges = rfInstance.getEdges().filter(e => e.selected)
            if (selectedNodes.length > 0 || selectedEdges.length > 0) {
              history.pushSnapshot(nodesRef.current, edges)
              rfInstance.deleteElements({ nodes: selectedNodes, edges: selectedEdges })
              setSelectedNode(null)
              setSelectedEdge(null)
              setIsDirty(true)
            }
          }
          break
        case 'selectAll':
          if (rfInstance) {
            rfInstance.setNodes(nodesRef.current.map(n => ({ ...n, selected: true })))
          }
          break
        case 'undo': {
          const prev = history.undo()
          if (prev) {
            setNodes(prev.nodes)
            setEdges(prev.edges)
            setSelectedNode(null)
            setSelectedEdge(null)
          }
          break
        }
        case 'redo': {
          const next = history.redo()
          if (next) {
            setNodes(next.nodes)
            setEdges(next.edges)
            setSelectedNode(null)
            setSelectedEdge(null)
          }
          break
        }
      }
    })
    return cleanup
  }, [handleNew, handleOpen, doOpen, handleSave, handleSaveAs, handleOpenByPath, handleExportPNG, handleExportPDF, handleExportGIF, rfInstance, edges, history])

  // Sync selectedNode when nodes change
  const onNodesChangeWithSync = useCallback(
    (changes: NodeChange[]) => {
      // Track drag start/stop to avoid snapshotting during drag
      for (const c of changes) {
        if (c.type === 'position' && c.dragging === true && !isDraggingRef.current) {
          // Drag started — snapshot before position changes
          isDraggingRef.current = true
          history.pushSnapshot(nodesRef.current, edges)
          setIsDirty(true)
        }
        if (c.type === 'position' && c.dragging === false) {
          isDraggingRef.current = false
        }
        if (c.type === 'remove') {
          // Node removed via keyboard delete — snapshot
          if (!isDraggingRef.current) {
            history.pushSnapshot(nodesRef.current, edges)
            setIsDirty(true)
          }
          // V1.1.0: If removing a rack node, also remove its child devices
          const removedNode = nodesRef.current.find(n => n.id === c.id)
          if (removedNode?.type === 'rackNode') {
            onNodesChange(
              nodesRef.current
                .filter(n => n.parentId === c.id)
                .map(n => ({ id: n.id, type: 'remove' as const }))
            )
          }
        }
        if (c.type === 'dimensions' && c.dimensions && c.resizing === true && !isDraggingRef.current) {
          // Node resize started — snapshot
          isDraggingRef.current = true
          history.pushSnapshot(nodesRef.current, edges)
          setIsDirty(true)
        }
        if (c.type === 'dimensions' && c.dimensions && c.resizing === false) {
          isDraggingRef.current = false
        }
      }
      onNodesChange(changes)
      if (selectedNode) {
        setSelectedNode((prev) => {
          const updated = changes.find((c) => c.id === prev?.id && c.type === 'select')
          return updated ? { ...prev, selected: updated.selected } : prev
        })
      }
    },
    [onNodesChange, selectedNode, edges, history],
  )

  // Sync when edges change via keyboard delete (React Flow internal)
  const onEdgesChangeWithSync = useCallback(
    (changes: any[]) => {
      for (const c of changes) {
        if (c.type === 'remove' && !isDraggingRef.current) {
          history.pushSnapshot(nodesRef.current, edges)
          setIsDirty(true)
        }
      }
      onEdgesChange(changes)
    },
    [onEdgesChange, edges, history],
  )

  // ── Auto-save timer ─────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!isDirty || !rfInstance) return
      try {
        const flow = rfInstance.toObject()
        const topoFile = {
          version: '1.0.0',
          nodes: flow.nodes,
          edges: flow.edges,
          viewport: flow.viewport,
        }
        const data = JSON.stringify(topoFile, null, 2)
        if (currentFilePath) {
          // Silent save to known path
          await window.electronAPI.saveFile(data, currentFilePath)
          console.log('[Auto-save] saved to:', currentFilePath)
        } else {
          // Save to autosave backup
          await window.electronAPI.autoSave(data)
          console.log('[Auto-save] saved to backup')
        }
        setIsDirty(false)
      } catch (err) {
        console.error('[Auto-save] error:', err)
      }
    }, 120_000) // 2 minutes

    return () => clearInterval(timer)
  }, [isDirty, currentFilePath, rfInstance])

  // ── Check for auto-save on startup ──────────────────────
  useEffect(() => {
    window.electronAPI.checkAutoSave().then(result => {
      if (result?.exists && result.content) {
        setShowAutoSaveRecover(result.content)
      }
    }).catch(() => {})
  }, []) // Run once on mount

  const handleAutoSaveRecover = useCallback(() => {
    const content = showAutoSaveRecover
    setShowAutoSaveRecover(null)
    if (!content) return
    try {
      const topoFile = JSON.parse(content)
      const loadedNodes = (topoFile.nodes || []).map((n: Node) => {
        const data = n.data as Record<string, unknown> | undefined
        if (data && 'viewMode' in data) {
          data.viewMode = migrateViewMode(data.viewMode as string | undefined)
        }
        if (data && 'parentViewMode' in data) {
          data.parentViewMode = migrateViewMode(data.parentViewMode as string | undefined)
        }
        return { ...n, type: n.type || 'deviceNode', data }
      })
      const loadedEdges = (topoFile.edges || []).map((e: Edge) => ({
        ...e,
        type: e.type || 'animated',
        data: { ...defaultEdgeData, ...e.data },
      }))
      setNodes(loadedNodes)
      setEdges(loadedEdges)
      setIsDirty(true)
      history.clearHistory()
      toast.showToast('已恢复未保存的拓扑图，请尽快保存 (Ctrl+S)', 'info')
    } catch (err) {
      console.error('[Auto-save] restore error:', err)
    }
  }, [showAutoSaveRecover, setNodes, setEdges, history])

  const handleAutoSaveDismiss = useCallback(() => {
    setShowAutoSaveRecover(null)
    window.electronAPI.clearAutoSave().catch(() => {})
  }, [])

  // ── Canvas context menu actions ──────────────────────────
  const handleSelectAll = useCallback(() => {
    if (rfInstance) {
      rfInstance.setNodes(nodesRef.current.map(n => ({ ...n, selected: true })))
    }
    setContextMenu(null)
  }, [rfInstance])

  const handleFitView = useCallback(() => {
    if (rfInstance) {
      rfInstance.fitView()
    }
    setContextMenu(null)
  }, [rfInstance])

  const handleZoomIn = useCallback(() => { rfInstance?.zoomIn() }, [rfInstance])
  const handleZoomOut = useCallback(() => { rfInstance?.zoomOut() }, [rfInstance])

  // ── Viewport tracking ────────────────────────────────────
  const onMove = useCallback(
    (_evt: any, viewport: { zoom: number; x: number; y: number }) => {
      setViewportZoom(viewport.zoom)
    },
    [],
  )

  // ── Keyboard shortcuts ──────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with open dialogs or focused inputs
      if (showNewConfirm || showOpenConfirm || showAutoSaveRecover) return
      const target = e.target as HTMLElement
      const isEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)

      // Ctrl+C — Copy selected nodes
      if (e.ctrlKey && e.key === 'c' && !isEditing) {
        const selectedNodes = nodesRef.current.filter(n => n.selected)
        if (selectedNodes.length > 0) {
          clipboardRef.current = selectedNodes.map(n => ({
            position: { ...n.position },
            data: JSON.parse(JSON.stringify(n.data)),
          }))
          setHasClipboard(true)
        }
        return
      }

      // Ctrl+V — Paste nodes from clipboard
      if (e.ctrlKey && e.key === 'v' && !isEditing) {
        e.preventDefault()
        doPaste()
        return
      }

      // Ctrl+D — Duplicate selected nodes
      if (e.ctrlKey && e.key === 'd' && !isEditing) {
        e.preventDefault()
        doDuplicate()
        return
      }

      // Ctrl+F — Search canvas
      if (e.ctrlKey && e.key === 'f' && !isEditing) {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
        return
      }

      // Ctrl+G — Group selected nodes
      if (e.ctrlKey && e.key === 'g' && !e.shiftKey && !isEditing) {
        e.preventDefault()
        const selected = nodesRef.current.filter(n => n.selected)
        if (selected.length < 2) {
          toast.showToast('请至少选择 2 台设备进行分组', 'info')
          return
        }
        showPrompt('设备分组', `为选中的 ${selected.length} 台设备设置分组名称：`, '').then(groupName => {
          if (!groupName || !groupName.trim()) return
          history.pushSnapshot(nodesRef.current, edges)
          setNodes((nds) => nds.map(n =>
            n.selected ? { ...n, data: { ...n.data, groupName: groupName.trim() } } : n
          ))
          setIsDirty(true)
          toast.showToast(`已创建分组「${groupName.trim()}」（${selected.length} 台设备）`, 'success')
        })
        return
      }

      // Ctrl+Shift+G — Ungroup selected nodes
      if (e.ctrlKey && e.key === 'g' && e.shiftKey && !isEditing) {
        e.preventDefault()
        const selected = nodesRef.current.filter(n => n.selected)
        if (selected.length === 0) return
        history.pushSnapshot(nodesRef.current, edges)
        setNodes((nds) => nds.map(n =>
          n.selected ? { ...n, data: { ...n.data, groupName: undefined } } : n
        ))
        setIsDirty(true)
        toast.showToast(`已取消分组（${selected.length} 台设备）`, 'info')
        return
      }

      if (e.key !== 'Escape') return

      setNodes((nds) => nds.map(n => ({ ...n, selected: false })))
      setEdges((eds) => eds.map(e => ({ ...e, selected: false })))
      setSelectedNode(null)
      setSelectedEdge(null)
      setPanelCollapsed(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setNodes, setEdges, doPaste, doDuplicate, showNewConfirm, showOpenConfirm, showAutoSaveRecover, showPrompt, toast])

  return (
    <div className="flex flex-col w-screen h-screen bg-canvas">
      {/* Toolbar */}
      <Toolbar
        nodes={nodes}
        edges={edges}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNew={handleNew}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onOpen={handleOpen}
        onExportPNG={handleExportPNG}
        onExportPDF={handleExportPDF}
        onExportGIF={handleExportGIF}
        isExportingGIF={isExportingGIF}
        isDirty={isDirty}
        theme={theme}
        onToggleTheme={toggleTheme}
        onUndo={() => {
          const prev = history.undo()
          if (prev) {
            setNodes(prev.nodes)
            setEdges(prev.edges)
            setSelectedNode(null)
            setSelectedEdge(null)
          }
        }}
        onRedo={() => {
          const next = history.redo()
          if (next) {
            setNodes(next.nodes)
            setEdges(next.edges)
            setSelectedNode(null)
            setSelectedEdge(null)
          }
        }}
        canUndo={history.canUndo()}
        canRedo={history.canRedo()}
        selectedCount={selectedCount}
        onAlignLeft={handleAlignLeft}
        onAlignHorizontalCenter={handleAlignHorizontalCenter}
        onAlignRight={handleAlignRight}
        onAlignTop={handleAlignTop}
        onAlignVerticalCenter={handleAlignVerticalCenter}
        onAlignBottom={handleAlignBottom}
        onDistributeHorizontal={handleDistributeHorizontal}
        onDistributeVertical={handleDistributeVertical}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled(!snapEnabled)}
        isDemoMode={isDemoMode}
        onToggleDemoMode={toggleDemoMode}
        onOpenSearch={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        viewportZoom={viewportZoom}
        templateList={templateList}
        onSaveAsTemplate={handleSaveAsTemplate}
        onLoadTemplate={handleLoadTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onImportTemplate={handleImportTemplate}
        onRefreshTemplateList={refreshTemplateList}
      />

      {/* Status bar */}
      <div className="h-6 bg-surface border-t border-border flex items-center justify-between px-3 text-2xs text-text-secondary select-none">
        <div className="flex items-center gap-3">
          <span>🔍 {Math.round(viewportZoom * 100)}%</span>
          <span>📦 {nodes.length} 设备</span>
          <span>🔗 {edges.length} 连线</span>
          {selectedCount > 0 && <span className="text-accent">✓ 选中 {selectedCount}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span>Ctrl+G 分组</span>
          <span className="text-border">|</span>
          <span>Ctrl+F 搜索</span>
          <span className="text-border">|</span>
          <span>Ctrl+C/V 复制粘贴</span>
          <span className="text-border">|</span>
          <span>Esc 取消选中</span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div
          className={`transition-all duration-200 ${
            sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-sidebar'
          }`}
        >
          <Sidebar />
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <DemoModeContext.Provider value={{ isDemoMode, toggleDemoMode }}>
          <DragStateContext.Provider value={{ dragOverRackId, isDraggingDevice: dragOverRackId !== null }}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChangeWithSync}
              onEdgesChange={onEdgesChangeWithSync}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onEdgeContextMenu={onEdgeContextMenu}
              onNodeContextMenu={onNodeContextMenu}
              onSelectionContextMenu={onSelectionContextMenu}
              onPaneClick={onPaneClick}
              onPaneContextMenu={onPaneContextMenu}
              onMove={onMove}
              onInit={setRfInstance}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onNodeDragStop={onNodeDragStop}
              onNodeDoubleClick={onNodeDoubleClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              deleteKeyCode={['Delete', 'Backspace']}
              multiSelectionKeyCode="Shift"
              selectionOnDrag
              panOnDrag={[1, 2]}
              onSelectionChange={onSelectionChange}
              snapToGrid={snapEnabled}
              snapGrid={[10, 10]}
              connectionLineStyle={{ stroke: 'var(--color-connection-preview)', strokeWidth: 3 }}
              className="bg-canvas"
            >
              {showGrid && (
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1}
                  color="var(--color-canvas-grid)"
                />
              )}
              <Controls
                position="bottom-right"
                className="[&>button]:!bg-surface [&>button]:!border-border [&>button]:!text-text-primary"
              />
              <MiniMap
                position="bottom-left"
                className="!bg-sidebar !border-border"
                maskColor="var(--color-minimap-mask)"
                nodeColor="var(--color-minimap-node)"
              />
            </ReactFlow>

            {/* Empty state hint */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="text-center text-text-secondary select-none">
                  <div className="text-4xl mb-3">📐</div>
                  <p className="text-base mb-1">从左侧拖拽设备或机柜到此处开始绘制拓扑</p>
                  <p className="text-sm">将设备拖入机柜即可自动装配 · 滚轮缩放 · 拖拽平移</p>
                </div>
              </div>
            )}
          </ReactFlowProvider>
          </DragStateContext.Provider>
          </DemoModeContext.Provider>

          {/* ── Canvas search overlay ── */}
          {searchOpen && (
            <>
              <div className="absolute inset-0 z-30" onClick={() => setSearchOpen(false)} />
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-96 max-w-[90%]">
                <div className="bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
                  <div className="flex items-center border-b border-border px-3 py-2">
                    <span className="text-text-secondary mr-2">🔍</span>
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
                      placeholder="搜索设备名称、型号、厂商..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setSearchOpen(false)
                          setSearchQuery('')
                        }
                        if (e.key === 'Enter' && searchResults.length > 0) {
                          handleSearchSelect(searchResults[0].id)
                        }
                      }}
                    />
                    {searchQuery && (
                      <button
                        className="text-text-secondary hover:text-text-primary ml-1"
                        onClick={() => setSearchQuery('')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {searchQuery.trim() && (
                    <div className="max-h-64 overflow-y-auto">
                      {searchResults.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-text-secondary">
                          未找到匹配的设备
                        </div>
                      ) : (
                        searchResults.map((node) => {
                          const data = getNodeData(node)
                          return (
                            <button
                              key={node.id}
                              className="w-full text-left px-3 py-2 hover:bg-hover-bg transition-colors border-b border-border last:border-b-0"
                              onClick={() => handleSearchSelect(node.id)}
                            >
                              <div className="text-xs text-text-primary font-medium truncate">
                                {data?.customName || data?.device?.model || '未命名设备'}
                              </div>
                              <div className="text-2xs text-text-secondary mt-0.5">
                                {[data?.device?.vendor_name, data?.device?.category_name, data?.device?.model]
                                  .filter(Boolean).join(' · ')}
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                  {!searchQuery.trim() && (
                    <div className="px-3 py-4 text-center text-xs text-text-secondary">
                      输入关键词搜索画布上的设备
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Right-click context menu ── */}
          {contextMenu && (
            <CanvasContextMenu
              contextMenu={contextMenu}
              onClose={() => setContextMenu(null)}
              onEdgePathStyle={handleEdgePathStyle}
              onDeleteEdge={handleDeleteEdge}
              onCopyNode={handleCopyNode}
              onDeleteNode={handleDeleteNode}
              onCopyBatch={handleCopyBatch}
              onDeleteBatch={handleDeleteBatch}
              onPaste={doPaste}
              onSelectAll={handleSelectAll}
              onFitView={handleFitView}
              hasClipboard={hasClipboard}
              onUngroupNode={handleUngroupNode}
              onUngroupBatch={handleUngroupBatch}
              hasGroupedNode={
                contextMenu.type === 'node' &&
                !!getNodeData(nodesRef.current.find(n => n.id === contextMenu.id))?.groupName
              }
              hasGroupedSelection={
                contextMenu.type === 'batch' &&
                nodesRef.current.filter(n => n.selected).some(n => !!getNodeData(n)?.groupName)
              }
              onAddDeviceToRack={handleAddDeviceToRack}
              isRackNode={
                contextMenu.type === 'node' &&
                contextMenu.nodeType === 'rackNode'
              }
            />
          )}
        </div>

        {/* Right Property Panel */}
        <div
          className={`transition-all duration-200 ${
            panelCollapsed ? 'w-0 overflow-hidden' : 'w-panel'
          }`}
        >
          <PropertyPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            selectedCount={selectedCount}
            nodes={nodes}
            edges={edges}
            onClose={() => {
              setSelectedNode(null)
              setSelectedEdge(null)
              setPanelCollapsed(true)
            }}
            onUpdateNodeData={updateNodeData}
            onUpdateEdgeData={updateEdgeData}
          />
        </div>
      </div>

      {/* ── Toast notifications ── */}
      <ToastContainer />

      {/* ── Confirmation: Save before new ── */}
      <ConfirmDialog
        open={showNewConfirm}
        title="是否保存当前拓扑？"
        message={
          <>
            画布上现有 {nodes.length} 个设备和 {edges.length} 条连线。
            如果不保存，所有修改将会丢失。
          </>
        }
        confirmLabel="保存"
        discardLabel="不保存"
        onDiscard={handleNewDiscard}
        cancelLabel="取消"
        variant="warning"
        onConfirm={handleNewSave}
        onCancel={handleNewCancel}
      />

      {/* ── Confirmation: Save before open ── */}
      <ConfirmDialog
        open={showOpenConfirm}
        title="是否保存当前拓扑？"
        message="当前画布有未保存的修改。是否保存后再打开文件？"
        confirmLabel="不保存，直接打开"
        cancelLabel="取消"
        variant="warning"
        onConfirm={doOpen}
        onCancel={() => setShowOpenConfirm(false)}
      />

      {/* ── Confirmation: Auto-save recovery ── */}
      <ConfirmDialog
        open={showAutoSaveRecover !== null}
        title="恢复未保存的拓扑图？"
        message="检测到上次未保存的拓扑图。是否恢复？（恢复后请尽快手动保存 Ctrl+S）"
        confirmLabel="恢复"
        cancelLabel="丢弃"
        variant="warning"
        onConfirm={handleAutoSaveRecover}
        onCancel={handleAutoSaveDismiss}
      />

      {/* ── Prompt dialog (replaces window.prompt) ── */}
      <PromptDialog
        open={promptOpen}
        title={promptTitle}
        message={promptMessage}
        defaultValue={promptDefaultValue}
        confirmLabel="确认"
        cancelLabel="取消"
        onConfirm={(value) => {
          setPromptOpen(false)
          promptResolveRef.current?.(value)
        }}
        onCancel={() => {
          setPromptOpen(false)
          promptResolveRef.current?.(null)
        }}
      />

      {/* ── V1.1.1: Rack device picker modal ── */}
      {rackDevicePicker && (
        <RackDevicePickerModal
          rackId={rackDevicePicker.rackId}
          onSelect={(device) => handlePickDeviceForRack(device, rackDevicePicker.rackId)}
          onClose={() => setRackDevicePicker(null)}
        />
      )}

    </div>
  )
}
