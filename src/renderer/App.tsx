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
import DeviceNode from './components/nodes/DeviceNode'
import AnimatedEdge from './components/edges/AnimatedEdge'
import type { DeviceRow, EdgeData, PathStyle } from './types'
import { getDeviceFromNode, getNodeData } from './types'
import { getDefaultPortLabel, listAllPorts } from './utils/portParser'
import { useHistory } from './hooks/useHistory'
import { useGifExport } from './hooks/useGifExport'
import { useFileOperations } from './hooks/useFileOperations'
import { useTheme } from './context/ThemeContext'
import { useToast } from './context/ToastContext'

// Custom node and edge types for React Flow
const nodeTypes = {
  deviceNode: DeviceNode,
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
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()

  // ── Confirmation dialogs ──────────────────────────────────
  const [showNewConfirm, setShowNewConfirm] = useState(false)
  const [showOpenConfirm, setShowOpenConfirm] = useState(false)
  const [showAutoSaveRecover, setShowAutoSaveRecover] = useState<string | null>(null) // stores the content to recover

  // ── Context menu state (unified: edge + node) ────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

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

  // ── Drag & Drop from Sidebar ────────────────────────────
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const dataStr = event.dataTransfer.getData('application/topo-device')
      if (!dataStr || !reactFlowWrapper.current || !rfInstance) return

      const device: DeviceRow = JSON.parse(dataStr)

      // Convert screen coordinates to flow coordinates
      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      const newNode: Node = {
        id: `device-${Date.now()}`,
        type: 'deviceNode',
        position: {
          x: position.x - 90, // center the node (half of minWidth)
          y: position.y - 30,
        },
        data: {
          device,
          customName: '',
        },
      }

      history.pushSnapshot(nodesRef.current, edges)
      setNodes((nds) => [...nds, newNode])
      setIsDirty(true)
    },
    [rfInstance, setNodes, edges, history],
  )

  // ── Node data update ────────────────────────────────────
  const updateNodeData = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      history.pushSnapshot(nodesRef.current, edges)
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...newData } }
          }
          return node
        })
      )
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
      const loadedNodes = (topoFile.nodes || []).map((n: Node) => ({
        ...n,
        type: n.type || 'deviceNode',
      }))
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

  // ── Escape key to deselect all ─────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Don't interfere with open dialogs or focused inputs
      if (showNewConfirm || showOpenConfirm || showAutoSaveRecover) return
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      setNodes((nds) => nds.map(n => ({ ...n, selected: false })))
      setEdges((eds) => eds.map(e => ({ ...e, selected: false })))
      setSelectedNode(null)
      setSelectedEdge(null)
      setPanelCollapsed(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setNodes, setEdges, showNewConfirm, showOpenConfirm, showAutoSaveRecover])

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
      />

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
              onInit={setRfInstance}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              deleteKeyCode={['Delete', 'Backspace']}
              multiSelectionKeyCode="Shift"
              selectionOnDrag
              panOnDrag={[1, 2]}
              onSelectionChange={onSelectionChange}
              snapToGrid
              snapGrid={[10, 10]}
              connectionLineStyle={{ stroke: 'var(--color-connection-preview)', strokeWidth: 3 }}
              className="bg-canvas"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="var(--color-canvas-grid)"
              />
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
                  <p className="text-base mb-1">从左侧拖拽设备到此处开始绘制拓扑</p>
                  <p className="text-sm">滚轮缩放 · 拖拽平移 · 从连接点连线</p>
                </div>
              </div>
            )}
          </ReactFlowProvider>

          {/* ── Right-click context menu ── */}
          {contextMenu && (
            <CanvasContextMenu
              contextMenu={contextMenu}
              onClose={() => setContextMenu(null)}
              onEdgePathStyle={handleEdgePathStyle}
              onDeleteEdge={handleDeleteEdge}
              onDeleteNode={handleDeleteNode}
              onDeleteBatch={handleDeleteBatch}
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

    </div>
  )
}
