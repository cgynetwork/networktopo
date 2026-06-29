import { useCallback, useEffect, useState, useRef, DragEvent } from 'react'
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
import { getDeviceFromNode } from './types'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(true)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
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
      // Accept all valid inter-node connections
      return true
    },
    [],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      console.log('[onConnect] connection created:', connection)
      // Auto-populate port labels from device ports_info
      const srcNode = nodesRef.current.find(n => n.id === connection.source)
      const tgtNode = nodesRef.current.find(n => n.id === connection.target)
      const srcDevice = getDeviceFromNode(srcNode!)
      const tgtDevice = getDeviceFromNode(tgtNode!)
      const srcPortsInfo = srcDevice?.ports_info
      const sourcePort = srcPortsInfo
        ? (listAllPorts(srcPortsInfo)[0] || getDefaultPortLabel(srcPortsInfo))
        : ''
      const tgtPortsInfo = tgtDevice?.ports_info
      const targetPort = tgtPortsInfo
        ? (listAllPorts(tgtPortsInfo)[0] || getDefaultPortLabel(tgtPortsInfo))
        : ''

      history.pushSnapshot(nodesRef.current, edges)
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'animated',
            data: { ...defaultEdgeData, sourcePort, targetPort },
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
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        id: node.id,
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
              onPaneClick={onPaneClick}
              onInit={setRfInstance}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              deleteKeyCode={['Delete', 'Backspace']}
              multiSelectionKeyCode="Shift"
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
