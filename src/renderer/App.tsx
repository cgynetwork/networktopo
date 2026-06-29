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
  addEdge,
  BackgroundVariant,
  ReactFlowProvider,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import GIF from 'gif.js'
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url'
import Sidebar from './components/Sidebar/Sidebar'
import PropertyPanel from './components/PropertyPanel/PropertyPanel'
import Toolbar from './components/Toolbar/Toolbar'
import DeviceNode from './components/nodes/DeviceNode'
import AnimatedEdge from './components/edges/AnimatedEdge'
import type { DeviceRow, EdgeData, PathStyle } from './types'
import { getDefaultPortLabel, listAllPorts } from './utils/portParser'

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

  // ── Save confirmation dialog ────────────────────────────
  const [showNewConfirm, setShowNewConfirm] = useState(false)

  // ── Context menu state (unified: edge + node) ────────────
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    type: 'edge' | 'node'
    id: string
  } | null>(null)

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
      const srcDevice = (srcNode?.data as any)?.device
      const tgtDevice = (tgtNode?.data as any)?.device
      const srcPortsInfo = srcDevice?.ports_info
      const sourcePort = srcPortsInfo
        ? (listAllPorts(srcPortsInfo)[0] || getDefaultPortLabel(srcPortsInfo))
        : ''
      const tgtPortsInfo = tgtDevice?.ports_info
      const targetPort = tgtPortsInfo
        ? (listAllPorts(tgtPortsInfo)[0] || getDefaultPortLabel(tgtPortsInfo))
        : ''

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
    },
    [setEdges],
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
    setEdges((eds) => eds.filter((e) => e.id !== contextMenu.id))
    setSelectedEdge(null)
    setContextMenu(null)
  }, [contextMenu, setEdges])

  const handleDeleteNode = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'node') return
    const nodeId = contextMenu.id
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
    setContextMenu(null)
  }, [contextMenu, setNodes, setEdges])

  // ── Edge path style change ───────────────────────────────
  const handleEdgePathStyle = useCallback(
    (style: PathStyle) => {
      if (!contextMenu || contextMenu.type !== 'edge') return
      const edgeId = contextMenu.id
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
    },
    [contextMenu, setEdges],
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

      setNodes((nds) => [...nds, newNode])
    },
    [rfInstance, setNodes],
  )

  // ── Node data update ────────────────────────────────────
  const updateNodeData = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...newData } }
          }
          return node
        })
      )
    },
    [setNodes],
  )

  // ── Edge data update ────────────────────────────────────
  const updateEdgeData = useCallback(
    (edgeId: string, newData: Partial<EdgeData>) => {
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === edgeId) {
            return { ...edge, data: { ...edge.data, ...newData } }
          }
          return edge
        })
      )
    },
    [setEdges],
  )

  // ── File Operations ──────────────────────────────────────
  const handleNew = useCallback(() => {
    if (nodes.length > 0 || edges.length > 0) {
      setShowNewConfirm(true)
    } else {
      clearCanvas()
    }
  }, [nodes.length, edges.length])

  const clearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
    setSelectedNode(null)
    setSelectedEdge(null)
    setPanelCollapsed(true)
    setShowNewConfirm(false)
  }, [setNodes, setEdges])

  const handleNewSave = useCallback(async () => {
    if (rfInstance) {
      const flow = rfInstance.toObject()
      const topoFile = {
        version: '1.0.0',
        nodes: flow.nodes,
        edges: flow.edges,
        viewport: flow.viewport,
      }
      try {
        const result = await window.electronAPI.saveFile(JSON.stringify(topoFile, null, 2))
        if (result.success) {
          console.log('Saved to:', result.filePath)
          clearCanvas()
        }
      } catch (err) {
        console.error('Save error:', err)
      }
    }
  }, [rfInstance, clearCanvas])

  const handleNewDiscard = useCallback(() => {
    clearCanvas()
  }, [clearCanvas])

  const handleNewCancel = useCallback(() => {
    setShowNewConfirm(false)
  }, [])

  const handleSave = useCallback(async () => {
    if (!rfInstance) return
    const flow = rfInstance.toObject()
    const topoFile = {
      version: '1.0.0',
      nodes: flow.nodes,
      edges: flow.edges,
      viewport: flow.viewport,
    }
    try {
      const result = await window.electronAPI.saveFile(JSON.stringify(topoFile, null, 2))
      if (result.success) {
        console.log('Saved to:', result.filePath)
      } else if (!result.canceled) {
        console.error('Save failed:', result.error)
      }
    } catch (err) {
      console.error('Save error:', err)
    }
  }, [rfInstance])

  const handleOpen = useCallback(async () => {
    try {
      const result = await window.electronAPI.openFile()
      if (result.success && result.content) {
        const topoFile = JSON.parse(result.content)
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
        setPanelCollapsed(true)
      }
    } catch (err) {
      console.error('Open error:', err)
    }
  }, [setNodes, setEdges])

  const captureCanvas = useCallback(async (): Promise<string | null> => {
    if (!reactFlowWrapper.current) return null
    try {
      const dataUrl = await toPng(reactFlowWrapper.current.querySelector('.react-flow') as HTMLElement, {
        backgroundColor: '#FFFFFF',
        pixelRatio: 2,
      })
      return dataUrl
    } catch (err) {
      console.error('Capture error:', err)
      return null
    }
  }, [])

  const handleExportPNG = useCallback(async () => {
    const dataUrl = await captureCanvas()
    if (!dataUrl) return
    try {
      await window.electronAPI.exportPNG(dataUrl)
    } catch (err) {
      console.error('Export PNG error:', err)
    }
  }, [captureCanvas])

  const handleExportPDF = useCallback(async () => {
    const dataUrl = await captureCanvas()
    if (!dataUrl) return
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
      })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      const img = new Image()
      img.src = dataUrl
      await new Promise<void>((resolve) => { img.onload = () => resolve() })

      const imgRatio = img.width / img.height
      let w = pageWidth - 40
      let h = w / imgRatio
      if (h > pageHeight - 40) {
        h = pageHeight - 40
        w = h * imgRatio
      }
      pdf.addImage(dataUrl, 'PNG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h)
      const pdfDataUrl = pdf.output('datauristring')

      await window.electronAPI.exportPDF(pdfDataUrl)
    } catch (err) {
      console.error('Export PDF error:', err)
    }
  }, [captureCanvas])

  // ── GIF export (Electron capturePage for animation preservation) ──
  const [isExportingGIF, setIsExportingGIF] = useState(false)

  const handleExportGIF = useCallback(async () => {
    if (!reactFlowWrapper.current || isExportingGIF) return
    const el = reactFlowWrapper.current.querySelector('.react-flow') as HTMLElement
    if (!el) return

    setIsExportingGIF(true)
    try {
      // Get bounding rect of the ReactFlow canvas in CSS pixels
      const rect = el.getBoundingClientRect()
      // Constrain to reasonable minimums
      if (rect.width < 50 || rect.height < 50) {
        alert('画布区域太小，无法导出 GIF')
        return
      }

      const frameCount = 40       // more frames = smoother animation
      const frameDelay = 55       // ms between frames (~18 fps)
      const gifQuality = 3        // lower = better (1-30), 3 gives excellent color

      // Capture frames using Electron's native page capture
      // This preserves SVG animations (animateMotion, etc.) because it captures
      // the actual rendered output, not a DOM clone like html-to-image does.
      const frames: HTMLCanvasElement[] = []
      let gifWidth = 0
      let gifHeight = 0
      const maxGifDim = 900 // max dimension for GIF output

      for (let i = 0; i < frameCount; i++) {
        // Wait between frames to let animations advance
        if (i > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, frameDelay))
        }

        const dataUrl = await window.electronAPI.captureFrame({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        })

        if (!dataUrl) {
          console.warn(`Frame ${i} capture failed, skipping`)
          continue
        }

        const frameImg = new Image()
        frameImg.src = dataUrl
        await new Promise<void>((resolve2, reject2) => {
          frameImg.onload = () => resolve2()
          frameImg.onerror = () => reject2(new Error('Frame load failed'))
        })

        // Compute output size from first frame
        if (i === 0) {
          const ratio = Math.min(maxGifDim / frameImg.width, maxGifDim / frameImg.height, 1)
          gifWidth = Math.round(frameImg.width * ratio)
          gifHeight = Math.round(frameImg.height * ratio)
        }

        const frameCanvas = document.createElement('canvas')
        frameCanvas.width = gifWidth
        frameCanvas.height = gifHeight
        const ctx = frameCanvas.getContext('2d')!
        // Smooth downscaling for better quality
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(frameImg, 0, 0, gifWidth, gifHeight)
        frames.push(frameCanvas)
      }

      if (frames.length === 0) {
        alert('未能捕获任何帧，GIF 导出失败')
        return
      }

      console.log(`Captured ${frames.length} frames, ${gifWidth}x${gifHeight}`)

      // Encode GIF using gif.js
      const resultBlob = await new Promise<Blob>((resolve, reject) => {
        const gifEncoder = new GIF({
          workers: 2,
          workerScript: gifWorkerUrl,
          quality: gifQuality,
          width: gifWidth,
          height: gifHeight,
          repeat: 0,           // loop forever
          dither: true,        // better color reproduction
        })
        gifEncoder.on('finished', (blob: Blob) => resolve(blob))
        gifEncoder.on('error', (err: Error) => reject(err))
        frames.forEach((canvas) => {
          gifEncoder.addFrame(canvas, { delay: frameDelay, copy: true })
        })
        gifEncoder.render()
      })

      // Convert blob to base64 data URL using FileReader
      const gifDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(resultBlob)
      })

      await window.electronAPI.exportGIF(gifDataUrl)
    } catch (err) {
      console.error('Export GIF error:', err)
      alert('GIF 导出失败，请重试')
    } finally {
      setIsExportingGIF(false)
    }
  }, [isExportingGIF])

  // ── Menu action listener ────────────────────────────────
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuAction((action: string) => {
      switch (action) {
        case 'new':
          handleNew()
          break
        case 'open':
          handleOpen()
          break
        case 'save':
        case 'saveAs':
          handleSave()
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
            rfInstance.deleteElements({ nodes: selectedNodes, edges: selectedEdges })
            setSelectedNode(null)
            setSelectedEdge(null)
          }
          break
        case 'selectAll':
          if (rfInstance) {
            rfInstance.setNodes(nodesRef.current.map(n => ({ ...n, selected: true })))
          }
          break
        case 'undo':
          // Undo is not yet implemented — could use a history stack
          console.log('Undo: not yet implemented')
          break
        case 'redo':
          console.log('Redo: not yet implemented')
          break
      }
    })
    return cleanup
  }, [handleNew, handleOpen, handleSave, handleExportPNG, handleExportPDF, handleExportGIF, rfInstance])

  // Sync selectedNode when nodes change
  const onNodesChangeWithSync = useCallback(
    (changes: any[]) => {
      onNodesChange(changes)
      if (selectedNode) {
        setSelectedNode((prev) => {
          const updated = changes.find((c) => c.id === prev?.id && c.type === 'select')
          return updated ? { ...prev, selected: updated.selected } : prev
        })
      }
    },
    [onNodesChange, selectedNode],
  )

  return (
    <div className="flex flex-col w-screen h-screen bg-white">
      {/* Toolbar */}
      <Toolbar
        nodes={nodes}
        edges={edges}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNew={handleNew}
        onSave={handleSave}
        onOpen={handleOpen}
        onExportPNG={handleExportPNG}
        onExportPDF={handleExportPDF}
        onExportGIF={handleExportGIF}
        isExportingGIF={isExportingGIF}
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
              onEdgesChange={onEdgesChange}
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
              connectionLineStyle={{ stroke: '#2196F3', strokeWidth: 3 }}
              className="bg-white"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="#E5E5E5"
              />
              <Controls
                position="bottom-right"
                className="[&>button]:!bg-white [&>button]:!border-border [&>button]:!text-text-primary"
              />
              <MiniMap
                position="bottom-left"
                className="!bg-sidebar !border-border"
                maskColor="rgba(0,0,0,0.1)"
                nodeColor="#E3F2FD"
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
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setContextMenu(null)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
              />
              <div
                className="fixed z-50 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                {contextMenu.type === 'edge' && (
                  <>
                    {/* Path style submenu */}
                    <div className="px-3 py-1.5 text-2xs text-text-secondary font-medium">
                      连接形式
                    </div>
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
                      onClick={() => handleEdgePathStyle('adaptive')}
                    >
                      <span className="w-4 text-center">↝</span>
                      <span>自适应连接</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
                      onClick={() => handleEdgePathStyle('straight')}
                    >
                      <span className="w-4 text-center">→</span>
                      <span>直线连接</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-primary"
                      onClick={() => handleEdgePathStyle('step')}
                    >
                      <span className="w-4 text-center">└</span>
                      <span>肘形连接线</span>
                    </button>
                    <div className="border-t border-border my-0.5" />
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-red-50 transition-colors flex items-center gap-2"
                      onClick={handleDeleteEdge}
                    >
                      <span>🗑️</span>
                      <span>删除线缆</span>
                    </button>
                  </>
                )}
                {contextMenu.type === 'node' && (
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-red-50 transition-colors flex items-center gap-2"
                    onClick={handleDeleteNode}
                  >
                    <span>🗑️</span>
                    <span>删除设备及相关线缆</span>
                  </button>
                )}
              </div>
            </>
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

      {/* ── Save confirmation dialog ── */}
      {showNewConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleNewCancel}
          />
          <div className="relative bg-white rounded-xl shadow-2xl border border-border p-6 w-[400px] max-w-[90vw]">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-xl">
                ⚠️
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  是否保存当前拓扑？
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  画布上现有 {nodes.length} 个设备和 {edges.length} 条连线。
                  如果不保存，所有修改将会丢失。
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleNewCancel}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-white border border-border hover:bg-hover-bg transition-colors text-text-primary"
              >
                取消
              </button>
              <button
                onClick={handleNewDiscard}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-white border border-danger text-danger hover:bg-red-50 transition-colors"
              >
                不保存
              </button>
              <button
                onClick={handleNewSave}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-select-border text-white hover:opacity-90 transition-opacity"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
